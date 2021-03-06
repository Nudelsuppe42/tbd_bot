import Client from "../struct/Client"
import Args from "../struct/Args"
import TimedPunishment from "../entities/TimedPunishment"
import ActionLog from "../entities/ActionLog"
import Command from "../struct/Command"
import GuildMember from "../struct/discord/GuildMember"
import Roles from "../util/roles"
import formatPunishmentTime from "../util/formatPunishmentTime"
import noop from "../util/noop"
import Discord from "discord.js"

export default new Command({
    name: "ban",
    aliases: [],
    description: "Ban a member.",
    permission: [Roles.MODERATOR, Roles.ADMIN],
    usage: "<member> <length> <image URL | attachment> <reason>",
    async run(this: Command, client: Client, message: Discord.Message, args: Args) {
        const user = await args.consumeUser()

        if (!user)
            return client.channel.sendError(
                message.channel,
                user === undefined
                    ? "You must provide a user to ban!"
                    : "Couldn't find that user."
            )
        const member: Discord.GuildMember = await message.guild.members
            .fetch({ user, cache: true })
            .catch(noop)
        if (member) {
            if (member.user.bot)
                return client.channel.sendError(
                    message.channel,
                    "Look at you, hacker, why would you ban a creature from the existance of me? Your rude."
                )
            if (member.id === message.author.id)
                return client.channel.sendError(
                    message.channel,
                    "You can't ban yourself, should be clear isnt it?."
                )
            if (GuildMember.hasRole(member, Roles.STAFF))
                return client.channel.sendError(
                    message.channel,
                    "Alrighty, revolutionist, you can't ban other staff!"
                )
        }

        const length = args.consumeLength()
        if (length == null)
            return client.channel.sendError(message.channel, "You must provide a length!")
        const image = args.consumeImage()
        if (!image)
            return client.channel.sendError(
                message.channel,
                "You must provide a reason image!"
            )
        const reason = args.consumeRest()
        if (!reason)
            return client.channel.sendError(message.channel, "You must provide a reason!")

        const ban = await TimedPunishment.findOne({ member: user.id, type: "ban" })
        if (ban)
            return client.channel.sendError(
                message.channel,
                "The user is already banned!"
            )

        const reviewerChannel = message.guild.channels.cache.find(
            ch => ch.name == "reviewer-committee"
        ) as Discord.TextChannel
        if (member && GuildMember.hasRole(member, Roles.BUILDER) && reviewerChannel)
            client.channel.sendSuccess(
                reviewerChannel,
                `Builder ${user} (${user.id}) was banned!`
            )

        const punishment = new TimedPunishment()
        punishment.member = user.id
        punishment.type = "ban"
        punishment.length = length
        await punishment.save()
        punishment.schedule(client)

        const log = new ActionLog()
        log.action = "ban"
        log.member = user.id
        log.executor = message.author.id
        log.reason = reason
        log.reasonImage = image
        log.length = length
        log.channel = message.channel.id
        log.message = message.id
        log.punishment = punishment
        await log.save()

        await log.notifyMember(client)
        await message.guild.members.ban(user, { reason })
        const formattedLength = formatPunishmentTime(length)
        await client.channel.sendSuccess(
            message.channel,
            `Banned ${user} ${formattedLength} (**#${log.id}**).`
        )
        await client.log(log)
    }
})
