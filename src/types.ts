import { Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (options: {
  message: Message
  guildId: string
  args: string[]
}) => Promise<CommandResultProps>

export type CommandResultProps = {
  content?: string
  embed?: MessageEmbedOptions
  isSyntaxError?: boolean
  error?: Error
}
