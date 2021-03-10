import { Role, Util, VoiceChannel } from 'discord.js'
import moment from 'moment'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const commandRecord: CommandProps = async ({ message, guildId }) => {
  if (!message.member?.hasPermission('ADMINISTRATOR')) {
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
    ? cache.settings[guildId].channels
        .split(' ')
        .map(channelId => message.guild?.channels.cache.get(channelId))
        .reduce<VoiceChannel[]>(
          (accumulator, channel) => (channel instanceof VoiceChannel ? [...accumulator, channel] : accumulator),
          [],
        )
    : [message.member.voice.channel]

  if (targetChannels.length === 0) {
    return {
      content: ':x: 找不到有效語音頻道，原本設定的語音頻道好像被刪掉了？',
      isSyntaxError: true,
    }
  }

  const attendedMembers = targetChannels
    .map(channel => channel.members.array())
    .flat()
    .sort((a, b) => (a.id > b.id ? 1 : -1))

  if (attendedMembers.length === 0) {
    return {
      content: `:x: 語音頻道內好像沒有人？點名頻道：${targetChannels.map(channel => channel.name).join('、')}`,
    }
  }

  await database
    .ref(`/records/${guildId}/${moment().format('YYYYMMDD')}`)
    .set(attendedMembers.map(member => member.id).join(' '))

  const roles = await message.guild?.roles.fetch()
  const targetRoles =
    cache.settings[guildId]?.roles
      .split(' ')
      .sort()
      .map(roleId => roles?.cache.get(roleId))
      .reduce<Role[]>((accumulator, role) => (role ? [...accumulator, role] : accumulator), []) || []

  return {
    content: ':triangular_flag_on_post: 點名紀錄 `DATE`\n點名頻道：CHANNELS\n點名對象：ROLES'
      .replace('DATE', moment().format('YYYYMMDD'))
      .replace('CHANNELS', targetChannels.map(channel => channel.name).join('、'))
      .replace('ROLES', targetRoles.map(role => role.name).join('、')),
    embed: {
      fields: attendedMembers
        .filter(member => targetRoles.some(role => member.roles.cache.get(role.id)))
        .reduce<string[][]>((accumulator, member, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(cache.names[member.id] || member.displayName)
          return accumulator
        }, [])
        .map((names, index) => ({
          name: index === 0 ? `出席成員 ${attendedMembers.length} 人` : '.',
          value: names.map(name => Util.escapeMarkdown(name).slice(0, 16)).join('、'),
        })),
    },
  }
}

export default commandRecord
