import { EmbedFieldData, Role, Util, VoiceChannel } from 'discord.js'
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

  if (!message.member?.voice.channel || message.member.voice.channel.type !== 'GUILD_VOICE') {
    return {
      content: ':x: 請先接聽語音頻道',
      errorType: 'syntax',
    }
  }

  // channels
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

  // roles
  const guildRoles = await message.guild?.roles.fetch()
  const targetRoles: Role[] = []
  const missingRoleIds: string[] = []
  cache.settings[guildId]?.roles?.split(' ').forEach(roleId => {
    if (targetRoles.some(targetRole => targetRole.id === roleId)) {
      return
    }
    const targetRole = guildRoles?.get(roleId)
    if (targetRole) {
      targetRoles.push(targetRole)
    } else {
      missingRoleIds.push(roleId)
    }
  })
  const isEveryone = targetRoles.length === 0

  // members
  const attendedMembers: {
    id: string
    name: string
    roleId?: string
  }[] = []
  const displayNamesUpdates: { [MemberID: string]: string } = {}
  targetChannels.forEach(channel => {
    channel.members.forEach(member => {
      if (!member.user.bot) {
        attendedMembers.push({
          id: member.id,
          name: Util.escapeMarkdown(cache.names[member.id] || member.displayName).slice(0, 16),
          roleId: isEveryone ? undefined : targetRoles.find(role => member.roles.cache.has(role.id))?.id,
        })
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

  const warnings: string[] = []
  if (missingChannelIds.length) {
    warnings.push(`:warning: 有 ${missingChannelIds.length} 個設定的語音頻道已被移除`)
  }
  if (missingRoleIds.length) {
    warnings.push(`:warning: 有 ${missingRoleIds.length} 個設定的點名對象身份組已被移除`)
  }

  const fields: EmbedFieldData[] = []
  if (isEveryone) {
    Util.splitMessage(
      attendedMembers
        .map(member => member.name)
        .sort()
        .join('\n'),
      { maxLength: 1024 },
    ).forEach((content, index) => {
      fields.push({
        name: index === 0 ? `所有人：${attendedMembers.length} 人` : '.',
        value: content.replace(/\n/g, '、'),
      })
    })
  } else {
    targetRoles.forEach(role => {
      const targetMembers = attendedMembers
        .filter(member => member.roleId === role.id)
        .map(member => member.name)
        .sort()
      if (targetMembers.length === 0) {
        return
      }
      Util.splitMessage(targetMembers.join('\n'), { maxLength: 1024 }).forEach((content, index) => {
        fields.push({
          name: index === 0 ? `${Util.escapeMarkdown(role.name)}：${targetMembers.length} 人` : '.',
          value: content.replace(/\n/g, '、'),
        })
      })
    })
  }

  return {
    content: ':triangular_flag_on_post: **GUILD_NAME** `DATE` 出席 COUNT 人'
      .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
      .replace('DATE', date)
      .replace('COUNT', `${attendedMembers.filter(member => isEveryone || !!member.roleId).length}`),
    embed: {
      description: '點名日期：`DATE`\n點名頻道：CHANNELS\n點名對象：ROLES\n\nWARNINGS'
        .replace('DATE', date)
        .replace('CHANNELS', targetChannels.map(channel => Util.escapeMarkdown(channel.name)).join('、'))
        .replace('ROLES', isEveryone ? '@everyone' : targetRoles.map(role => `<@&${role.id}>`).join(' '))
        .replace('WARNINGS', warnings.join('\n'))
        .trim(),
      fields,
    },
  }
}

export default commandRecord
