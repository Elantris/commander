import { GuildMember, Message } from 'discord.js'
import cache from '../utils/cache'

const searchMembers: (message: Message, searches: string[]) => Promise<GuildMember[]> = async (message, searches) => {
  if (!message.guild) {
    return []
  }

  const members = await message.guild.members.fetch()
  return searches
    .map(search =>
      members.find(
        member =>
          search === member.id ||
          search === cache.names[member.id] ||
          search === member.displayName ||
          search === member.user.username ||
          search === member.user.tag ||
          search.includes(member.id),
      ),
    )
    .reduce<GuildMember[]>((accumulator, value) => (value ? [...accumulator, value] : accumulator), [])
}

export default searchMembers
