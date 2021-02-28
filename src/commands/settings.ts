import { VoiceChannel } from 'discord.js'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const defaultSettings: { [key: string]: string } = {
  prefix: 'c!',
  channels: '（指令使用者所在頻道）',
  roles: '@everyone',
}

const commandSettings: CommandProps = async ({ message, guildId, args }) => {
  if (args.length === 1) {
    return {
      content: ':gear: 伺服器設定：',
      embed: {
        fields: [
          {
            name: '指令前綴 `prefix`',
            value: cache.settings[guildId]?.prefix || defaultSettings.prefix,
            inline: true,
          },
          {
            name: '點名頻道 `channels`',
            value: cache.settings[guildId]?.channels
              ? cache.settings[guildId].channels
                  .split(' ')
                  .map(channelId => message.guild?.channels.cache.get(channelId)?.name)
                  .filter(v => v)
                  .join('\n')
              : defaultSettings.channels,
            inline: true,
          },
          {
            name: '目標身份組 `roles`',
            value: cache.settings[guildId]?.roles
              ? cache.settings[guildId].roles
                  .split(' ')
                  .map(roleId => message.guild?.roles.cache.get(roleId)?.name)
                  .filter(v => v)
                  .join('\n')
              : defaultSettings.roles,
            inline: true,
          },
        ],
      },
    }
  }

  if (!message.member?.hasPermission('ADMINISTRATOR')) {
    return {
      content: ':x: 變更設定僅限「管理員」使用',
      isSyntaxError: true,
    }
  }

  const item = args[1]
  const value = args.slice(2)

  if (!defaultSettings[item]) {
    return {
      content: ':x: 設定語法：`c!settings 設定項目 設定值`，可以設定的項目：ITEMS'.replace(
        'ITEMS',
        Object.keys(defaultSettings)
          .map(key => `\`${key}\``)
          .join(' '),
      ),
    }
  }

  if (args.length === 2) {
    await database.ref(`/settings/${guildId}/${item}`).remove()
    return {
      content: `:gear: ${item} 已重設為預設值`,
    }
  }

  if (item === 'prefix') {
    const newPrefix = value[0]
    await database.ref(`/settings/${guildId}/prefix`).set(newPrefix)
    return {
      content: `:gear: 指令前綴已改為：${newPrefix}`,
    }
  }

  if (item === 'channels') {
    const targetChannels = value
      .map(search =>
        message.guild?.channels.cache
          .filter(channel => channel instanceof VoiceChannel)
          .find(channel => channel.id === search || channel.name === search),
      )
      .filter(v => v)
    if (targetChannels.length === 0) {
      return {
        content: ':x: 找不到語音頻道，或許是機器人沒有檢視語音頻道的權限？',
        isSyntaxError: true,
      }
    }

    await database.ref(`/settings/${guildId}/channels`).set(targetChannels.map(channel => channel?.id || '').join(' '))
    return {
      content: `:gear: 點名頻道已設定為：${targetChannels.map(channel => channel?.name || '').join('、')}`,
    }
  }

  if (item === 'roles') {
    const roles = await message.guild?.roles.fetch()
    const targetRoles = value
      .map(search => roles?.cache.find(role => role.id === search || role.name === search))
      .filter(v => v)
    if (targetRoles.length === 0) {
      return {
        content: ':x: 找不到身份組，請輸入正確的身份組名稱（不含空格、標記）',
        isSyntaxError: true,
      }
    }

    await database.ref(`/settings/${guildId}/roles`).set(targetRoles.map(role => role?.id || '').join(' '))
    return {
      content: `:gear: 目標身份組已設定為：${targetRoles.map(role => role?.name || '').join('、')}`,
    }
  }

  return {
    content: '',
  }
}

export default commandSettings
