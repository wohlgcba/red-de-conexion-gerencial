export type ReactionType = 'love' | 'like' | 'celebrate' | 'clap' | 'laugh' | 'wow' | 'sad' | 'think' | 'dislike'
export type ReactionCounts = Record<ReactionType, number>
export type NewsletterReactionSummary = { newsletterId: string; counts: ReactionCounts; mine: ReactionType | null }
export type NewsletterReactionEntry = NewsletterReactionSummary & { busy: boolean; error: string }
