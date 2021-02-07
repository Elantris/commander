import { Message, MessageEmbedOptions } from "discord.js";

export type CommandProps = (options: {
  message: Message
  guildId: string
  args: string[]
}) => Promise<{
  content: string
  embed?: MessageEmbedOptions
  isSyntaxError?: boolean
}>
