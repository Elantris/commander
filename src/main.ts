import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import { loggerHook } from './utils/cache'
import handleMessage from './utils/handleMessage'

const client = new Client({
  intents: (1 << 12) - 1 - (1 << 1) - (1 << 8),
})

client.on('messageCreate', handleMessage)

client.on('ready', () => {
  loggerHook.send(
    '`TIME` USER_TAG'
      .replace('TIME', moment().format('YYYY-MM-DD HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || ''),
  )

  setInterval(() => {
    try {
      client.user?.setActivity('Version 2021.11.01 | https://discord.gg/Ctwz4BB')
    } catch {}
  }, 60000)
})

client.login(config.DISCORD.TOKEN)
