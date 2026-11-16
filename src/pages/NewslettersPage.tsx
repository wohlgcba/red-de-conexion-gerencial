import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, PencilLine, Search, SlidersHorizontal, UserRound } from 'lucide-react'
import { Button, FilterSelect, PageHeading, Surface } from '../components/common/UI'
import { FeaturedNewsletter, NewsletterCard } from '../components/newsletters/NewsletterParts'
import { useCatalog } from '../app/useCatalog'
import { norm } from '../utils/format'
import { getNewsletterAuthor } from '../utils/newsletterAuthor'
import { recordActivity } from '../services/metrics'
import { groupNewsletters, publishedByDate } from '../components/newsletters/catalogModel'
import { LatestNewsletters, NewsletterTopicCard } from '../components/newsletters/NewsletterTopicSections'
import { tematica, tematicaStyle } from '../config/tematicas'
import '../components/newsletters/newsletter-catalog.css'

export function NewslettersPage() {
  const { people, currentPersonId, isAdmin, items, user } = useCatalog()
  useEffect(() => { void recordActivity(user.id, 'newsletters') }, [user.id])
  const published = items.filter(item => item.status === 'publicado')
  const [params, setParams] = useSearchParams()
  const query = params.get('buscar') ?? ''
  const topic = params.get('tematica') ?? ''
  const organization = params.get('organismo') ?? ''
  const sort = params.get('orden') ?? 'newest'
  const listing = Boolean(query.trim() || topic || organization || sort !== 'newest' || params.get('vista') === 'todas')
  const groups = groupNewsletters(published, people)
  const newest = publishedByDate(published)
  const featured = newest.find(item => item.featured)
  const selectedGroup = groups.find(group => group.topic === topic)
  const selectedTheme = tematica(topic)
  const update = (field: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value) next.set(field, value); else next.delete(field)
    return next
  }, { replace: true })
  const [showFilters, setShowFilters] = useState(false)
  const topics = groups.map(group => group.topic).sort((a, b) => a.localeCompare(b, 'es-AR'))
  const organizations = [...new Set(published.map(item => getNewsletterAuthor(item, people).ministry))].filter(Boolean).sort()
  const results = published.filter(item => {
    const author = getNewsletterAuthor(item, people)
    return (!topic || (item.topic.trim() || 'Sin temática') === topic) && (!organization || author.ministry === organization) && (!query.trim() || norm([item.title, item.subtitle, item.topic, author.name, author.ministry, item.summary].join(' ')).includes(norm(query.trim())))
  }).sort((a, b) => sort === 'oldest' ? a.date.localeCompare(b.date) : sort === 'title' ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date))

  return <div className="page-stack newsletter-catalog">
    <Surface className="newsletter-catalog-intro">
      <PageHeading title="Newsletters de la Red" subtitle="Elegí una temática para ver las experiencias de otras áreas." actions={<>
        {(currentPersonId || isAdmin) && <>
          <Link className="btn btn-outline" to="/mis-newsletters"><UserRound size={21} /> Mis newsletters</Link>
          <Link className="btn btn-yellow" to="/newsletters/nuevo"><PencilLine size={19} /> Crear mi newsletter</Link>
        </>}
      </>} />
      <label className="search-input newsletter-catalog-search"><span className="sr-only">Buscar en todas las temáticas por título, autor u organismo</span><Search size={20} aria-hidden="true" /><input type="search" value={query} onChange={event => update('buscar', event.target.value)} placeholder="Buscar en todas las temáticas por título, autor u organismo…" /></label>
    </Surface>
    {!listing ? <>
      {featured && <FeaturedNewsletter item={featured} />}
      <section aria-labelledby="newsletter-topics-heading"><div className="newsletter-section-heading"><h2 id="newsletter-topics-heading">Temáticas</h2><span>{groups.length} {groups.length === 1 ? 'temática' : 'temáticas'} · {published.length} {published.length === 1 ? 'newsletter' : 'newsletters'}</span></div>
        {groups.length ? <div className="newsletter-topic-grid">{groups.map(group => <NewsletterTopicCard key={group.topic} group={group} />)}</div> : <Surface className="newsletter-catalog-empty"><BookOpen size={32} aria-hidden="true" /><h3>Todavía no hay newsletters publicados.</h3><p>Las temáticas aparecerán cuando se publique la primera experiencia.</p></Surface>}
      </section>
      {newest.length > 0 && <LatestNewsletters items={newest} people={people} />}
    </> : <>
      {topic ? <section className="newsletter-topic-heading" style={tematicaStyle(topic)} aria-labelledby="selected-topic-heading"><Link to="/newsletters"><ArrowLeft size={17} aria-hidden="true" /> Todas las temáticas</Link><h2 id="selected-topic-heading">{topic}</h2><p>{selectedTheme.description}</p><span>{selectedGroup?.items.length ?? 0} newsletters · {selectedGroup?.authors.length ?? 0} autores de {selectedGroup?.organisms ?? 0} organismos</span></section> : <div className="newsletter-section-heading"><h2>{query.trim() ? 'Resultados de búsqueda' : 'Todas las publicaciones'}</h2><Link to="/newsletters"><ArrowLeft size={17} aria-hidden="true" /> Todas las temáticas</Link></div>}
      <Surface className="newsletter-catalog-results">
        <div className="filters-bar">
          <button className="mobile-filter-toggle btn btn-outline" aria-expanded={showFilters} aria-controls="newsletter-catalog-filters" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} aria-hidden="true" /> Filtros</button>
          <div id="newsletter-catalog-filters" className={`filter-controls ${showFilters ? 'open' : ''}`}>
            <FilterSelect value={topic} onChange={event => update('tematica', event.target.value)} aria-label="Filtrar por temática"><option value="">Todas las temáticas</option>{topics.map(value => <option key={value}>{value}</option>)}</FilterSelect>
            <FilterSelect value={organization} onChange={event => update('organismo', event.target.value)} aria-label="Filtrar por ministerio"><option value="">Ministerio / Área rectora</option>{organizations.map(value => <option key={value}>{value}</option>)}</FilterSelect>
            <FilterSelect value={sort} onChange={event => update('orden', event.target.value === 'newest' ? '' : event.target.value)} aria-label="Ordenar newsletters"><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option><option value="title">Título A-Z</option></FilterSelect>
            <Button onClick={() => setParams({})}><SlidersHorizontal size={16} aria-hidden="true" /> Limpiar filtros</Button>
          </div>
        </div>
        <p className="newsletter-results-count" role="status">{results.length} {results.length === 1 ? 'publicación' : 'publicaciones'}</p>
        <div className="newsletter-grid">{results.map(item => <NewsletterCard key={item.id} item={item} />)}</div>
        {results.length === 0 && <div className="empty-results">{published.length === 0 ? 'Todavía no hay newsletters publicados.' : 'No encontramos newsletters con esos filtros.'}<Button onClick={() => setParams({})}>Ver todas las temáticas</Button></div>}
      </Surface>
    </>}
  </div>
}
