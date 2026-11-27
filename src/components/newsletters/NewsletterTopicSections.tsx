import { Link } from 'react-router-dom'
import { formatDate } from '../../utils/format'
import { getNewsletterAuthor } from '../../utils/newsletterAuthor'
import { publicationTags } from '../../config/portal'
import type { PORTAL_SECTIONS } from '../../config/portal'
import { tematicaStyle } from '../../config/tematicas'
import { summarizePublicationAuthors } from './catalogModel'
import type { Newsletter, Person } from '../../types'
import { NewsletterTags } from './NewsletterParts'

export function PortalSectionCard({ section, items, people }: {
  section: (typeof PORTAL_SECTIONS)[number]; items: Newsletter[]; people: Person[]
}) {
  const { id, title, description, icon: Icon, visualTheme } = section
  const { authors, organisms } = summarizePublicationAuthors(items, people)
  const latest = items[0]?.date
  return <Link className="newsletter-topic-card" to={`/portal?seccion=${id}`} style={tematicaStyle(visualTheme)}>
    <div className="newsletter-topic-banner"><Icon aria-hidden="true" /><h3>{title}</h3></div>
    <div className="newsletter-topic-copy">
      <p className="newsletter-topic-description">{description}</p>
      {authors.length > 0 && <div className="newsletter-topic-authors">
        <div className="newsletter-topic-avatars" aria-hidden="true">
          {authors.slice(0, 3).map((author, index) => <span key={index}>{author.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span>)}
        </div>
        <span>{authors.length} {authors.length === 1 ? 'autor' : 'autores'} de {organisms} {organisms === 1 ? 'organismo' : 'organismos'}</span>
      </div>}
    </div>
    <div className="newsletter-topic-footer">
      <span><strong>{items.length}</strong> {items.length === 1 ? 'publicación' : 'publicaciones'}</span>
      {latest && <span>Última publicación: <time dateTime={latest}>{formatDate(latest)}</time></span>}
    </div>
  </Link>
}

export function LatestNewsletters({ items, people }: { items: Newsletter[]; people: Person[] }) {
  return <section aria-labelledby="latest-newsletters-heading"><div className="newsletter-section-heading"><h2 id="latest-newsletters-heading">Últimas publicaciones</h2></div><div className="newsletter-latest-grid">{items.slice(0, 3).map(item => <Link key={item.id} className="newsletter-latest-card" to={`/portal/${item.id}`}><img src={item.image} alt="" loading="lazy" /><div><NewsletterTags tags={publicationTags(item)} /><h3>{item.title}</h3><p>{getNewsletterAuthor(item, people).name} · <time dateTime={item.date}>{formatDate(item.date)}</time></p></div></Link>)}</div></section>
}
