import { WebhookClient } from 'discord.js'
import admin, { ServiceAccount } from 'firebase-admin'
import config from '../config'

admin.initializeApp({
  credential: admin.credential.cert(config.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: config.FIREBASE.databaseURL,
})

export const database = admin.database()
const cache: {
  [key: string]: any
  banned: {
    [GuildID in string]: any
  }
  names: {
    [UserID in string]?: string
  }
  settings: {
    [GuildID in string]?: {
      channels?: string
      roles?: string
      prefix?: string
      admins?: string
    }
  }
  displayNames: {
    [GuildID in string]?: {
      [MemberID in string]?: string
    }
  }
  hints: {
    [key in string]?: string
  }
  syntaxErrorsCounts: {
    [UserID in string]?: number
  }
  noAdminErrorsCounts: {
    [UserID in string]?: number
  }
} = {
  banned: {},
  displayNames: {},
  hints: {},
  names: {},
  settings: {},

  syntaxErrorsCounts: {},
  noAdminErrorsCounts: {},
}

const updateCache = (snapshot: admin.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key
  if (key && cache[key] && snapshot.key) {
    cache[key][snapshot.key] = snapshot.val()
  }
}
const removeCache = (snapshot: admin.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key
  if (key && cache[key] && snapshot.key) {
    delete cache[key][snapshot.key]
  }
}

database.ref('/banned').on('child_added', updateCache)
database.ref('/banned').on('child_changed', updateCache)
database.ref('/banned').on('child_removed', removeCache)
database.ref('/hints').on('child_added', updateCache)
database.ref('/hints').on('child_changed', updateCache)
database.ref('/hints').on('child_removed', removeCache)
database.ref('/names').on('child_added', updateCache)
database.ref('/names').on('child_changed', updateCache)
database.ref('/names').on('child_removed', removeCache)
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)

database
  .ref('/displayNames')
  .once('value')
  .then(snapshot => {
    cache.displayNames = snapshot.val() || {}
  })

export const loggerHook = new WebhookClient(...config.DISCORD.LOGGER_HOOK)

export const getHint: (key?: string) => string = key => {
  if (key && cache.hints[key]) {
    return cache.hints[key] || ''
  }

  const allHints = Object.values(cache.hints)
  const pick = Math.floor(Math.random() * allHints.length)
  const hint = allHints[pick] || ''

  return hint
}

export default cache
