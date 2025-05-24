import { SlashCommandBuilder, VoiceBasedChannel } from 'discord.js'
import { CommandProps } from '../helper/cache.js'
import isAdmin from '../helper/isAdmin.js'
import translate from '../helper/translate.js'
import timeFormatter from '../utils/timeFormatter.js'

const build = new SlashCommandBuilder()
  .setName('raffle')
  .setDescription('隨機抽選一名當前接聽語音頻道的成員')
  .setDescriptionLocalizations({ 'en-US': 'Random pick a member in voice channels.' })
  .toJSON()

const exec: CommandProps['exec'] = async (interaction) => {
  const { guildId, guild } = interaction

  if (!guildId || !guild) {
    return
  }

  if (!isAdmin(guild, interaction.user.id)) {
    return {
      content: translate('system.error.adminOnly', { guildId }),
    }
  }

  // channels
  const targetChannel = guild.channels.cache.find((channel): channel is VoiceBasedChannel => {
    if (!channel.isVoiceBased() || channel.members.size === 0 || !channel.members.get(interaction.user.id)) {
      return false
    }
    return true
  })

  if (!targetChannel || !targetChannel.id || !targetChannel.members.size) {
    return {
      content: translate('record.error.notInVoiceChannel', { guildId }),
    }
  }

  const members = targetChannel.members.map((v) => v)
  const luck = Math.floor(Math.random() * members.length)

  // response
  return {
    content: ':triangular_flag_on_post: 中獎人為：{MEMBER} <@{MEMBER_ID}>'
      .replace('{MEMBER}', members[luck].displayName)
      .replace('{MEMBER_ID}', members[luck].id),
    embed: {
      description: '抽獎時間：`{TIME}`\n抽獎頻道：{CHANNELS}\n參與人數：{ALL_COUNT}\n中獎機率：{LUCK}%'
        .replace('{TIME}', timeFormatter({ time: interaction.createdTimestamp }))
        .replace('{CHANNELS}', targetChannel.name)
        .replace('{ALL_COUNT}', `${members.length}`)
        .replace('{LUCK}', `${((1 / members.length) * 100).toFixed(2)}`),
    },
    isFinished: true,
  }
}

export default {
  build,
  exec,
}
