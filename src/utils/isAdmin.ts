import { Guild } from 'discord.js'
import cache from './cache'

const isAdmin: (guild: Guild, memberId: string) => boolean = (guild, memberId) => {
  const member = guild.members.cache.get(memberId)
  if (!member) {
    return false
  }

  if (member.permissions.has('Administrator')) {
    return true
  }

  const adminRoleId = cache.settings[member.guild.id]?.admin
  if (adminRoleId && member.roles.cache.get(adminRoleId)) {
    return true
  }

  return false
}

export default isAdmin
