import { APIEmbedField, escapeMarkdown, SlashCommandBuilder } from 'discord.js'
import cache, { CommandProps, database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'
import splitMessage from '../utils/splitMessage'
import timeFormatter from '../utils/timeFormatter'
import translate from '../utils/translate'

const build = new SlashCommandBuilder()
  .setName('record')
  .setDescription('紀錄當前接聽語音頻道的成員')
  .setDescriptionLocalizations({
    'en-US': 'Record all members in voice channels.',
  })
  .toJSON()

const exec: CommandProps['exec'] = async interaction => {
  const guildId = interaction.guildId
  const guild = interaction.guild

  if (!guildId || !guild) {
    return
  }

  if (!isAdmin(guild, interaction.user.id)) {
    return {
      content: translate('system.error.adminOnly', { guildId }),
    }
  }

  // members
  const voiceChannels: {
    id: string
    name: string
    members: {
      id: string
      name: string
      roleIds: string[]
    }[]
  }[] = []
  let memberCurrentChannelId = ''

  guild.channels.cache.forEach(channel => {
    if (!channel.isVoiceBased() || channel.members.size === 0) {
      return
    }
    voiceChannels.push({
      id: channel.id,
      name: channel.name,
      members: channel.members.map(member => {
        if (member.id === interaction.user.id) {
          memberCurrentChannelId = channel.id
        }
        return {
          id: member.id,
          name: member.displayName,
          roleIds: member.roles.cache.map(role => role.id),
        }
      }),
    })
  })

  if (!memberCurrentChannelId) {
    return {
      content: translate('record.error.notInVoiceChannel', { guildId }),
    }
  }

  // channels
  const targetChannelIds: string[] = [memberCurrentChannelId]
  const missingChannelIds: string[] = []

  cache.settings[guildId]?.channels?.split(' ').forEach(channelId => {
    if (!channelId || targetChannelIds.includes(channelId)) {
      return
    }
    if (guild.channels.cache.get(channelId)?.isVoiceBased()) {
      targetChannelIds.push(channelId)
    } else {
      missingChannelIds.push(channelId)
    }
  })

  // roles
  const targetRoleIds: string[] = []
  const missingRoleIds: string[] = []

  cache.settings[guildId]?.roles?.split(' ').forEach(roleId => {
    if (!roleId || targetRoleIds.includes(roleId)) {
      return
    }
    if (guild.roles.cache.get(roleId)) {
      targetRoleIds.push(roleId)
    } else {
      missingRoleIds.push(roleId)
    }
  })
  const isEveryone = targetRoleIds.length === 0

  // members
  const attendedMembers: {
    id: string
    name: string
    roleId?: string
  }[] = []

  voiceChannels.forEach(channel => {
    if (!targetChannelIds.includes(channel.id)) {
      return
    }
    channel.members.forEach(member => {
      const roleId = targetRoleIds.find(roleId => member.roleIds.includes(roleId))
      attendedMembers.push({
        id: member.id,
        name: member.name,
        roleId,
      })
    })
  })

  // firebase
  const date = timeFormatter({ time: interaction.createdTimestamp, format: 'yyyyMMdd' })
  if (!cache.records[guildId]) {
    cache.records[guildId] = {}
  }
  if (!cache.records[guildId]?.[date]) {
    cache.records[guildId][date] = (await database.ref(`/records/${guildId}/${date}`).once('value')).val()
  }
  const isDuplicated = !!cache.records[guildId][date]

  const joinedMembers = cache.records[guildId][date]
    ? attendedMembers.filter(member => !cache.records[guildId][date].includes(member.id))
    : []
  const leavedMemberIds = cache.records[guildId][date]
    ? cache.records[guildId][date]
        .split(' ')
        .filter(memberId => !attendedMembers.find(member => member.id === memberId))
    : []

  const newValue = attendedMembers
    .map(member => member.id)
    .sort()
    .join(' ')
  cache.records[guildId][date] = newValue
  await database.ref(`/records/${guildId}/${date}`).set(newValue)

  // response
  const warnings: string[] = []
  if (isDuplicated) {
    warnings.push(translate('record.warning.overwriteRecord'))
  }
  if (missingChannelIds.length) {
    warnings.push(
      translate('record.warning.removedChannel', { guildId }).replace('{COUNT}', `${missingChannelIds.length}`),
    )
    let newValue = cache.settings[guildId]?.channels || ''
    missingChannelIds.forEach(channelId => (newValue = newValue.replace(channelId, '')))
    await database.ref(`/settings/${guildId}/channels`).set(newValue)
    cache.settings[guildId] = {
      ...cache.settings[guildId],
      channels: newValue,
    }
  }
  if (missingRoleIds.length) {
    warnings.push(translate('record.warning.removedRoles', { guildId }).replace('{COUNT}', `${missingRoleIds.length}`))
    let newValue = cache.settings[guildId]?.roles || ''
    missingRoleIds.forEach(roleId => (newValue = newValue.replace(roleId, '')))
    await database.ref(`/settings/${guildId}/roles`).set(newValue)
    cache.settings[guildId] = {
      ...cache.settings[guildId],
      roles: newValue,
    }
  }

  const fields: APIEmbedField[] = []
  if (joinedMembers.length) {
    fields.push({
      name: `${translate('record.text.joinedMembers')} (${joinedMembers.length})`,
      value: joinedMembers.map(member => escapeMarkdown(member.name.slice(0, 16))).join('、'),
    })
  }
  if (leavedMemberIds.length) {
    fields.push({
      name: `${translate('record.text.leavedMembers')} (${leavedMemberIds.length})`,
      value: leavedMemberIds
        .map(memberId => {
          const member = guild.members.cache.get(memberId)
          return member ? escapeMarkdown(member.displayName.slice(0, 16)) : `<@!${memberId}>`
        })
        .join('、'),
    })
  }
  if (isEveryone) {
    splitMessage(
      attendedMembers
        .map(member => escapeMarkdown(member.name.slice(0, 16)))
        .sort()
        .join('\n'),
      { length: 1000 },
    ).forEach((content, index) => {
      fields.push({
        name: index === 0 ? `@everyone (${attendedMembers.length})` : '.',
        value: content.replace(/\n/g, '、'),
      })
    })
  } else {
    targetRoleIds.forEach(targetRoleId => {
      const targetMembers = attendedMembers
        .filter(member => member.roleId === targetRoleId)
        .map(member => escapeMarkdown(member.name.slice(0, 16)))
        .sort()
      if (targetMembers.length === 0) {
        return
      }
      splitMessage(targetMembers.join('\n'), { length: 1000 }).forEach((content, index) => {
        fields.push({
          name:
            index === 0
              ? `${escapeMarkdown(guild.roles.cache.get(targetRoleId)?.name || '')} (${targetMembers.length})`
              : '.',
          value: content.replace(/\n/g, '、'),
        })
      })
    })
  }

  return {
    content: translate('record.text.result', { guildId })
      .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
      .replace('{DATE}', date)
      .replace(
        '{COUNT}',
        `${isEveryone ? attendedMembers.length : attendedMembers.filter(member => member.roleId).length}`,
      ),
    embed: {
      description: translate('record.text.resultDescription', { guildId })
        .replace('{DATE}', date)
        .replace(
          '{CHANNELS}',
          targetChannelIds.map(channelId => escapeMarkdown(guild.channels.cache.get(channelId)?.name || '')).join('、'),
        )
        .replace('{ROLES}', isEveryone ? '@everyone' : targetRoleIds.map(roleId => `<@&${roleId}>`).join(' '))
        .replace('{WARNINGS}', warnings.join('\n'))
        .trim(),
      fields,
    },
  }
}

export default {
  build,
  exec,
}
