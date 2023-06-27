import { SlashCommandBuilder } from 'discord.js'
import { CommandProps } from '../utils/cache'
import translate from '../utils/translate'

const build: CommandProps['build'] = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Manuals of Commander.')
  .setDescriptionLocalizations({
    'zh-TW': 'Commander 使用說明',
  })
  .toJSON()

const exec: CommandProps['exec'] = async interaction => {
  const { guildId } = interaction
  if (!guildId) {
    return
  }

  return {
    content: translate('help.text.summary', { guildId })
      .replace('{MANUAL}', 'https://hackmd.io/@eelayntris/commander')
      .replace('{DISCORD}', 'https://discord.gg/Ctwz4BB'),
      isFinished: true,
  }
}

const command: CommandProps = {
  build,
  exec,
}

export default command
