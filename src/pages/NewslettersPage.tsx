import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, PencilLine, SlidersHorizontal, UserRound } from 'lucide-react'
import { Button, FilterSelect, PageHeading, SearchInput, Surface } from '../components/common/UI'
import { FeaturedNewsletter, NewsletterCard, NewsletterDetailPanel } from '../components/newsletters/NewsletterParts'
import { useNewsletters } from '../app/useNewsletters'
import { getPerson } from '../services/catalog'
import { norm } from '../utils/format'

export function NewslettersPage() {
  const { items } = useNewsletters()
  const published = items.filter(item => item.status === 'publicado')
  const featured = published.find(item => item.featured) ?? published[0]
  const [selectedId, setSelectedId] = useState<string | null>(featured?.id ?? null)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [organization, setOrganization] = useState('')
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const topics = [...new Set(published.map(item => item.topic))].sort()
  const organizations = [...new Set(published.map(item => getPerson(item.authorId)?.ministry ?? ''))].filter(Boolean).sort()
  const results = published.filter(item => {
    const author = getPerson(item.authorId)
    return (!topic || item.topic === topic) && (!organization || author?.ministry === organization) && (!query || norm([item.title, item.subtitle, item.topic, author?.name, author?.ministry, item.summary].join(' ')).includes(norm(query)))
  }).sort((a, b) => sort === 'oldest' ? a.date.localeCompare(b.date) : sort === 'title' ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date))
  const selected = published.find(item => item.id === selectedId)

  return <div className="page-stack"><Surface className="newsletter-intro"><PageHeading title="Newsletters de la Red" subtitle="Conocé proyectos, experiencias y novedades compartidas por integrantes de la Red Gerencial." actions={<><div className="count-box"><Archive size={26} /><strong>{published.length} newsletters<br />publicados</strong></div><Link className="btn btn-outline" to="/mis-newsletters"><UserRound size={21} /> Mis newsletters</Link><Link className="btn btn-yellow" to="/newsletters/nuevo"><PencilLine size={19} /> Crear mi newsletter</Link></>} />{featured && <FeaturedNewsletter item={featured} />}</Surface><div className={`content-with-aside ${selected ? '' : 'without-aside'}`}><Surface className="catalog-surface"><div className="filters-bar"><SearchInput value={query} onChange={setQuery} placeholder="Buscar por título, temática, autor, organismo o contenido..." /><button className="mobile-filter-toggle btn btn-outline" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} /> Filtros</button><div className={`filter-controls ${showFilters ? 'open' : ''}`}><FilterSelect value={topic} onChange={event => setTopic(event.target.value)} aria-label="Filtrar por temática"><option value="">Temática</option>{topics.map(value => <option key={value}>{value}</option>)}</FilterSelect><FilterSelect value={organization} onChange={event => setOrganization(event.target.value)} aria-label="Filtrar por ministerio"><option value="">Ministerio / Área rectora</option>{organizations.map(value => <option key={value}>{value}</option>)}</FilterSelect><FilterSelect value={sort} onChange={event => setSort(event.target.value)} aria-label="Ordenar newsletters"><option value="newest">Ordenar por</option><option value="oldest">Más antiguos</option><option value="title">Título A-Z</option></FilterSelect><Button onClick={() => { setQuery(''); setTopic(''); setOrganization(''); setSort('newest') }}><SlidersHorizontal size={16} /> Limpiar filtros</Button></div></div><div className="newsletter-grid">{results.map(item => <NewsletterCard key={item.id} item={item} onSelect={setSelectedId} />)}</div>{results.length === 0 && <div className="empty-results">No encontramos newsletters con esos filtros.</div>}</Surface><NewsletterDetailPanel item={selected} onClose={() => setSelectedId(null)} /></div></div>
}
