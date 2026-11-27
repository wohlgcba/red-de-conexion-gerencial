import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/format'
import { getNewsletterAuthor } from '../../utils/newsletterAuthor'
import { publicationTags } from '../../config/portal'
import type { Newsletter, Person } from '../../types'
import { NewsletterTags } from './NewsletterParts'

export function LatestNewsletters({ items, people }: { items: Newsletter[]; people: Person[] }) {
  return <section aria-labelledby="latest-newsletters-heading"><div className="newsletter-section-heading"><h2 id="latest-newsletters-heading">Últimas publicaciones</h2></div><div className="newsletter-latest-grid">{items.slice(0, 3).map(item => <Link key={item.id} className="newsletter-latest-card" to={`/portal/${item.id}`}><img src={item.image} alt="" loading="lazy" /><div><NewsletterTags tags={publicationTags(item)} /><h3>{item.title}</h3><p>{getNewsletterAuthor(item, people).name} · <time dateTime={item.date}>{formatDate(item.date)}</time></p></div></Link>)}</div></section>
}
