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
          search === member.displayName.replace(/\s/g, '') ||
          search === member.user.username.replace(/\s/g, '') ||
          search === member.user.tag.replace(/\s/g, '') ||
          search.includes(member.id),
      ),
    )
    .reduce<GuildMember[]>((accumulator, value) => (value ? [...accumulator, value] : accumulator), [])
}

export default searchMembers
