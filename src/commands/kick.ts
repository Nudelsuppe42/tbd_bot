import Client from "../struct/Client"
import Discord from "discord.js"
import Args from "../struct/Args"
import Command from "../struct/Command"
import GuildMember from "../struct/discord/GuildMember"
import ActionLog from "../entities/ActionLog"
import Roles from "../util/roles"
import noop from "../util/noop"

export default new Command({
    name: "kick",
    aliases: ["boot"],
    description: "Kick a member.",
    permission: [Roles.MODERATOR, Roles.MANAGER],
    usage: "<member> [image URL | attachment] <reason>",
    async run(this: Command, client: Client, message: Discord.Message, args: Args) {
        const user = await args.consumeUser()
        if (!user)
            return client.channel.sendError(
                message.channel,
                user === undefined
                    ? "You must provide a user to kick!"
                    : "Couldn't find that user."
            )
        const member: Discord.GuildMember = await message.guild.members
            .fetch({ user, cache: true })
            .catch(noop)
        if (!member)
            return client.channel.sendError(
                message.channel,
                "The user is not in the server!"
            )

        if (member.user.bot)
            return client.channel.sendError(
                message.channel,
                "Look at you, hacker, why would you ban a creature from the existance of me? Your rude."
            )
        if (member.id === message.author.id)
            return client.channel.sendError(
                message.channel,
                "You can't kick yourself, should be clear isnt it?."
            )
        if (GuildMember.hasRole(member, Roles.STAFF))
            return client.channel.sendError(
                message.channel,
                "Alrighty, revolutionist, you can't kick other staff!"
            )

        const image = args.consumeImage()
        const reason = args.consumeRest()
        if (!reason)
            return client.channel.sendError(message.channel, "You must provide a reason!")

        const log = new ActionLog()
        log.action = "kick"
        log.member = user.id
        log.executor = message.author.id
        log.reason = reason
        log.reasonImage = image
        log.channel = message.channel.id
        log.message = message.id
        log.length = null
        await log.save()

        await log.notifyMember(client)
        await member.kick(reason)
        await client.channel.sendSuccess(
            message.channel,
            `Kicked ${user} (**#${log.id}**).`
        )
        await client.log(log)
    }
})
