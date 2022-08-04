import { APIEmbed, escapeMarkdown, Guild, SlashCommandBuilder } from 'discord.js'
import cache, { CommandProps, database, isLocaleType, LocaleType } from '../utils/cache'
import isAdmin from '../utils/isAdmin'
import notEmpty from '../utils/notEmpty'
import translate from '../utils/translate'

const build = new SlashCommandBuilder()
  .setName('config')
  .setDescription('修改 Commander 偏好設定')
  .setDescriptionLocalizations({
    'en-US': 'Edit the configurations of Commander.',
  })
  .addSubcommand(subcommand =>
    subcommand
      .setName('locale')
      .setDescription('變更機器人語言')
      .setDescriptionLocalizations({
        'en-US': 'Change bot language.',
      })
      .addStringOption(option =>
        option
          .setName('locale')
          .setDescription('語言環境')
          .setRequired(true)
          .setChoices({ name: 'zh-TW', value: 'zh-TW' }, { name: 'en-US', value: 'en-US' }),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('channels')
      .setDescription('編輯點名頻道')
      .setDescriptionLocalizations({
        'en-US': 'Edit target voice channels.',
      })
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('新增或移除')
          .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' })
          .setRequired(true),
      )
      .addChannelOption(option => option.setName('voice').setDescription('請選擇一個語音頻道').setRequired(true)),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('roles')
      .setDescription('編輯點名對象')
      .setDescriptionLocalizations({
        'en-US': 'Edit target roles.',
      })
      .addStringOption(option => option.setName('roles').setDescription('請標記身份組').setRequired(true)),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('admin')
      .setDescription('設定點名隊長')
      .setDescriptionLocalizations({
        'en-US': 'Make a role able to use commands.',
      })
      .addRoleOption(option => option.setName('role').setDescription('請選擇一個身份組').setRequired(true)),
  )
  .toJSON()

const getGuildConfigs: (
  guild: Guild,
  options?: {
    locale?: LocaleType
    channels?: string
    roles?: string
    admin?: string
  },
) => APIEmbed = (guild, options) => {
  const locale = options?.locale || cache.settings[guild.id]?.locale || 'zh-TW'
  const channels =
    (options?.channels || cache.settings[guild.id]?.channels)
      ?.split(' ')
      .filter(channelId => guild.channels.cache.get(channelId))
      .map(channelId => guild.channels.cache.get(channelId)?.name || '')
      .join('\n') || translate('config.text.defaultChannels', { locale })
  const roles =
    (options?.roles || cache.settings[guild.id]?.roles)
      ?.split(' ')
      .filter(roleId => guild.roles.cache.get(roleId))
      .map((roleId, index) => `\`${index + 1}.\` <@&${roleId}>`)
      .join('\n') || '@everyone'
  const admin =
    (options?.admin || guild.roles.cache.get(cache.settings[guild.id]?.admin || '')
      ? `<@&${cache.settings[guild.id]?.admin}>`
      : '') || translate('config.text.defaultAdmin', { locale })

  return {
    fields: [
      { name: 'Locale', value: locale },
      { name: 'Channels', value: channels },
      { name: 'Roles', value: roles },
      { name: 'Admin', value: admin },
    ],
  }
}

const exec: CommandProps['exec'] = async interaction => {
  const guild = interaction.guild
  const guildId = interaction.guildId
  const action = interaction.options.getString('action') === 'add' ? 'add' : 'remove'
  const locale = interaction.options.getString('locale')
  const channel = interaction.options.getChannel('voice')
  const roles = interaction.options.getString('roles')
  const admin = interaction.options.getRole('role')

  if (!guild || !guildId) {
    return
  }

  if (!isAdmin) {
    return {
      content: translate('system.error.adminOnly', { guildId }),
    }
  }

  if (locale) {
    if (!isLocaleType(locale)) {
      return {
        content: ':x: Locale not found.',
      }
    }

    await database.ref(`/settings/${guildId}/locale`).set(locale)
    cache.settings[guildId] = {
      ...cache.settings[guildId],
      locale,
    }
    return {
      content: translate('config.text.updateLocale', { locale }),
      embed: getGuildConfigs(guild, { locale }),
    }
  } else if (channel) {
    const targetChannel = guild.channels.cache.get(channel.id)
    if (!targetChannel?.isVoiceBased()) {
      return {
        content: translate('config.error.notVoiceChannel', { guildId }),
      }
    }

    const newChannelsMap: { [ChannelID: string]: number } = {}
    cache.settings[guildId]?.channels?.split(' ').forEach(channelId => {
      if (guild.channels.cache.get(channelId)) {
        newChannelsMap[channelId] = 1
      }
    })
    if (action === 'add') {
      newChannelsMap[targetChannel.id] = 1
    } else {
      delete newChannelsMap[targetChannel.id]
    }
    const newValue = Object.keys(newChannelsMap).sort().join(' ')
    await database.ref(`/settings/${guildId}/channels`).set(newValue)
    cache.settings[guildId] = {
      ...cache.settings[guildId],
      channels: newValue,
    }

    return {
      content: translate(action === 'add' ? 'config.text.addChannel' : 'config.text.removeChannel').replace(
        '{CHANNEL_NAME}',
        escapeMarkdown(targetChannel.name),
      ),
      embed: getGuildConfigs(guild, { channels: newValue }),
    }
  } else if (roles) {
    const isEveryone = /@everyone/.test(roles)
    const targetRoles =
      roles
        .match(/<@&\d+>/gm)
        ?.map(v => guild.roles.cache.get(v.slice(3, -1)))
        .filter(notEmpty) || []

    if (!isEveryone && !targetRoles.length) {
      return {
        content: translate('config.error.noMentionedRoles', { guildId }),
      }
    }

    const newValue = isEveryone ? '' : targetRoles.map(role => role.id).join(' ')

    if (isEveryone) {
      await database.ref(`/settings/${guildId}/roles`).set(null)
      delete cache.settings[guildId]?.roles
    } else {
      await database.ref(`/settings/${guildId}/roles`).set(newValue)
      cache.settings[guildId] = {
        ...cache.settings[guildId],
        roles: newValue,
      }
    }

    return {
      content: translate('config.text.updateRoles', { guildId }).replace(
        '{ROLE_NAMES}',
        targetRoles.map(role => escapeMarkdown(role.name)).join(' '),
      ),
      embed: getGuildConfigs(guild, { roles: newValue }),
    }
  } else if (admin) {
    const targetRole = guild.roles.cache.get(admin.id)
    if (!targetRole) {
      return {
        content: translate('config.error.invalidRole', { guildId }),
      }
    }

    await database.ref(`/settings/${guildId}/admin`).set(targetRole.id)
    cache.settings[guildId] = {
      ...cache.settings[guildId],
      admin: targetRole.id,
    }

    return {
      content: translate('config.text.updateAdmin', { guildId }).replace(
        '{ROLE_NAME}',
        escapeMarkdown(targetRole.name),
      ),
      embed: getGuildConfigs(guild, { admin: targetRole.id }),
    }
  }

  return
}

const command: CommandProps = {
  build,
  exec,
}

export default command
