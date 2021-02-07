import moment from 'moment'
import { VoiceChannel } from 'discord.js'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const commandRecord: CommandProps = async ({ message, guildId }) => {
  if (!message.member?.voice.channel) {
    return {
      content: ':x: 未接聽語音頻道',
      isSyntaxError: true,
    }
  }

  const targetChannels: VoiceChannel[] = cache.settings[guildId]?.channels
    ? cache.settings[guildId].channels.split(' ').reduce((accumulator, channelId) => {
        const targetChannel = message.guild?.channels.cache.get(channelId)
        if (!targetChannel || !(targetChannel instanceof VoiceChannel)) {
          return accumulator
        }
        return [...accumulator, targetChannel]
      }, [] as VoiceChannel[])
    : [message.member.voice.channel]

  if (targetChannels.length === 0) {
    return {
      content: ':x: 找不到有效語音頻道',
      isSyntaxError: true,
    }
  }

  const attendedMembers = targetChannels
    .map(channel => channel.members.array())
    .flat()
    .sort((a, b) => (a.id > b.id ? 1 : -1))

  if (attendedMembers.length === 0) {
    return {
      content: `:x: 語音頻道內好像沒有人？點名頻道：${targetChannels.join('、')}`,
    }
  }

  await database.ref(`/records/${guildId}/${moment().format('YYYYMMDD')}`).set(attendedMembers.join(' '))

  return {
    content: ':triangular_flag_on_post: `DATE` 點名紀錄：'.replace('DATE', moment().format('YYYYMMDD')),
    embed: {
      description: `點名頻道：${targetChannels.map(channel => channel.name).join('、')}`,
      fields: [
        {
          name: `出席成員 ${attendedMembers.length} 人`,
          value: attendedMembers.map(member => cache.names[member.id] || member.displayName.slice(0, 20)).join('、'),
        },
      ],
    },
  }
}

export default commandRecord
