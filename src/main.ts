import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import { loggerHook } from './utils/cache'
import handleMessage from './utils/handleMessage'

const client = new Client()

client.on('message', handleMessage)

client.on('ready', () => {
  loggerHook.send(
    '`TIME` USER_TAG'
      .replace('TIME', moment().format('YYYY-MM-DD HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || ''),
  )
})

client.setInterval(() => {
  client.user?.setActivity('Version 2021.08.03 | https://discord.gg/Ctwz4BB')
}, 60000)

client.login(config.DISCORD.TOKEN)
