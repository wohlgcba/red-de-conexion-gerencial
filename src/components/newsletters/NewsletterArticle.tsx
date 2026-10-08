import type { ReactNode } from 'react'
import { CalendarDays, Clock3 } from 'lucide-react'
import { Avatar } from '../common/Avatar'
import { Surface } from '../common/UI'
import { TopicChip } from './NewsletterParts'
import { longDate } from '../../utils/format'
import type { Newsletter } from '../../types'
import type { getNewsletterAuthor } from '../../utils/newsletterAuthor'

export function NewsletterArticle({ item, author, footer }: {
  item: Newsletter; author: ReturnType<typeof getNewsletterAuthor>; footer?: ReactNode
}) {
  return <div className="detail-main">
    <Surface className="article-header"><div className="article-header-copy"><TopicChip topic={item.topic} /><h1>{item.title}</h1><p>{item.subtitle}</p>
      <div className="article-byline"><Avatar name={author.name} photoUrl={author.photoUrl} size={42} /><span><strong>{author.name}</strong><small>{author.role} · {author.ministry}</small></span><i />
        <span><CalendarDays size={15} /> {longDate(item.date)}</span><i /><span><Clock3 size={15} /> {item.readingMinutes} min de lectura</span></div>
    </div><img className="article-cover" src={item.image} alt="Portada del newsletter" /></Surface>
    <Surface className="article-body">{item.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {item.quote && <blockquote>“{item.quote}”<cite>— {author.name}</cite></blockquote>}{footer}
    </Surface>
  </div>
}
