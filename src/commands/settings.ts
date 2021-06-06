import { Role, Util, VoiceChannel } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'

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
                .map(channelId => message.guild?.channels.cache.get(channelId)?.name)
                .reduce<string[]>(
                  (accumulator, value) => (value ? [...accumulator, Util.escapeMarkdown(value)] : accumulator),
                  [],
                )
                .join('\n') || defaultSettings.channels,
          },
          {
            name: '點名對象 `roles`',
            value:
              cache.settings[guildId]?.roles
                ?.split(' ')
                .map(roleId => message.guild?.roles.cache.get(roleId)?.name)
                .reduce<string[]>(
                  (accumulator, value) => (value ? [...accumulator, Util.escapeMarkdown(value)] : accumulator),
                  [],
                )
                .join('\n') || defaultSettings.roles,
          },
          {
            name: '點名隊長：`admins`',
            value:
              cache.settings[guildId]?.admins
                ?.split(' ')
                .map(roleId => message.guild?.roles.cache.get(roleId)?.name)
                .reduce<string[]>(
                  (accumulator, value) => (value ? [...accumulator, Util.escapeMarkdown(value)] : accumulator),
                  [],
                )
                .join('\n') || defaultSettings.admins,
          },
        ],
      },
    }
  }

  if (!isAdmin(message.member)) {
    return {
      content: ':lock: 變更設定僅限「管理員」使用',
      isSyntaxError: true,
    }
  }

  const settingKey = args[1]
  const settingValues = args.slice(2)

  if (!defaultSettings[settingKey]) {
    return {
      content: ':x: 設定語法：`c!settings 設定項目 設定值`，可以設定的項目：SETTING_KEYS'.replace(
        'SETTING_KEYS',
        Object.keys(defaultSettings)
          .map(key => `\`${key}\``)
          .join(' '),
      ),
      isSyntaxError: true,
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
    const targetChannels = settingValues
      .map(search =>
        message.guild?.channels.cache
          .filter(channel => channel instanceof VoiceChannel)
          .find(channel => channel.id === search || channel.name === search),
      )
      .reduce<VoiceChannel[]>(
        (accumulator, channel) => (channel instanceof VoiceChannel ? [...accumulator, channel] : accumulator),
        [],
      )
    if (targetChannels.length === 0) {
      return {
        content: ':x: 找不到語音頻道，或許是頻道名稱怪怪的，可以嘗試換成頻道 ID',
      }
    }

    await database.ref(`/settings/${guildId}/channels`).set(targetChannels.map(channel => channel.id).join(' '))
    return {
      content: `:gear: 點名頻道已設定為：${targetChannels
        .map(channel => Util.escapeMarkdown(channel.name))
        .join('、')}`,
    }
  }

  if (settingKey === 'roles' || settingKey === 'admins') {
    const roles = await message.guild?.roles.fetch()
    const targetRoles = settingValues
      .map(search => roles?.cache.find(role => role.id === search || role.name === search || search.includes(role.id)))
      .reduce<Role[]>((accumulator, role) => (role ? [...accumulator, role] : accumulator), [])

    if (targetRoles.length === 0) {
      return {
        content: ':x: 找不到身份組，請輸入正確的身份組名稱（不含空格）',
        isSyntaxError: true,
      }
    }

    await database.ref(`/settings/${guildId}/${settingKey}`).set(targetRoles.map(role => role.id).join(' '))
    return {
      content: `:gear: SETTING_KEY 已設定為：ROLES`
        .replace('SETTING_KEY', settingKey === 'roles' ? '點名對象' : settingKey === 'admins' ? '點名隊長' : settingKey)
        .replace('ROLES', targetRoles.map(role => Util.escapeMarkdown(role.name)).join('、')),
    }
  }

  return {}
}

export default commandSettings
