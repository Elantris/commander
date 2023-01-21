import { ChannelType, ChatInputCommandInteraction, escapeMarkdown, Message } from 'discord.js'
import cache from './cache'

import timeFormatter from './timeFormatter'

const sendLog = async (command: ChatInputCommandInteraction, response: Message) => {
  await cache.logChannel?.send({
    content: '[`{TIME}`] `{COMMAND}`\n{RESPONSE}'
      .replace('{TIME}', timeFormatter({ time: command.createdTimestamp }))
      .replace('{COMMAND}', `${command}`)
      .replace('{RESPONSE}', response.content),
    embeds: [
      ...response.embeds,
      {
        fields: [
          {
            name: 'Guild',
            value: '{ID}\n{NAME}'
              .replace('{ID}', command.guildId || '--')
              .replace('{NAME}', escapeMarkdown(command.guild?.name || '--')),
            inline: true,
          },
          {
            name: 'Channel',
            value: '{ID}\n{NAME}'
              .replace('{ID}', command.guildId || '--')
              .replace(
                '{NAME}',
                command.channel?.isTextBased() && command.channel.type !== ChannelType.DM
                  ? escapeMarkdown(command.channel.name)
                  : '--',
              ),
            inline: true,
          },
          {
            name: 'User',
            value: '{ID}\n{NAME}'.replace('{ID}', command.user.id).replace('{NAME}', escapeMarkdown(command.user.tag)),
            inline: true,
          },
        ],
        footer: {
          text: `${response.createdTimestamp - command.createdTimestamp}ms`,
        },
        timestamp: command.createdAt.toISOString(),
      },
    ],
  })
}

export default sendLog
