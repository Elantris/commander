import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import handleMessage from './utils/handleMessage'
import { loggerHook } from './utils/hooks'

const client = new Client()

client.on('message', handleMessage)

client.on('ready', () => {
  client.user?.setActivity('Updated at 2021.03.01 | https://discord.gg/Ctwz4BB')
  loggerHook.send(
    '[`TIME`] USER_TAG is online!'
      .replace('TIME', moment().format('HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || ''),
  )
})

client.login(config.DISCORD.TOKEN)
