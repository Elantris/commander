import { GuildMember, Message } from 'discord.js'

const searchMembers: (message: Message, searches: string[]) => Promise<GuildMember[]> = async (message, searches) => {
  const targetMembers: GuildMember[] = []

  for (const search of searches) {
    const targetMember =
      (/^\d+$/g.test(search) ? await message.guild?.members.fetch({ user: search }) : null) ||
      (await message.guild?.members.fetch({ query: search }))?.first()

    if (targetMember && !targetMember.user.bot) {
      targetMembers.push(targetMember)
    }
  }

  return targetMembers
}

export default searchMembers
