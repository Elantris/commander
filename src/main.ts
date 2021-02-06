import { Client, WebhookClient } from 'discord.js'
import moment from 'moment'
import config from '../config'

const startedAt = Date.now()
const loggerHook = new WebhookClient(...(config.DISCORD.LOGGER_HOOK as [string, string]))
const client = new Client()

client.on('ready', () => {
  const readyAt = Date.now()
  loggerHook.send(
    '[`TIME`] USER_TAG is online! (**PREPARING_TIME**ms)'
      .replace('TIME', moment(readyAt).format('HH:mm:ss'))
      .replace('USER_TAG', client.user?.tag || '')
      .replace('PREPARING_TIME', `${readyAt - startedAt}`),
  )
})
