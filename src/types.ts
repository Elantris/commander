import { Message, MessageEmbedOptions } from 'discord.js'

export type CommandProps = (options: {
  message: Message
  guildId: string
  args: string[]
}) => Promise<CommandResultProps>

export type CommandResultProps = {
  content?: string
  embed?: MessageEmbedOptions
  errorType?: 'syntax' | 'noAdmin' | 'system'
  error?: Error
}
