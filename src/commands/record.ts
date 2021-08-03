import { GuildMember, Role, Util, VoiceChannel } from 'discord.js'
import moment from 'moment'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'

const commandRecord: CommandProps = async ({ message, guildId }) => {
  if (!isAdmin(message.member)) {
    return {
      content: ':lock: 這個指令限「管理員」使用',
      errorType: 'noAdmin',
    }
  }

  if (!message.member?.voice.channel) {
    return {
      content: ':x: 請先接聽語音頻道',
      errorType: 'syntax',
    }
  }

  const targetChannels: VoiceChannel[] = [message.member.voice.channel]
  const missingChannelIds: string[] = []
  cache.settings[guildId]?.channels?.split(' ').forEach(channelId => {
    if (targetChannels.some(targetChannel => targetChannel.id === channelId)) {
      return
    }
    const targetChannel = message.guild?.channels.cache.get(channelId)
    if (targetChannel instanceof VoiceChannel) {
      targetChannels.push(targetChannel)
    } else {
      missingChannelIds.push(channelId)
    }
  })

  if (targetChannels.length === 0) {
    return {
      content: ':question: 找不到任何有效語音頻道，原本設定的語音頻道好像都被刪掉了？',
      errorType: 'syntax',
    }
  }

  const attendedMembers: GuildMember[] = []
  const displayNamesUpdates: { [MemberID: string]: string } = {}

  targetChannels.forEach(channel => {
    channel.members.forEach(member => {
      if (!member.user.bot) {
        attendedMembers.push(member)
      }
      if (cache.displayNames[guildId]?.[member.id] !== member.displayName) {
        displayNamesUpdates[member.id] = member.displayName
      }
    })
  })

  const date = moment(message.createdTimestamp).format('YYYYMMDD')
  await database.ref(`/records/${guildId}/${date}`).set(
    attendedMembers
      .map(member => member.id)
      .sort()
      .join(' '),
  )
  if (Object.keys(displayNamesUpdates).length) {
    cache.displayNames[guildId] = {
      ...(cache.displayNames[guildId] || {}),
      ...displayNamesUpdates,
    }
    await database.ref(`/displayNames/${guildId}`).update(displayNamesUpdates)
  }

  const guildRoles = await message.guild?.roles.fetch()
  const targetRoles: Role[] = []
  const missingRoleIds: string[] = []
  cache.settings[guildId]?.roles?.split(' ').forEach(roleId => {
    if (targetRoles.some(targetRole => targetRole.id === roleId)) {
      return
    }
    const targetRole = guildRoles?.cache.get(roleId)
    if (targetRole) {
      targetRoles.push(targetRole)
    } else {
      missingRoleIds.push(roleId)
    }
  })
  const isEveryone = targetRoles.length === 0
  const targetMembers = attendedMembers
    .filter(member => isEveryone || targetRoles.some(role => member.roles.cache.get(role.id)))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  const warnings: string[] = []
  if (missingChannelIds.length) {
    warnings.push(`:warning: 有 ${missingChannelIds.length} 個設定的語音頻道已被移除`)
  }
  if (missingRoleIds.length) {
    warnings.push(`:warning: 有 ${missingRoleIds.length} 個設定的點名對象身份組已被移除`)
  }
  if (attendedMembers.length - targetMembers.length) {
    warnings.push(`:warning: 有 ${attendedMembers.length - targetMembers.length} 位成員不在點名對象內`)
  }

  return {
    content: ':triangular_flag_on_post: **GUILD_NAME** `DATE` 出席 COUNT 人'
      .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
      .replace('DATE', date)
      .replace('COUNT', `${targetMembers.length}`),
    embed: {
      description: '點名日期：`DATE`\n點名頻道：CHANNELS\n點名對象：ROLES\n\nWARNINGS'
        .replace('DATE', date)
        .replace('CHANNELS', targetChannels.map(channel => Util.escapeMarkdown(channel.name)).join('、'))
        .replace('ROLES', isEveryone ? '所有人' : targetRoles.map(role => Util.escapeMarkdown(role.name)).join('、'))
        .replace('WARNINGS', warnings.join('\n'))
        .trim(),
      fields: targetMembers
        .reduce<string[][]>((accumulator, member, index) => {
          const page = Math.floor(index / 50)
          if (index % 50 === 0) {
            accumulator[page] = []
          }
          accumulator[page].push(
            cache.names[member.id] || cache.displayNames[guildId]?.[member.id] || member.displayName,
          )
          return accumulator
        }, [])
        .map((names, index) => ({
          name: index === 0 ? `出席成員 ${targetMembers.length} 人` : '.',
          value: names.map(name => Util.escapeMarkdown(name.slice(0, 16))).join('、'),
        })),
    },
  }
}

export default commandRecord
