import { Client, Events, GatewayIntentBits } from 'discord.js'
import appConfig from './appConfig'
import { handleGuildCreate, handleGuildDelete } from './handleGuild'
import handleInteraction from './handleInteraction'
import handleReady from './handleReady'

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates],
})

client.on(Events.InteractionCreate, handleInteraction)
client.on(Events.ClientReady, handleReady)
client.on(Events.GuildCreate, handleGuildCreate)
client.on(Events.GuildDelete, handleGuildDelete)

client.login(appConfig.DISCORD.TOKEN)
