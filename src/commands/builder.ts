import Client from "../struct/Client"
import Args from "../struct/Args"
import Command from "../struct/Command"
import GuildMember from "../struct/discord/GuildMember"
import Guild from "../struct/discord/Guild"
import Roles from "../util/roles"
import noop from "../util/noop"
import AdvancedBuilder from "../entities/AdvancedBuilder"
import ms from "ms"
import Discord from "discord.js"

export default new Command({
    name: "builder",
    aliases: ["architect"],
    description: "Add or remove a user as an Architect or Builder.",
    permission: [Roles.ADMIN],
    usage: "<user> ['remove'] <builder/architect>",
    async run(client: Client, message: Discord.Message, args: Args) {
        const user = await args.consumeUser()
        const remove = !!args.consumeIf("remove")
        if (!user)
            return client.channel.sendError(
                message.channel,
                user === undefined
                    ? "You must provide a user to manage!"
                    : "Couldn't find that user."
            )

        const member = await client.customGuilds
            .main()
            .members.fetch({ user, cache: true })
            .catch(noop)
        if (!member || !GuildMember.hasRole(member, Roles.FAN))
            return client.channel.sendError(
                message.channel,
                "That user is not verified."
            )

        if (remove) {
            if (args.consumeIf("builder")) {
                await member.roles.remove(Guild.role(client.customGuilds.main(), Roles.BUILDER));
                return client.channel.sendSuccess(message.channel, `Removed ${user} from Builder.`)
            } else {
                const record = await AdvancedBuilder.findOne(user.id)
                if (!record)
                    return client.channel.sendError(
                        message.channel,
                        "That user is not an Architect."
                    )

                await record.removeBuilder(client)
                return client.channel.sendSuccess(message.channel, `Removed ${user} from Architect.`)

            }
        } else {
            if (args.consumeIf("architect")) {
                const existingRecord = await AdvancedBuilder.findOne(user.id)
                if (existingRecord) {
                    const oldTime = existingRecord.givenAt
                    existingRecord.givenAt = new Date()
                    await existingRecord.save()
                    existingRecord.schedule(client)

                    oldTime.setMonth(oldTime.getMonth() + 12)
                    const formattedTime = ms(oldTime.getTime() - Date.now(), { long: true })

                    return client.channel.sendSuccess(
                        message.channel,
                        `Advanced ${user} for 12 months (it was going to end in ${formattedTime}).`
                    )
                } else {
                    const record = new AdvancedBuilder()
                    record.builder = user.id
                    await record.save()
                    record.schedule(client)
                    await member.roles.add(Guild.role(client.customGuilds.main(), Roles.ARCHITECT))

                    await user
                        .createDM()
                        .then(dms =>
                            dms.send({
                                embeds: [
                                    {
                                        color: Guild.role(client.customGuilds.main(), Roles.ARCHITECT).color,
                                        description:
                                            "You have been added as an Architect. Good job!"
                                    }
                                ]
                            })
                        )
                        .catch(noop)
                    return client.channel.sendSuccess(
                        message.channel,
                        `Granted ${user} Architect for 12 months.`
                    )
                }
            } else {
                await member.roles.add(Guild.role(client.customGuilds.main(), Roles.BUILDER));
                return client.channel.sendSuccess(
                    message.channel,
                    `Granted ${user} the Builder Role`
                )
            }

        }
    }
})
