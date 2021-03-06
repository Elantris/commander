import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache from '../utils/cache'

const commandHelp: CommandProps = async ({ guildId }) => {
  const prefix = cache.settings[guildId]?.prefix || 'c!'

  return {
    content: ':triangular_flag_on_post: Commander 點名機器人\n指令前綴：`PREFIX`\n說明文件：<MANUAL>\n邀請連結：DISCORD'
      .replace('PREFIX', Util.escapeMarkdown(prefix))
      .replace('MANUAL', 'https://hackmd.io/@eelayntris/commander')
      .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
  }
}

export default commandHelp
