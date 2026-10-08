import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { norm } from '../../utils/format'
import './filter-dropdown.css'

type Option = { value: string; label: string }
type Position = { top: number | undefined; bottom: number | undefined; left: number; width: number; maxHeight: number }

export function FilterDropdown({ id, value, options, onChange, labelledBy, describedBy, icon, searchPlaceholder = 'Buscar opciones...' }: {
  id: string; value: string; options: Option[]; onChange: (value: string) => void
  labelledBy: string; describedBy?: string; icon?: ReactNode; searchPlaceholder?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const activeButton = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeValue, setActiveValue] = useState(value)
  const [position, setPosition] = useState<Position | null>(null)
  const selected = options.find(option => option.value === value) ?? options[0]
  const searchable = options.length > 8
  const results = options.filter(option => !query || norm(option.label).includes(norm(query)))
  const active = results.find(option => option.value === activeValue) ?? results[0]
  const activeIndex = results.indexOf(active)
  const listId = `${id}-options`
  const activeId = active ? `${id}-option-${options.indexOf(active)}` : undefined

  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }
  const show = () => { setQuery(''); setActiveValue(value); setOpen(true) }
  const choose = (option: Option) => { onChange(option.value); close(true) }

  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24)
      const below = window.innerHeight - rect.bottom - 20
      const above = rect.top - 20
      const placeBelow = below >= Math.min(260, above)
      const maxHeight = Math.max(0, Math.min(360, placeBelow ? below : above))
      const next = { width, maxHeight, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: placeBelow ? rect.bottom + 8 : undefined, bottom: placeBelow ? undefined : window.innerHeight - rect.top + 8 }
      setPosition(previous => previous && Object.keys(next).every(key => previous[key as keyof Position] === next[key as keyof Position]) ? previous : next)
    }
    const onScroll = (event: Event) => { if (!root.current?.contains(event.target as Node)) measure() }
    measure()
    ;(search.current ?? trigger.current)?.focus()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', onScroll, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', onScroll, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  useEffect(() => {
    if (open) activeButton.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeValue, query])

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); close(true); return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) { show(); return }
      if (results.length) setActiveValue(results[(activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length].value)
    } else if (open && (event.key === 'Home' || event.key === 'End') && event.target !== search.current) {
      event.preventDefault()
      if (results.length) setActiveValue(results[event.key === 'Home' ? 0 : results.length - 1].value)
    } else if (open && event.key === 'Enter' && (event.target === search.current || event.target === trigger.current)) {
      event.preventDefault()
      if (active) choose(active)
    }
  }

  return <div ref={root} className={`filter-dropdown ${value ? 'has-selection' : ''}`} onKeyDown={handleKeys}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close() }}>
    <button ref={trigger} id={id} type="button" role={searchable ? undefined : 'combobox'} className="filter-dropdown-trigger" aria-labelledby={`${labelledBy} ${id}-value`}
      aria-describedby={describedBy} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && !searchable ? activeId : undefined} onClick={() => open ? close() : show()} title={selected?.label}>
      {icon && <span className="filter-dropdown-icon" aria-hidden="true">{icon}</span>}
      <span id={`${id}-value`} className="filter-dropdown-value">{selected?.label || 'Seleccionar'}</span>
      <ChevronDown size={16} className={open ? 'is-expanded' : ''} aria-hidden="true" />
    </button>
    {open && <div className="filter-dropdown-panel" style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>
      {searchable && <div className="filter-dropdown-search"><Search size={17} aria-hidden="true" /><input ref={search} value={query}
        onChange={event => { setQuery(event.target.value); setActiveValue('') }} placeholder={searchPlaceholder} aria-label={searchPlaceholder}
        role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeId} autoComplete="off" />
        {query && <button type="button" aria-label="Limpiar búsqueda del filtro" onClick={() => { setQuery(''); search.current?.focus() }}><X size={15} /></button>}
      </div>}
      <div id={listId} className="filter-dropdown-options" role="listbox" aria-labelledby={labelledBy}>
        {results.map(option => <button key={option.value} ref={option === active ? activeButton : undefined} id={`${id}-option-${options.indexOf(option)}`}
          type="button" role="option" tabIndex={-1} aria-selected={option.value === value}
          className={`filter-dropdown-option ${option === active ? 'is-active' : ''}`} onMouseDown={event => event.preventDefault()}
          onMouseEnter={() => setActiveValue(option.value)} onClick={() => choose(option)}>
          <span>{option.label}</span>{option.value === value && <Check size={17} aria-hidden="true" />}
        </button>)}
      </div>
      {results.length === 0 && <p className="filter-dropdown-empty" role="status">No encontramos opciones con esa búsqueda.</p>}
      {searchable && <div className="filter-dropdown-footer">{results.length} {results.length === 1 ? 'opción disponible' : 'opciones disponibles'}</div>}
    </div>}
  </div>
}
