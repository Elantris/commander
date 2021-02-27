import admin, { ServiceAccount } from 'firebase-admin'
import config from '../config'

admin.initializeApp({
  credential: admin.credential.cert(config.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: config.FIREBASE.databaseURL,
})

const database = admin.database()
export const cache: {
  [key: string]: any
  bannedGuilds: {
    [GuildID: string]: unknown
  }
  names: {
    [UserID: string]: string
  }
  settings: {
    [GuildID: string]: {
      channels: string
      roles: string
      prefix: string
    }
  }
} = {
  bannedGuilds: {},
  names: {},
  settings: {},
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

database.ref('/bannedGuilds').on('child_added', updateCache)
database.ref('/bannedGuilds').on('child_changed', updateCache)
database.ref('/bannedGuilds').on('child_removed', removeCache)
database.ref('/names').on('child_added', updateCache)
database.ref('/names').on('child_changed', updateCache)
database.ref('/names').on('child_removed', removeCache)
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)

export default database
