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

  // firebase
  const date = timeFormatter({ time: interaction.createdTimestamp, format: 'yyyyMMdd' })
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

  await database.ref(`/records/${guildId}/${date}`).set(
    attendedMembers
      .map(member => member.id)
      .sort()
      .join(' '),
  )

  // response
  const warnings: string[] = []
  if (missingChannelIds.length) {
    warnings.push(
      translate('record.warning.removedChannel', { guildId }).replace('{COUNT}', `${missingChannelIds.length}`),
    )
  }
  if (missingRoleIds.length) {
    warnings.push(translate('record.warning.removedRoles', { guildId }).replace('{COUNT}', `${missingRoleIds.length}`))
  }

  const fields: APIEmbedField[] = []
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

const command: CommandProps = {
  build,
  exec,
}

export default command
