import { Interaction } from 'discord.js'
import cache, { commands, database } from './utils/cache'
import sendLog from './utils/sendLog'
import translate from './utils/translate'

const isCooling: { [GuildID in string]?: boolean } = {}
const isProcessing: { [GuildID in string]?: boolean } = {}
const coolingTime: { [CommandName in string]?: number } = {
  config: 5000,
  modify: 10000,
  record: 60000,
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
      ephemeral: true,
    })
    return
  }

  if (isCooling[guildId]) {
    await interaction.reply({
      content: translate('system.text.cooling', { guildId }),
      ephemeral: true,
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
            footer: { text: 'Version 2023-06-28' },
            ...commandResult.embed,
          },
        ]
      : undefined,
    fetchReply: true,
  })

  isCooling[guildId] = true
  setTimeout(
    () => {
      isCooling[guildId] = false
    },
    commandResult.isFinished ? coolingTime[interaction.commandName] ?? 3000 : 3000,
  )

  await sendLog(interaction, response)
}

export default handleInteraction
