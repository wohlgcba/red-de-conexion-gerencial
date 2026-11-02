import { useLayoutEffect, useRef, useState } from 'react'
import { formatNumber } from './metricsModel'

export type ChartSeries = { key: string; label: string; color: string }
type Props = {
  title: string
  labels: string[]
  periods: string[]
  series: ChartSeries[]
  values: number[][]
  stacked?: boolean
  extra?: (index: number) => string[]
  endLabel?: string
  height?: number
}

const M = { top: 22, right: 14, bottom: 30, left: 44 }

function niceTicks(max: number) {
  if (max <= 4) return [0, 1, 2, 3, 4]
  const raw = max / 4, power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(n => n * power).find(n => n >= raw) ?? raw
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => Math.round(i * step))
}

// Square at the baseline, 4px rounded data end.
function column(x: number, y: number, w: number, h: number, rounded: boolean) {
  const r = rounded ? Math.min(4, w / 2, h) : 0
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export function MetricsColumnChart({ title, labels, periods, series, values, stacked = false, extra, endLabel, height = 260 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const count = labels.length
  const plotWidth = Math.max(0, width - M.left - M.right), plotHeight = height - M.top - M.bottom
  const ticks = niceTicks(Math.max(0, ...values.map(row => stacked ? row.reduce((a, b) => a + b, 0) : Math.max(...row))))
  const top = ticks.at(-1) || 1
  const y = (value: number) => M.top + plotHeight - value / top * plotHeight
  const slot = count ? plotWidth / count : 0
  const groupWidth = Math.min(stacked ? 24 : 24 * series.length + 2 * (series.length - 1), slot * 0.72)
  const barWidth = stacked ? groupWidth : Math.max(1, (groupWidth - 2 * (series.length - 1)) / series.length)
  const every = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotWidth / 58))))
  // Beside the hovered column, never over it; flips to the left near the right edge.
  const tooltipRight = active !== null && M.left + slot * (active + 1) + 230 > width
  const tooltipLeft = active === null ? 0 : tooltipRight ? M.left + slot * active - 6 : M.left + slot * (active + 1) + 6
  return <div className="metrics-chart" ref={box}>
    {series.length > 1 && <ul className="metrics-legend">{series.map(item => <li key={item.key}><span style={{ background: item.color }} />{item.label}</li>)}</ul>}
    {width > 0 && <svg width={width} height={height} role="group" aria-label={title} onMouseLeave={() => setActive(null)}>
      {ticks.map(tick => <g key={tick}><line className="metrics-gridline" x1={M.left} x2={width - M.right} y1={y(tick)} y2={y(tick)} /><text className="metrics-axis" x={M.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">{formatNumber(tick)}</text></g>)}
      {values.map((row, index) => {
        const center = M.left + slot * (index + 0.5)
        let cursor = M.top + plotHeight
        const lastDrawn = row.reduce((last, value, i) => value > 0 ? i : last, -1)
        return <g key={periods[index]} className={active === index ? 'is-active' : undefined}>
          {active === index && <rect className="metrics-hover" x={center - slot / 2 + 1} y={M.top} width={Math.max(0, slot - 2)} height={plotHeight} rx={6} />}
          {stacked ? row.map((value, i) => {
            if (!value) return null
            const h = value / top * plotHeight, gap = cursor < M.top + plotHeight ? 2 : 0
            cursor -= h
            return h - gap > 0.5 ? <path key={series[i].key} d={column(center - barWidth / 2, cursor, barWidth, h - gap, i === lastDrawn)} fill={series[i].color} /> : null
          }) : row.map((value, i) => {
            const h = value / top * plotHeight
            return h > 0 ? <path key={series[i].key} d={column(center - groupWidth / 2 + i * (barWidth + 2), y(value), barWidth, h, true)} fill={series[i].color} /> : null
          })}
          {(count - 1 - index) % every === 0 && <text className="metrics-axis" x={center} y={height - 10} textAnchor="middle">{labels[index]}</text>}
          {endLabel && index === count - 1 && <text className="metrics-end-label" x={Math.min(center, width - M.right - 4)} y={y(row.reduce((a, b) => a + b, 0)) - 7} textAnchor={center > width - M.right - 30 ? 'end' : 'middle'}>{endLabel}</text>}
          <rect className="metrics-hit" x={center - slot / 2} y={M.top} width={slot} height={plotHeight + 20} tabIndex={0}
            aria-label={`${periods[index]}: ${series.map((item, i) => `${item.label} ${formatNumber(row[i])}`).join(', ')}${extra ? `. ${extra(index).join('. ')}` : ''}`}
            onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} />
        </g>
      })}
      <line className="metrics-baseline" x1={M.left} x2={width - M.right} y1={M.top + plotHeight} y2={M.top + plotHeight} />
    </svg>}
    {active !== null && values[active] && <div className="metrics-tooltip" style={{ left: tooltipLeft, transform: tooltipRight ? 'translateX(-100%)' : undefined }} role="presentation">
      <strong>{periods[active]}</strong>
      {(stacked ? [...series].reverse() : series).map(item => { const i = series.indexOf(item); return <span key={item.key}><i style={{ background: item.color }} />{item.label}<b>{formatNumber(values[active][i])}</b></span> })}
      {extra?.(active).map(line => <small key={line}>{line}</small>)}
    </div>}
  </div>
}
