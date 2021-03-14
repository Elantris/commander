import { CommandProps } from '../types'
import { cache } from '../utils/database'

const commandHelp: CommandProps = async ({ guildId }) => {
  const prefix = cache.settings[guildId]?.prefix || 'c!'

  return {
    content: ':triangular_flag_on_post: Commander點名機器人\n指令前綴：`PREFIX`\n說明文件：<MANUAL>\n邀請連結：DISCORD\n\n點名紀錄：`record`、`report`、`modify`\n基本設定：`name`、`settings`'
      .replace('PREFIX', prefix)
      .replace('MANUAL', 'https://hackmd.io/@eelayntris/commander')
      .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
  }
}

export default commandHelp
