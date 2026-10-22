import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Building2, ChevronsDownUp, ChevronsUpDown, Expand, Landmark, Minimize, Network, RotateCcw, Search, SlidersHorizontal, UsersRound } from 'lucide-react'
import { Button, PageHeading, Surface } from '../components/common/UI'
import { FilterDropdown } from '../components/common/FilterDropdown'
import { DirectoryProfileModal } from '../components/directory/DirectoryProfileModal'
import { OrganizationCanvas } from '../components/organization/OrganizationCanvas'
import type { OrganizationCanvasProps, OrganizationViewRequest } from '../components/organization/OrganizationCanvas'
import { OrganizationMobileExplorer } from '../components/organization/OrganizationMobileExplorer'
import { OrganizationDetailModal } from '../components/organization/OrganizationDetailModal'
import { OrganizationLegend } from '../components/organization/OrganizationLegend'
import { OrganizationBreadcrumb } from '../components/organization/OrganizationBreadcrumb'
import { useOrganizationFullscreen } from '../components/organization/useOrganizationFullscreen'
import { buildOrganizationIndex, expansionForRoot } from '../components/organization/organizationModel'
import { CHILD_PAGE, GRAPH_LIMIT, orderedRoots, visibleOrganizationGraph } from '../components/organization/organizationGraph'
import { getOrganizationDataset } from '../services/organization'
import { norm } from '../utils/format'
import type { OrganizationDataset } from '../types/organization'
import type { OrganizationIndex } from '../components/organization/organizationModel'
import type { Person } from '../types'
import '../components/organization/organization.css'

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => { const media = window.matchMedia(query); const change = () => setMatches(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change) }, [query])
  return matches
}

