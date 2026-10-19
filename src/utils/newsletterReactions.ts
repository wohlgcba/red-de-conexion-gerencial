import type { NewsletterReactionSummary, ReactionCounts, ReactionType } from '../types/newsletterReactions'

export const REACTIONS = [
  { type: 'love', emoji: '💖', label: 'Me encanta' },
  { type: 'like', emoji: '👍', label: 'Me gusta' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebro' },
  { type: 'clap', emoji: '👏', label: 'Aplaudo' },
  { type: 'laugh', emoji: '😂', label: 'Me divierte' },
  { type: 'wow', emoji: '😮', label: 'Me sorprende' },
  { type: 'sad', emoji: '😢', label: 'Me entristece' },
  { type: 'think', emoji: '🤔', label: 'Me hace pensar' },
  { type: 'dislike', emoji: '👎', label: 'No me gusta' },
] as const satisfies ReadonlyArray<{ type: ReactionType; emoji: string; label: string }>

export const emptyReactionCounts = (): ReactionCounts => ({ love: 0, like: 0, celebrate: 0, clap: 0, laugh: 0, wow: 0, sad: 0, think: 0, dislike: 0 })
export const isReactionType = (value: unknown): value is ReactionType => REACTIONS.some(item => item.type === value)
export const reactionTotal = (counts: ReactionCounts) => REACTIONS.reduce((sum, item) => sum + counts[item.type], 0)

export function optimisticReaction(current: NewsletterReactionSummary, next: ReactionType | null): NewsletterReactionSummary {
  const counts = { ...current.counts }
  if (current.mine) counts[current.mine] = Math.max(0, counts[current.mine] - 1)
  if (next) counts[next]++
  return { ...current, counts, mine: next }
}
