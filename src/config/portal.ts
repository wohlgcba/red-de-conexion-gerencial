import { BookOpen, Compass, GraduationCap, Radar, Share2, Wrench } from 'lucide-react'

export const COMMUNITY_SECTION = 'comparti-con-la-red'

export const PORTAL_SECTIONS = [
  { id: 'conocimiento-en-red', title: 'Conocimiento en Red', description: 'Un espacio para compartir herramientas, experiencias y aprendizajes que potencien la gestión pública.', icon: BookOpen, visualTheme: 'Ambiente' },
  { id: 'red-en-practica', title: 'RED EN PRÁCTICA', description: 'Un espacio de recursos, herramientas y experiencias para llevar nuevas ideas a la gestión cotidiana.', icon: Compass, visualTheme: 'Datos' },
  { id: 'caja-de-herramientas', title: 'CAJA DE HERRAMIENTAS', description: 'Recursos y contenidos para fortalecer el liderazgo y mejorar la gestión de los equipos.', icon: Wrench, visualTheme: 'Gestión' },
  { id: 'espacio-de-aprendizaje', title: 'ESPACIO DE APRENDIZAJE', description: 'Contenidos, experiencias y recursos para el desarrollo profesional de la Red Gerencial.', icon: GraduationCap, visualTheme: 'Innovación pública' },
  { id: 'radar-gerencial', title: 'RADAR GERENCIAL', description: 'Ideas, tendencias y herramientas para estar actualizados y potenciar la gestión.', icon: Radar, visualTheme: 'Participación' },
  { id: COMMUNITY_SECTION, title: 'COMPARTÍ CON LA RED', description: 'Compartí una experiencia, herramienta o aprendizaje. La administración revisará tu aporte antes de publicarlo.', icon: Share2, visualTheme: 'Procesos' },
] as const

export type PortalSection = (typeof PORTAL_SECTIONS)[number]['id']

export const PORTAL_TOPICS = [
  { title: 'Liderazgo y equipos', description: 'Herramientas para conducir, desarrollar y potenciar equipos de trabajo.', content: 'Liderazgo consciente, delegación, feedback, motivación, escucha activa, gestión de conflictos, desarrollo de personas y conversaciones difíciles.', examples: ['MicroVitaminas: Motivación', 'MicroVitaminas: Balance de gestión anual', 'Masterclass 1: Liderazgo con propósito', 'Masterclass 3: Gestión de equipos'] },
  { title: 'Gestión', description: 'Recursos para organizar el trabajo, tomar decisiones y alcanzar objetivos.', content: 'Planificación, gestión del tiempo, reuniones efectivas, priorización, pensamiento estratégico, indicadores y gestión por resultados.', examples: ['MicroVitaminas: Gestión del tiempo', 'MicroVitaminas: Toma de decisiones', 'MicroVitaminas: Reuniones efectivas', 'MicroVitaminas: Pensamiento estratégico', 'Masterclass 5: Toma de decisiones', 'Masterclass 6: Liderazgo estratégico'] },
  { title: 'Comunicación', description: 'Herramientas para mejorar las conversaciones, la comunicación y la articulación dentro de la organización.', content: 'Comunicación asertiva, conversaciones de desempeño, negociación, comunicación estratégica y colaboración transversal.', examples: ['Masterclass 2: Comunicación y feedback'], resource: { title: 'Conversaciones difíciles', url: 'https://docs.google.com/document/d/1MoQT-DwP_QVSUHuo6q_LZauKimjYOMqdZaOLWYMyeN8/edit?tab=t.0' } },
  { title: 'Bienestar y desarrollo', description: 'Contenidos para promover el bienestar, el crecimiento profesional y el desarrollo sostenible de las personas.', content: 'Autoconocimiento, inteligencia emocional, bienestar laboral, salud mental, motivación, desarrollo de carrera y liderazgo sostenible.', examples: ['MicroVitaminas: Autoconocimiento', 'Seminario +45: Bienestar'] },
  { title: 'Innovación', description: 'Ideas y herramientas para adaptarse a los nuevos desafíos de la gestión pública.', content: 'Inteligencia artificial, transformación digital, innovación pública, nuevas metodologías de trabajo y tecnología aplicada a la gestión.', examples: ['MicroVitaminas: Liderazgo aumentado (IA)', 'Masterclass 4: Innovación'] },
  { title: 'Experiencias', description: 'Un espacio para compartir aprendizajes, buenas prácticas y soluciones desarrolladas por los propios gerentes.', content: 'Casos de gestión, experiencias exitosas, herramientas creadas por áreas, aprendizajes, recomendaciones y aportes de GO/SGO.', examples: [] },
] as const

export function portalTagKey(tag: string) {
  return tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
}

export function portalTopic(topic: string) {
  const label = topic.trim().replace(/^#+\s*/, '')
  const key = portalTagKey(label)
  if (!key || key === 'sin tematica') return 'Sin temática'
  if (key === 'innovacion publica' || key === 'innovacion') return 'Innovación'
  return PORTAL_TOPICS.find(({ title }) => portalTagKey(title) === key)?.title ?? (label || 'Sin temática')
}

export function publicationTags({ topic, tags }: { topic: string; tags?: readonly string[] }) {
  const labels = [...(tags ?? []), topic].map(portalTopic).filter(label => label !== 'Sin temática')
  return [...new Map(labels.map(label => [portalTagKey(label), label])).values()]
}

export function portalTagLink(tag: string) {
  return `/portal?${new URLSearchParams({ tematica: tag })}`
}
