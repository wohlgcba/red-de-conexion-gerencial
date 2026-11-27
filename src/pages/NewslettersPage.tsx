import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, PencilLine, Search, UserRound } from 'lucide-react'
import { FilterSelect, PageHeading, Surface } from '../components/common/UI'
import { FeaturedNewsletter, NewsletterCard } from '../components/newsletters/NewsletterParts'
import { LatestNewsletters } from '../components/newsletters/NewsletterTopicSections'
import { publishedByDate } from '../components/newsletters/catalogModel'
import { useCatalog } from '../app/useCatalog'
import { norm } from '../utils/format'
import { getNewsletterAuthor } from '../utils/newsletterAuthor'
import { recordActivity } from '../services/metrics'
import { COMMUNITY_SECTION, PORTAL_SECTIONS, PORTAL_TOPICS, portalTopic } from '../config/portal'
import '../components/newsletters/newsletter-catalog.css'
import './portal.css'

export function NewslettersPage() {
  const { people, currentPersonId, isAdmin, portalReady, items, user } = useCatalog()
  useEffect(() => { void recordActivity(user.id, 'newsletters') }, [user.id])
  const [params, setParams] = useSearchParams()
  const query = params.get('buscar') ?? ''
  const selectedTopic = params.has('tematica') ? portalTopic(params.get('tematica') ?? '') : ''
  const section = PORTAL_SECTIONS.find(entry => entry.id === params.get('seccion'))
  const theme = PORTAL_TOPICS.find(entry => entry.title === selectedTopic)
  const organization = params.get('organismo') ?? ''
  const sort = params.get('orden') ?? ''
  const published = publishedByDate(items)
  const featured = published.find(item => item.featured)
  const listing = Boolean(section || selectedTopic || query.trim() || organization || sort || params.get('vista') === 'todas')
  const publishSection = isAdmin && portalReady ? section?.id ?? 'conocimiento-en-red' : COMMUNITY_SECTION
  const canPublish = isAdmin && portalReady || Boolean((isAdmin || currentPersonId) && (!section || section.id === COMMUNITY_SECTION))
  const topics = [...new Set([...PORTAL_TOPICS.map(entry => entry.title), ...published.map(item => portalTopic(item.topic))])]
  const organizations = [...new Set(published.map(item => getNewsletterAuthor(item, people).ministry))].filter(Boolean).sort()
  const results = published.filter(item => {
    const author = getNewsletterAuthor(item, people)
    return (!section || (item.section ?? COMMUNITY_SECTION) === section.id)
      && (!selectedTopic || portalTopic(item.topic) === selectedTopic) && (!organization || author.ministry === organization)
      && (!query.trim() || norm([item.title, item.subtitle, item.topic, author.name, author.ministry, item.summary].join(' ')).includes(norm(query.trim())))
  })
  if (sort === 'oldest') results.sort((a, b) => a.date.localeCompare(b.date))
  if (sort === 'title') results.sort((a, b) => a.title.localeCompare(b.title, 'es-AR'))

  const update = (field: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value) next.set(field, value)
    else next.delete(field)
    return next
  }, { replace: true })

  return <div className="page-stack newsletter-catalog">
    <Surface className="newsletter-catalog-intro">
      <PageHeading title="Portal" actions={<>
        {(currentPersonId || isAdmin) && <Link className="btn btn-outline" to="/mis-publicaciones"><UserRound size={20} /> Mis publicaciones</Link>}
        {canPublish && <Link className="btn btn-yellow" to={`/portal/nuevo?seccion=${publishSection}`}><PencilLine size={19} /> {isAdmin ? 'Nueva publicación' : 'Compartí con la Red'}</Link>}
      </>} />
      <label className="search-input newsletter-catalog-search"><span className="sr-only">Buscar publicaciones</span><Search size={20} aria-hidden="true" /><input type="search" value={query} onChange={event => update('buscar', event.target.value)} placeholder="Buscar por título, temática, autor u organismo…" /></label>
    </Surface>
    {!listing ? <>
      <section aria-labelledby="portal-sections"><div className="newsletter-section-heading"><h2 id="portal-sections">Secciones del Portal</h2></div>
        <div className="portal-grid">{PORTAL_SECTIONS.map(({ id, title, description, icon: Icon }) => <Link className="surface portal-card" to={`/portal?seccion=${id}`} key={id}>
          <Icon size={24} aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p></div><ArrowRight className="portal-card-arrow" size={18} aria-hidden="true" />
        </Link>)}</div>
      </section>
      <section aria-labelledby="portal-topics"><div className="newsletter-section-heading"><h2 id="portal-topics">Ejes temáticos</h2><Link to="/portal?vista=todas">Ver todas las publicaciones <ArrowRight size={16} /></Link></div>
        <div className="portal-grid">{PORTAL_TOPICS.map(({ title, description, icon: Icon }) => <Link className="surface portal-card portal-topic" to={`/portal?${new URLSearchParams({ tematica: title })}`} key={title}>
          <Icon size={23} aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p></div><ArrowRight className="portal-card-arrow" size={18} aria-hidden="true" />
        </Link>)}</div>
      </section>
      {featured && <FeaturedNewsletter item={featured} />}
      {published.length > 0 && <LatestNewsletters items={published} people={people} />}
    </> : <>
      <Surface className="portal-listing-heading">
        <Link to="/portal"><ArrowLeft size={17} aria-hidden="true" /> Volver al Portal</Link>
        <h2>{section?.title ?? (selectedTopic || (query.trim() ? 'Resultados de búsqueda' : 'Todas las publicaciones'))}</h2>
        {section && <p>{section.description}</p>}
        {theme && <>
          {section && <h3>{theme.title}</h3>}
          <p>{theme.description}</p><p>{theme.content}</p>
          {!!theme.examples.length && <details><summary>Ejemplos de contenidos</summary><ul>{theme.examples.map(example => <li key={example}>{example}</li>)}</ul></details>}
          {'resource' in theme && <a className="portal-resource" href={theme.resource.url} target="_blank" rel="noreferrer">{theme.resource.title}</a>}
        </>}
      </Surface>
      <Surface className="newsletter-catalog-results">
        <div className="portal-filters">
          <FilterSelect value={section?.id ?? ''} onChange={event => update('seccion', event.target.value)} aria-label="Filtrar por sección"><option value="">Todas las secciones</option>{PORTAL_SECTIONS.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</FilterSelect>
          <FilterSelect value={selectedTopic} onChange={event => update('tematica', event.target.value)} aria-label="Filtrar por temática"><option value="">Todos los ejes</option>{topics.map(value => <option key={value}>{value}</option>)}</FilterSelect>
          <FilterSelect value={organization} onChange={event => update('organismo', event.target.value)} aria-label="Filtrar por organismo"><option value="">Todos los organismos</option>{organizations.map(value => <option key={value}>{value}</option>)}</FilterSelect>
          <FilterSelect value={sort} onChange={event => update('orden', event.target.value)} aria-label="Ordenar publicaciones"><option value="">Más recientes</option><option value="oldest">Más antiguas</option><option value="title">Título A-Z</option></FilterSelect>
        </div>
        <p className="newsletter-results-count" role="status">{results.length} {results.length === 1 ? 'publicación' : 'publicaciones'}</p>
        <div className="newsletter-grid">{results.map(item => <NewsletterCard key={item.id} item={item} />)}</div>
        {!results.length && <p className="empty-results">No hay publicaciones para esta selección.</p>}
      </Surface>
    </>}
  </div>
}
