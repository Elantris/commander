import { CommandProps } from '../types'
import getHint from '../utils/getHint'

const commandHint: CommandProps = async ({ args }) => {
  const key = args[1]

  return {
    content: ':bulb: Commander 提示',
    embed: {
      footer: { text: `💡 ${getHint(key)}` },
    },
  }
}

export default commandHint
