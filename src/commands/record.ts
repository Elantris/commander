import { GuildMember, Role, Util, VoiceChannel } from 'discord.js'
import moment from 'moment'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'

const commandRecord: CommandProps = async ({ message, guildId }) => {
  if (!isAdmin(message.member)) {
    return {
      content: ':lock: 這個指令限「管理員」使用',
      isSyntaxError: true,
    }
  }

  if (!message.member?.voice.channel) {
    return {
      content: ':x: 請先接聽語音頻道',
      isSyntaxError: true,
    }
  }

  const targetChannels = cache.settings[guildId]?.channels
    ?.split(' ')
    .map(channelId => message.guild?.channels.cache.get(channelId))
    .reduce<VoiceChannel[]>(
      (accumulator, channel) => (channel instanceof VoiceChannel ? [...accumulator, channel] : accumulator),
      [],
    ) || [message.member.voice.channel]

  if (targetChannels.length === 0) {
    return {
      content: ':question: 找不到有效語音頻道，原本設定的語音頻道好像被刪掉了？',
      isSyntaxError: true,
    }
  }

  const attendedMembers = targetChannels
    .reduce<GuildMember[]>(
      (accumulator, channel) => [...accumulator, ...channel.members.filter(m => !m.user.bot).array()],
      [],
    )
    .sort((a, b) => (a.id > b.id ? 1 : -1))

  if (attendedMembers.length === 0) {
    return {
      content: `:question: 語音頻道內好像沒有人？點名頻道：${targetChannels
        .map(channel => Util.escapeMarkdown(channel.name))
        .join('、')}`,
    }
  }

  const date = moment(message.createdTimestamp).format('YYYYMMDD')
  await database.ref(`/records/${guildId}/${date}`).set(attendedMembers.map(member => member.id).join(' '))

  const roles = await message.guild?.roles.fetch()
  const targetRoles =
    cache.settings[guildId]?.roles
      ?.split(' ')
      .map(roleId => roles?.cache.get(roleId))
      .reduce<Role[]>((accumulator, role) => (role ? [...accumulator, role] : accumulator), []) || []
  const isEveryone = targetRoles.length === 0
  const targetMembers = attendedMembers.filter(
    member => isEveryone || targetRoles.some(role => member.roles.cache.get(role.id)),
  )

  return {
    content: ':triangular_flag_on_post: **GUILD_NAME**\n點名日期：`DATE`\n點名頻道：CHANNELS\n點名對象：ROLES'
      .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
      .replace('DATE', date)
      .replace('CHANNELS', targetChannels.map(channel => Util.escapeMarkdown(channel.name)).join('、'))
      .replace('ROLES', isEveryone ? '所有人' : targetRoles.map(role => Util.escapeMarkdown(role.name)).join('、')),
    embed: {
      fields: targetMembers
        .reduce<string[][]>((accumulator, member, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push((cache.names[member.id] || member.displayName).slice(0, 16))
          return accumulator
        }, [])
        .map((names, index) => ({
          name: index === 0 ? `出席成員 ${targetMembers.length} 人` : '.',
          value: names.map(name => Util.escapeMarkdown(name)).join('、'),
        })),
    },
  }
}

export default commandRecord
