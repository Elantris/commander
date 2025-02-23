import { Client, Interaction, MessageFlags, REST, RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord.js'
import { readdirSync } from 'fs'
import { join } from 'path'
import appConfig from './appConfig.js'
import cache, { CommandProps, database } from './helper/cache.js'
import sendLog from './helper/sendLog.js'
import translate from './helper/translate.js'
import timeFormatter from './utils/timeFormatter.js'

const commands: { [CommandName in string]?: CommandProps['exec'] } = {}

export const registerCommands = async (client: Client<true>) => {
  const body: RESTPostAPIApplicationCommandsJSONBody[] = []

  for (const filename of readdirSync(join(import.meta.dirname, './commands'))) {
    if (!filename.endsWith('.js') && !filename.endsWith('.ts')) {
      return
    }

    const commandName = filename.split('.')[0]
    const { default: command }: { default?: Partial<CommandProps> } = await import(
      join(import.meta.dirname, './commands', filename)
    )

    if (command?.exec && command.build) {
      commands[commandName] = command.exec
      body.push(command.build)
    }
  }

  const rest = new REST({ version: '10' }).setToken(appConfig.DISCORD.TOKEN)
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body })
  } catch (error) {
    await cache.logChannel?.send(
      `\`${timeFormatter()}\` Register slash commands error\n\`\`\`${error instanceof Error ? error.stack : error}\`\`\``,
    )
  }
}

const isCooling: { [GuildID in string]?: boolean } = {}
const isProcessing: { [GuildID in string]?: boolean } = {}
const lastUsedAt: { [GuildID in string]?: { [CommandName in string]?: number } } = {}
const coolingTime: { [CommandName in string]?: number } = {
  config: 5000,
  modify: 30000,
  record: 30000,
  report: 60000,
}

// handle commands
const handleInteraction = async (interaction: Interaction) => {
  if (!interaction.inGuild() || !interaction.isChatInputCommand()) {
    return
  }

  const { guildId, guild } = interaction
  const command = commands[interaction.commandName]
  if (!guild || !command) {
    return
  }

  if (isProcessing[guildId]) {
    await interaction.reply({
      content: translate('system.text.processing', { guildId }),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  if (
    isCooling[guildId] ||
    interaction.createdTimestamp - (lastUsedAt[guildId]?.[interaction.commandName] || 0) <
      (coolingTime[interaction.commandName] || 0)
  ) {
    await interaction.reply({
      content: translate('system.text.cooling', { guildId }),
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  isProcessing[guildId] = true

  if (interaction.createdTimestamp - (cache.isInit[guildId] || 0) > 3600000) {
    await guild.roles.fetch()
    await guild.members.fetch()
    cache.settings[guildId] = (await database.ref(`/settings/${guildId}`).once('value')).val() || {}
    cache.isInit[guildId] = interaction.createdTimestamp
  }

  const commandResult = await command(interaction)
  isProcessing[guildId] = false
  if (!commandResult) {
    return
  }

  const response = await interaction.reply({
    content: commandResult.content,
    embeds: commandResult.embed
      ? [
          {
            color: 0xcc5de8,
            title: translate('system.text.support', { guildId }),
            url: 'https://discord.gg/Ctwz4BB',
            footer: { text: 'Version 2025-02-14' },
            ...commandResult.embed,
          },
        ]
      : undefined,
    withResponse: true,
  })

  isCooling[guildId] = true
  setTimeout(() => {
    delete isCooling[guildId]
  }, 3000)

  if (commandResult.isFinished) {
    if (!lastUsedAt[guildId]) {
      lastUsedAt[guildId] = {}
    }
    lastUsedAt[guildId][interaction.commandName] = interaction.createdTimestamp
  }

  await sendLog(interaction, response.resource?.message)
}

export default handleInteraction
