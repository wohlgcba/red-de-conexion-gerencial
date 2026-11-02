import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { List, Medal, Trophy } from 'lucide-react'
import { Surface } from '../common/UI'
import { formatNumber } from './metricsModel'

export type RankingItem = { id: string; label: string; detail: string; value: number }
type Props = { id?: string; title: string; description: ReactNode; items: RankingItem[]; unit: [string, string]; color: string; empty: string }

const PLACES = [1, 0, 2] // Second, first, third: the podium reads left to right.
const plural = (value: number, [one, many]: [string, string]) => `${formatNumber(value)} ${value === 1 ? one : many}`

export function MetricsRanking({ id, title, description, items, unit, color, empty }: Props) {
  const [view, setView] = useState<'podium' | 'list'>('podium')
  const ranked = items.filter(item => item.value > 0)
  const max = Math.max(1, ...items.map(item => item.value))
  return <Surface className="metrics-card metrics-ranking-card">
    <section id={id} aria-label={title} style={{ '--ranking-color': color } as CSSProperties}>
      <div className="metrics-card-heading"><div><h2>{title}</h2><p>{description}</p></div>
        <div className="metrics-segmented metrics-view-toggle" role="radiogroup" aria-label={`Vista de ${title.toLowerCase()}`}>
          <button type="button" role="radio" aria-checked={view === 'podium'} onClick={() => setView('podium')}><Trophy size={14} /> Podio</button>
          <button type="button" role="radio" aria-checked={view === 'list'} onClick={() => setView('list')}><List size={14} /> Lista</button>
        </div></div>
      {!ranked.length ? <div className="administration-empty metrics-ranking-empty"><Trophy size={28} /><h3>{empty}</h3></div>
        : view === 'podium' ? <>
          <ol className="metrics-podium">{PLACES.map(index => {
            const item = ranked[index]
            return item ? <li key={item.id} className={`metrics-podium-place place-${index + 1}`} aria-label={`Puesto ${index + 1}: ${item.label}, ${plural(item.value, unit)}`}>
              <div className="metrics-podium-entry"><Medal size={22} aria-hidden="true" /><strong title={item.label}>{item.label}</strong><small>{item.detail}</small><b>{plural(item.value, unit)}</b></div>
              <div className="metrics-podium-step" aria-hidden="true">{index + 1}</div>
            </li> : <li key={`empty-${index}`} className={`metrics-podium-place place-${index + 1} is-empty`} aria-hidden="true"><div className="metrics-podium-step" /></li>
          })}</ol>
          {ranked.length > 3 && <ol className="metrics-podium-rest" start={4}>{ranked.slice(3, 8).map(item => <li key={item.id}><span title={item.label}>{item.label}</span><b>{plural(item.value, unit)}</b></li>)}</ol>}
        </>
        : <ol className="metrics-ranking">{items.map((item, index) => <li key={item.id}>
          <span className="metrics-rank">{index + 1}</span>
          <div className="metrics-ranking-title"><strong>{item.label}</strong><small>{item.detail}</small></div>
          <div className="metrics-ranking-bar"><span style={{ width: `${item.value / max * 100}%` }} /><b>{plural(item.value, unit)}</b></div>
        </li>)}</ol>}
    </section>
  </Surface>
}
