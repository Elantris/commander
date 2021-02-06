import { VoiceChannel } from 'discord.js'
import database, { cache } from '../utils/database'
import { CommandProps } from '../utils/types'

const defaultSettings: { [key: string]: string } = {
  prefix: 'c!',
  channels: '（指令使用者所在頻道）',
  roles: '@everyone',
}

const settings: CommandProps = async ({ message, guildId, args }) => {
  if (args.length === 0) {
    return {
      content: ':triangular_flag_on_post: 當前伺服器設定：',
      embed: {
        description: '',
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
                  .map(channelId => message.guild?.channels.cache.get(channelId)?.name || '')
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
                  .map(roleId => message.guild?.roles.cache.get(roleId) || '')
                  .filter(v => v)
                  .join('\n')
              : defaultSettings.roles,
            inline: true,
          },
        ],
      },
    }
  }

  if (!defaultSettings[args[0]]) {
    return {
      content: ':x: 設定項目錯誤，正確語法：`c!settings 指定項目 設定值`',
      isSyntaxError: true,
    }
  }

  if (!args[1]) {
    await database.ref(`/settings/${guildId}/${args[0]}`).remove()
    return {
      content: `:triangular_flag_on_post: ${args[0]} 重設為預設值`,
    }
  }

  if (args[0] === 'prefix') {
    await database.ref(`/settings/${guildId}/prefix`).set(args[1])
    return {
      content: `:triangular_flag_on_post: 指令前綴已改為：${args[1]}`,
    }
  }

  if (args[0] === 'channels') {
    const targetChannels = args
      .slice(1)
      .map(search =>
        message.guild?.channels.cache
          .filter(channel => channel instanceof VoiceChannel)
          .find(channel => channel.id === search || channel.name === search),
      )
      .filter(v => v)
    if (targetChannels.length === 0) {
      return {
        content: ':x: 找不到語音頻道',
        isSyntaxError: true,
      }
    }

    await database.ref(`/settings/${guildId}/channels`).set(targetChannels.map(channel => channel?.id || '').join(' '))
    return {
      content: `:triangular_flag_on_post: 點名頻道已設定為：${targetChannels
        .map(channel => channel?.name || '')
        .join('、')}`,
    }
  }

  if (args[0] === 'roles') {
    const roles = await message.guild?.roles.fetch()
    const targetRoles = args
      .slice(1)
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
      content: `:triangular_flag_on_post: 目標身份組已設定為：${targetRoles.map(role => role?.name || '').join('、')}`,
    }
  }

  return {
    content: `:x: 可以設定的項目：${Object.keys(defaultSettings)
      .map(key => `\`${key}\``)
      .join(' ')}`,
  }
}

export default settings
