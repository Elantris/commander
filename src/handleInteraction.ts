import { Interaction, MessageFlags } from 'discord.js'
import cache, { commands, database } from './utils/cache'
import sendLog from './utils/sendLog'
import translate from './utils/translate'

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

  const commandResult = await command.exec(interaction)
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
            footer: { text: 'Version 2025-02-01' },
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

  if (!lastUsedAt[guildId]) {
    lastUsedAt[guildId] = {}
  }
  if (commandResult.isFinished) {
    lastUsedAt[guildId][interaction.commandName] = interaction.createdTimestamp
  }

  await sendLog(interaction, response.resource?.message)
}

export default handleInteraction
