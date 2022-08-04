import { ChannelType, Client, REST, Routes } from 'discord.js'
import appConfig from './appConfig'
import cache, { commandBuilds } from './utils/cache'
import timeFormatter from './utils/timeFormatter'

const handleReady = async (client: Client) => {
  const logChannel = client.channels.cache.get(appConfig.DISCORD.LOG_CHANNEL_ID)
  if (logChannel?.type !== ChannelType.GuildText) {
    console.error('Logger channel not found.')
    process.exit(-1)
  }
  cache.logChannel = logChannel

  // register commands
  const rest = new REST({ version: '10' }).setToken(appConfig.DISCORD.TOKEN)
  try {
    await rest.put(Routes.applicationCommands(appConfig.DISCORD.CLIENT_ID), { body: commandBuilds })
  } catch (error: any) {
    await logChannel.send(
      '`{TIME}` Register slash commands error\n```{ERROR}```'
        .replace('{TIME}', timeFormatter())
        .replace('{ERROR}', error),
    )
  }

  await logChannel.send(
    '`{TIME}` {USER_TAG}'.replace('{TIME}', timeFormatter()).replace('{USER_TAG}', client.user?.tag || ''),
  )

  setInterval(() => {
    try {
      client.user?.setActivity(`on ${client.guilds.cache.size} guilds.`)
    } catch {}
  }, 60000)
}

export default handleReady
