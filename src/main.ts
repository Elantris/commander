import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import handleMessage from './utils/handleMessage'
import { loggerHook } from './utils/hooks'

const client = new Client()

client.on('message', handleMessage)

client.on('ready', () => {
  loggerHook.send(
    '`TIME` USER_TAG'
      .replace('TIME', moment().format('YYYY-MM-DD HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || ''),
  )
  client.user?.setActivity('Version 2021.06.28 | https://discord.gg/Ctwz4BB')
})

client.login(config.DISCORD.TOKEN)
