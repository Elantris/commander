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
  names: {},
  settings: {},
  hints: {},
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
database.ref('/names').on('child_added', updateCache)
database.ref('/names').on('child_changed', updateCache)
database.ref('/names').on('child_removed', removeCache)
database.ref('/settings').on('child_added', updateCache)
database.ref('/settings').on('child_changed', updateCache)
database.ref('/settings').on('child_removed', removeCache)
database.ref('/hints').on('child_added', updateCache)
database.ref('/hints').on('child_changed', updateCache)
database.ref('/hints').on('child_removed', removeCache)

export default cache
