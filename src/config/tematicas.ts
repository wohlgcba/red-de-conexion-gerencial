import { BarChart3, BookOpen, ClipboardList, Leaf, Lightbulb, Newspaper, Users, Workflow } from 'lucide-react'
import type { CSSProperties } from 'react'

export const TEMATICAS = {
  Procesos: { color: '#0a5784', background: '#e3f0f8', icon: Workflow, description: 'Circuitos, trámites y formas de trabajo más simples.' },
  Datos: { color: '#3446a8', background: '#e8ebf9', icon: BarChart3, description: 'Tableros, indicadores e información para decidir.' },
  Participación: { color: '#6b3fb0', background: '#efe8fb', icon: Users, description: 'Escucha, territorio y trabajo con otros equipos.' },
  Gestión: { color: '#0b6b70', background: '#ddf1f1', icon: ClipboardList, description: 'Planificación, prioridades y seguimiento de equipos.' },
  'Innovación pública': { color: '#a8440d', background: '#fbe9de', icon: Lightbulb, description: 'Nuevas formas de resolver desafíos compartidos.' },
  Ambiente: { color: '#2c6e30', background: '#e3f2e4', icon: Leaf, description: 'Prácticas sostenibles en los espacios de trabajo.' },
  Aprendizajes: { color: '#9c2357', background: '#f9e3ed', icon: BookOpen, description: 'Lo que salió bien, lo que no y por qué.' },
}

const fallback = { color: '#0a5784', background: '#e3f0f8', icon: Newspaper, description: 'Experiencias y proyectos compartidos por otras áreas.' }
const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function tematica(topic: string) {
  const name = Object.keys(TEMATICAS).find(name => key(name) === key(topic))
  // Older publications use this shorter name; their stored topic is preserved.
  return name ? TEMATICAS[name as keyof typeof TEMATICAS] : key(topic) === 'innovacion' ? TEMATICAS['Innovación pública'] : fallback
}

export function tematicaStyle(topic: string): CSSProperties {
  const theme = tematica(topic)
  return { '--topic-color': theme.color, '--topic-background': theme.background } as CSSProperties
}