export function OrganizationChartPage() {
  const [loaded, setLoaded] = useState<{ dataset: OrganizationDataset; index: OrganizationIndex } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [scope, setScope] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [limits, setLimits] = useState<Map<string, number>>(new Map())
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [notice, setNotice] = useState('')
  const [detailId, setDetailId] = useState('')
  const [profile, setProfile] = useState<Person | null>(null)
  const [request, setRequest] = useState<OrganizationViewRequest>({ id: '', sequence: 0, mode: 'overview' })
  const sequence = useRef(0)
  const modalTrigger = useRef<HTMLElement | null>(null)
  const profileWasOpen = useRef(false)
  const { fullscreen, container: explorer, trigger: fullscreenTrigger, toggle: toggleFullscreen } = useOrganizationFullscreen()
  const mobile = useMedia('(max-width: 700px)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const index = loaded?.index
  const requestView = useCallback((id: string, mode: OrganizationViewRequest['mode']) => setRequest({ id, mode, sequence: ++sequence.current }), [])
  useEffect(() => {
    let alive = true
    getOrganizationDataset().then(dataset => {
      const index = buildOrganizationIndex(dataset)
      if (alive) { setLoaded({ dataset, index }); setError('') }
    }).catch(() => { if (alive) setError('No pudimos cargar el Organigrama institucional. Reintentá en unos momentos.') })
    return () => { alive = false }
  }, [attempt])
  const graph = useMemo(() => index ? visibleOrganizationGraph(index, scope, expanded, limits, selectedId) : null, [index, scope, expanded, limits, selectedId])
  const roots = useMemo(() => index ? orderedRoots(index) : [], [index])
  const results = useMemo(() => {
    if (!index || !deferredQuery.trim()) return []
    const words = norm(deferredQuery).trim().split(/\s+/)
    return index.search.filter(item => (!scope || item.rootId === scope) && words.every(word => item.text.includes(word)))
  }, [index, deferredQuery, scope])
  const reset = useCallback(() => {
    setScope(''); setSelectedId(''); setExpanded(new Set()); setLimits(new Map()); setQuery(''); setNotice(''); setDetailId('')
    requestView('', 'overview')
  }, [requestView])
  const select = useCallback((id: string) => {
    if (!index) return
    const path = index.path.get(id)
    if (!path) return
    setDetailId(''); setScope(path[0].id); setSelectedId(id); setNotice(''); setQuery('')
    setExpanded(previous => new Set([...previous, ...path.slice(0, -1).map(unit => unit.id)]))
    requestView(id, 'center')
  }, [index, requestView])
  const toggle = useCallback((id: string) => {
    if (!index) return
    const root = index.rootId.get(id)!
    setSelectedId(id); setNotice('')
    if (!scope) { setScope(root); requestView(id, 'center') } else requestView(id, 'anchor')
    setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [index, scope, requestView])
  const openDetail = useCallback((id: string) => {
    modalTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedId(id); setDetailId(id)
  }, [])
  const activate = useCallback((id: string) => {
    const unit = index?.units.get(id)
    if (!unit) return
    if (/gerencia/i.test(unit.type) || !(index?.children.get(id)?.length)) openDetail(id)
    else toggle(id)
  }, [index, openDetail, toggle])
  const more = useCallback((id: string) => {
    if ((graph?.nodes.length ?? 0) >= GRAPH_LIMIT) {
      setNotice(`La vista tiene ${GRAPH_LIMIT} unidades. Colapsá otra rama para mostrar más dependencias.`); return
    }
    setSelectedId(id)
    setLimits(previous => { const next = new Map(previous); next.set(id, (next.get(id) ?? CHILD_PAGE) + CHILD_PAGE); return next })
    requestView(id, 'anchor')
  }, [graph?.nodes.length, requestView])
  const closeDetail = useCallback(() => setDetailId(''), [])
  const closeProfile = useCallback(() => setProfile(null), [])
  useEffect(() => {
    if (profile) { profileWasOpen.current = true; return }
    if (!profileWasOpen.current) return
    profileWasOpen.current = false
    const frame = requestAnimationFrame(() => { if (modalTrigger.current?.isConnected) modalTrigger.current.focus() })
    return () => cancelAnimationFrame(frame)
  }, [profile])
  const openProfile = useCallback((person: Person) => { setDetailId(''); setProfile(person) }, [])
  useEffect(() => {
    if (mobile && request.id) {
      const timer = setTimeout(() => document.getElementById(`organization-mobile-${request.id}`)?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' }), 50)
      return () => clearTimeout(timer)
    }
  }, [mobile, request, reducedMotion])
  if (error) return <div className="organization-page"><Surface className="organization-empty"><h1>Organigrama</h1><p role="alert">{error}</p><Button onClick={() => { setError(''); setLoaded(null); setAttempt(value => value + 1) }}>Reintentar</Button></Surface></div>
  if (!index || !loaded || !graph) return <div className="organization-page"><Surface className="organization-loading"><h1>Organigrama</h1><p role="status">Cargando la estructura institucional...</p><div /><div /><div /></Surface></div>
  if (!roots.length) return <div className="organization-page"><Surface className="organization-empty"><h1>Organigrama</h1><p>No hay organismos relevados todavía.</p></Surface></div>
  const canvasProps: OrganizationCanvasProps = { index, graph, selectedId, expanded, scope, request, reducedMotion, onActivate: activate, onToggle: toggle, onDetail: openDetail, onMore: more }
  return <div className="page-stack organization-page">
    <Surface className="organization-intro">
      <PageHeading title="Organigrama" subtitle="Explorá la estructura institucional y navegá desde organismos y áreas rectoras hasta sus direcciones, gerencias y subgerencias." actions={<div className="organization-statistics">{[
        { label: 'Organismos / Áreas rectoras', value: index.statistics.roots, Icon: Landmark },
        { label: 'Dependencias relevadas', value: index.statistics.units, Icon: Network },
        { label: 'Responsables identificados', value: index.statistics.responsible, Icon: UsersRound },
      ].map(({ label, value, Icon }) => <div className="organization-stat" key={label}><span><Icon size={24} /></span><div><small>{label}</small><strong>{value.toLocaleString('es-AR')}</strong></div></div>)}</div>} />
    </Surface>
    {loaded.dataset.source !== 'supabase' && <p className="organization-demo-notice" role="note">{loaded.dataset.source === 'mock' ? 'Demostración local con responsables ficticios.' : 'Estructura local sin responsables publicados.'}</p>}
    <div ref={explorer} className={`organization-explorer-shell${fullscreen ? ' is-fullscreen' : ''}`} role={fullscreen ? 'dialog' : 'region'} aria-modal={fullscreen || undefined} aria-label="Explorador del Organigrama" tabIndex={-1}>
    <Surface className="organization-graph-surface">
      <div className="organization-graph-heading"><div>{scope ? <Button onClick={reset}><ArrowLeft size={16} /> Volver al organigrama completo</Button> : <div className="organization-overview-title"><Network size={19} /><strong>Vista general</strong><span>{roots.length} organismos superiores</span></div>}<OrganizationBreadcrumb path={index.path.get(selectedId) ?? (scope ? [index.units.get(scope)!] : [])} onSelect={select} onReset={reset} /></div><div className="organization-graph-heading-actions"><OrganizationLegend /><button ref={fullscreenTrigger} type="button" className="btn btn-outline organization-fullscreen-toggle" onClick={toggleFullscreen} aria-pressed={fullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver organigrama en pantalla completa'} title={fullscreen ? 'Salir de pantalla completa (Esc)' : 'Ver organigrama en pantalla completa'}>{fullscreen ? <Minimize size={18} /> : <Expand size={18} />}<span>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</span></button></div></div>
      <div className="organization-graph-toolbar">
      <div className="organization-controls">
        <label className="search-input"><Search size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar organismo, secretaría, dirección o responsable..." aria-label="Buscar unidades y responsables" /></label>
        <div className="organization-root-filter"><label id="organization-filter-label" htmlFor="organization-filter">Organismo / Área rectora</label><FilterDropdown id="organization-filter" labelledBy="organization-filter-label" value={scope} options={[{ value: '', label: 'Todos los organismos' }, ...roots.map(root => ({ value: root.id, label: root.name }))]} onChange={id => { if (!id) reset(); else { select(id); setExpanded(new Set([id])); setLimits(new Map()) } }} /></div>
        <Button onClick={() => {
          const root = scope || index.rootId.get(selectedId)
          if (!root) { setNotice('Elegí un organismo para expandir su estructura de forma progresiva.'); return }
          const result = expansionForRoot(index, root, GRAPH_LIMIT)
          setExpanded(new Set([root, ...result.expanded])); setLimits(new Map([...result.expanded].map(id => [id, index.children.get(id)?.length ?? CHILD_PAGE]))); requestView(selectedId || root, 'anchor')
          setNotice(result.limited ? `La expansión está limitada a ${GRAPH_LIMIT} unidades visibles. Podés seguir abriendo ramas o mostrar más dependencias en cada tarjeta.` : '')
        }}><ChevronsUpDown size={16} /> Expandir todo</Button>
        <Button onClick={() => { setExpanded(new Set()); setSelectedId(scope); setNotice(''); requestView(scope, scope ? 'center' : 'overview') }}><ChevronsDownUp size={16} /> Colapsar todo</Button>
        <Button onClick={reset}><SlidersHorizontal size={16} /> Limpiar filtros</Button>
      </div>
      {query.trim() && <div className="organization-search-results" aria-label="Resultados de búsqueda"><p role="status">{results.length ? `${results.length} unidades encontradas` : 'No encontramos unidades que coincidan con tu búsqueda.'}</p>{results.slice(0, 50).map(({ unit }) => <button key={unit.id} type="button" onClick={() => select(unit.id)}><Building2 size={17} /><span><strong>{unit.name}</strong><small>{index.path.get(unit.id)?.map(item => item.name).join(' › ')}</small></span></button>)}{results.length > 50 && <p>Mostrando los primeros 50 resultados. Afiná tu búsqueda.</p>}<Button variant="ghost" onClick={() => setQuery('')}><RotateCcw size={14} /> Limpiar búsqueda</Button></div>}
      </div>
      {notice && <p className="organization-expansion-notice" role="status">{notice}</p>}
      {mobile ? <OrganizationMobileExplorer {...canvasProps} /> : <OrganizationCanvas {...canvasProps} />}
      <div className="organization-graph-caption"><span>{graph.nodes.length} unidades visibles{scope ? ` · ${index.units.get(scope)?.name}` : ' · Seleccioná un organismo para explorar sus dependencias'}</span>{graph.limited && <span>Vista limitada: colapsá ramas para seguir explorando.</span>}</div>
    </Surface>
    </div>
    <p className="organization-footnote">Las conexiones representan dependencias de Dotación. Los contactos se consultan exclusivamente en perfiles autorizados del Directorio.</p>
    {detailId && index.units.get(detailId) && <OrganizationDetailModal unit={index.units.get(detailId)!} index={index} onSelect={select} onProfile={openProfile} onClose={closeDetail} />}
    {profile && <DirectoryProfileModal person={profile} onClose={closeProfile} />}
  </div>
}
