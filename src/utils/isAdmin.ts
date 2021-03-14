import { GuildMember } from 'discord.js'
import { cache } from './database'

const isAdmin = (member: GuildMember | null | undefined) => {
  if (!member) {
    return false
  }

  if (member.hasPermission('ADMINISTRATOR')) {
    return true
  }

  const adminRoles = cache.settings[member.guild.id]?.admins
  if (adminRoles) {
    return member.roles.cache.some(role => adminRoles.includes(role.id))
  }

  return false
}

export default isAdmin
