import { Role, Util, VoiceChannel } from 'discord.js'
import moment from 'moment'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'
import isAdmin from '../utils/isAdmin'

const commandRecord: CommandProps = async ({ message, guildId }) => {
  if (!isAdmin(message.member)) {
    return {
      content: ':x: 這個指令限「管理員」使用',
      isSyntaxError: true,
    }
  }

  if (!message.member?.voice.channel) {
    return {
      content: ':x: 請先接聽語音頻道',
      isSyntaxError: true,
    }
  }

  const targetChannels: VoiceChannel[] = cache.settings[guildId]?.channels
    ?.split(' ')
    .map(channelId => message.guild?.channels.cache.get(channelId))
    .reduce<VoiceChannel[]>(
      (accumulator, channel) => (channel instanceof VoiceChannel ? [...accumulator, channel] : accumulator),
      [],
    ) || [message.member.voice.channel]

  if (targetChannels.length === 0) {
    return {
      content: ':x: 找不到有效語音頻道，原本設定的語音頻道好像被刪掉了？',
      isSyntaxError: true,
    }
  }

  const attendedMembers = targetChannels
    .map(channel => channel.members.array())
    .flat()
    .sort()

  if (attendedMembers.length === 0) {
    return {
      content: `:x: 語音頻道內好像沒有人？點名頻道：${targetChannels.map(channel => channel.name).join('、')}`,
    }
  }

  await database
    .ref(`/records/${guildId}/${moment(message.createdTimestamp).format('YYYYMMDD')}`)
    .set(attendedMembers.map(member => member.id).join(' '))

  const roles = await message.guild?.roles.fetch()
  const targetRoles =
    cache.settings[guildId]?.roles
      ?.split(' ')
      .map(roleId => roles?.cache.get(roleId))
      .reduce<Role[]>((accumulator, role) => (role ? [...accumulator, role] : accumulator), []) || []
  const targetMembers = attendedMembers.filter(
    member => targetRoles.length === 0 || targetRoles.some(role => member.roles.cache.get(role.id)),
  )

  return {
    content: ':triangular_flag_on_post: 點名紀錄 `DATE`\n點名頻道：CHANNELS\n點名對象：ROLES'
      .replace('DATE', moment(message.createdTimestamp).format('YYYYMMDD'))
      .replace('CHANNELS', targetChannels.map(channel => channel.name).join('、'))
      .replace('ROLES', targetRoles.map(role => role.name).join('、') || '（所有人）'),
    embed: {
      fields: targetMembers
        .reduce<string[][]>((accumulator, member, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(cache.names[member.id] || member.displayName)
          return accumulator
        }, [])
        .map((names, index) => ({
          name: index === 0 ? `出席成員 ${targetMembers.length} 人` : '.',
          value: names.map(name => Util.escapeMarkdown(name).slice(0, 16)).join('、'),
        })),
    },
  }
}

export default commandRecord
