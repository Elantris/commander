import { Client } from 'discord.js'
import moment from 'moment'
import config from './config'
import handleMessage from './utils/handleMessage'
import { loggerHook } from './utils/hooks'

const startedAt = Date.now()
const client = new Client()

client.on('message', handleMessage)

client.on('ready', () => {
  const readyAt = Date.now()
  loggerHook.send(
    '[`TIME`] USER_TAG is online! (**PREPARING_TIME**ms)'
      .replace('TIME', moment(readyAt).format('HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || '')
      .replace('PREPARING_TIME', `${readyAt - startedAt}`),
  )
  client.user?.setActivity('Update at 2021.02.23')
})

client.login(config.DISCORD.TOKEN)
