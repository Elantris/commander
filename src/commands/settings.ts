import { Role, Util, VoiceChannel } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'
import notEmpty from '../utils/notEmpty'

const defaultSettings: {
  [key: string]: string
} = {
  prefix: 'c!',
  channels: '指令使用者接聽的頻道',
  roles: '所有人',
  admins: '擁有管理權限的身份組',
}

const commandSettings: CommandProps = async ({ message, guildId, args }) => {
  if (args.length === 1) {
    return {
      content: ':gear: 伺服器設定：',
      embed: {
        fields: [
          {
            name: '指令前綴 `prefix`',
            value: Util.escapeMarkdown(cache.settings[guildId]?.prefix || defaultSettings.prefix),
          },
          {
            name: '點名頻道 `channels`',
            value:
              cache.settings[guildId]?.channels
                ?.split(' ')
                .map(channelId => message.guild?.channels.cache.get(channelId)?.name || `\`channelId\` (已移除)`)
                .join('\n') || defaultSettings.channels,
          },
          {
            name: '點名對象 `roles`',
            value:
              cache.settings[guildId]?.roles
                ?.split(' ')
                .map(roleId => `<@&${roleId}>`)
                .join('\n') || defaultSettings.roles,
          },
          {
            name: '點名隊長：`admins`',
            value:
              cache.settings[guildId]?.admins
                ?.split(' ')
                .map(roleId => `<@&${roleId}>`)
                .join('\n') || defaultSettings.admins,
          },
        ],
      },
    }
  }

  if (!isAdmin(message.member)) {
    return {
      content: ':lock: 變更設定僅限「管理員」使用',
      errorType: 'noAdmin',
    }
  }

  const settingKey = args[1]
  const settingValues = args.slice(2)

  if (!defaultSettings[settingKey]) {
    return {
      content: ':x: 沒有這個設定項目：`USER_INPUT`'.replace('USER_INPUT', settingKey),
      embed: {
        description: `可以設定的項目：\n${Object.keys(defaultSettings)
          .map(key => `\`c!settings ${key}\``)
          .join('\n')}`,
      },
      errorType: 'syntax',
    }
  }

  if (args.length === 2) {
    await database.ref(`/settings/${guildId}/${settingKey}`).remove()
    return {
      content: `:gear: ${settingKey} 已重設為預設值：${defaultSettings[settingKey]}`,
    }
  }

  if (settingKey === 'prefix') {
    const newPrefix = settingValues[0]
    await database.ref(`/settings/${guildId}/prefix`).set(newPrefix)
    return {
      content: `:gear: 指令前綴已改為：${Util.escapeMarkdown(newPrefix)}`,
    }
  }

  if (settingKey === 'channels') {
    const targetChannels: VoiceChannel[] = []
    const notFoundSearches: string[] = []

    settingValues.forEach(search => {
      const targetChannel = message.guild?.channels.cache
        .filter(channel => channel.type === 'GUILD_VOICE')
        .find(channel => channel.name === search || search.includes(channel.id))
      if (targetChannel instanceof VoiceChannel) {
        if (targetChannels.some(channel => channel.id === targetChannel.id)) {
          return
        }
        targetChannels.push(targetChannel)
      } else {
        notFoundSearches.push(search)
      }
    })

    if (targetChannels.length === 0) {
      return {
        content: ':x: 找不到任何語音頻道，請輸入完整頻道名稱或使用頻道 ID',
        embed: {
          fields: [
            {
              name: '無效搜尋',
              value: notFoundSearches
                .map((search, index) => `\`${index + 1}.\` ${Util.escapeMarkdown(search)}`)
                .join('\n'),
              inline: true,
            },
          ],
        },
        errorType: 'syntax',
      }
    }

    await database.ref(`/settings/${guildId}/channels`).set(targetChannels.map(channel => channel.id).join(' '))

    return {
      content: `:gear: 已成功設定 ${targetChannels.length} 個點名頻道`,
      embed: {
        fields: [
          {
            name: '點名頻道',
            value: targetChannels
              .map((channel, index) => `\`${index + 1}.\` ${Util.escapeMarkdown(channel.name)}`)
              .join('\n'),
            inline: true,
          },
          notFoundSearches.length
            ? {
                name: '無效搜尋',
                value: notFoundSearches
                  .map((search, index) => `\`${index + 1}.\` ${Util.escapeMarkdown(search)}`)
                  .join('\n'),
                inline: true,
              }
            : undefined,
        ].filter(notEmpty),
      },
    }
  }

  if (settingKey === 'roles' || settingKey === 'admins') {
    const guildRoles = await message.guild?.roles.fetch()
    const targetRoles: Role[] = []
    const notFoundSearches: string[] = []

    settingValues.forEach(search => {
      const targetRole = guildRoles?.find(role => role.name === search || search.includes(role.id))
      if (targetRole) {
        if (targetRoles.some(role => role.id === targetRole.id)) {
          return
        }
        targetRoles.push(targetRole)
      } else {
        notFoundSearches.push(search)
      }
    })

    if (targetRoles.length === 0) {
      return {
        content: ':x: 找不到身份組，請輸入正確的身份組名稱（不含空格）或輸入身份組 ID',
        embed: {
          fields: [
            {
              name: '無效搜尋',
              value: notFoundSearches
                .map((search, index) => `\`${index + 1}.\` ${Util.escapeMarkdown(search)}`)
                .join('\n'),
              inline: true,
            },
          ],
        },
        errorType: 'syntax',
      }
    }

    await database.ref(`/settings/${guildId}/${settingKey}`).set(targetRoles.map(role => role.id).join(' '))

    return {
      content: `:gear: 已成功設定 ${targetRoles.length} 個身份組`,
      embed: {
        fields: [
          {
            name: settingKey === 'roles' ? '點名對象' : settingKey === 'admins' ? '點名隊長' : settingKey,
            value: targetRoles.map((role, index) => `\`${index + 1}.\` ${Util.escapeMarkdown(role.name)}`).join('\n'),
            inline: true,
          },
          notFoundSearches.length
            ? {
                name: '無效搜尋',
                value: notFoundSearches
                  .map((search, index) => `\`${index + 1}.\` ${Util.escapeMarkdown(search)}`)
                  .join('\n'),
                inline: true,
              }
            : undefined,
        ].filter(notEmpty),
      },
    }
  }

  return {}
}

export default commandSettings
