import { Interaction } from 'discord.js'
import cache, { commands, database } from './utils/cache'
import sendLog from './utils/sendLog'
import translate from './utils/translate'

const isCooling: { [GuildID in string]?: boolean } = {}
const isProcessing: { [GuildID in string]?: boolean } = {}

// handle commands
const handleInteraction = async (interaction: Interaction) => {
  const guildId = interaction.guildId
  const guild = interaction.guild
  if (!interaction.isChatInputCommand() || !guildId || !guild || isCooling[guildId] || isProcessing[guildId]) {
    return
  }

  const command = commands[interaction.commandName]
  if (!command) {
    return
  }

  isProcessing[guildId] = true

  if (!cache.isInit[guildId]) {
    await guild.roles.fetch()
    await guild.members.fetch()
    cache.settings[guildId] = (await database.ref(`/settings/${guildId}`).once('value')).val() || {}
    cache.isInit[guildId] = true
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
            footer: { text: 'Version 2022-09-02' },
            ...commandResult.embed,
          },
        ]
      : undefined,
    fetchReply: true,
  })

  isCooling[guildId] = true
  setTimeout(() => {
    isCooling[guildId] = false
  }, 5000)

  await sendLog(interaction, response)
}

export default handleInteraction