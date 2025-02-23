import { ChannelType, Client } from 'discord.js'
import appConfig from './appConfig.js'
import { registerCommands } from './handleInteraction.js'
import cache from './helper/cache.js'
import timeFormatter from './utils/timeFormatter.js'

const handleReady = async (client: Client<true>) => {
  const logChannel = client.channels.cache.get(appConfig.DISCORD.LOG_CHANNEL_ID)
  if (logChannel?.type !== ChannelType.GuildText) {
    console.error('Logger channel not found.')
    process.exit(-1)
  }
  cache.logChannel = logChannel

  // register commands
  await registerCommands(client)

  await logChannel.send(`\`${timeFormatter()}\` ${client.user.tag}`)

  setInterval(() => {
    try {
      client.user.setActivity(`on ${client.guilds.cache.size} guilds.`)
    } catch {}
  }, 10000)

  cache.isReady = true
}

export default handleReady
