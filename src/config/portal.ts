import { BookOpen, BriefcaseBusiness, Compass, GraduationCap, Lightbulb, MessageCircle, Users, Wrench, HeartHandshake, Share2, Radar } from 'lucide-react'

export const COMMUNITY_SECTION = 'comparti-con-la-red'

export const PORTAL_SECTIONS = [
  { id: 'conocimiento-en-red', title: 'Conocimiento en Red', description: 'Un espacio para compartir herramientas, experiencias y aprendizajes que potencien la gestión pública.', icon: BookOpen },
  { id: 'red-en-practica', title: 'RED EN PRÁCTICA', description: 'Un espacio de recursos, herramientas y experiencias para llevar nuevas ideas a la gestión cotidiana.', icon: Compass },
  { id: 'caja-de-herramientas', title: 'CAJA DE HERRAMIENTAS', description: 'Recursos y contenidos para fortalecer el liderazgo y mejorar la gestión de los equipos.', icon: Wrench },
  { id: 'espacio-de-aprendizaje', title: 'ESPACIO DE APRENDIZAJE', description: 'Contenidos, experiencias y recursos para el desarrollo profesional de la Red Gerencial.', icon: GraduationCap },
  { id: 'radar-gerencial', title: 'RADAR GERENCIAL', description: 'Ideas, tendencias y herramientas para estar actualizados y potenciar la gestión.', icon: Radar },
  { id: COMMUNITY_SECTION, title: 'Compartí con la Red', description: 'Compartí una experiencia, herramienta o aprendizaje. La administración revisará tu aporte antes de publicarlo.', icon: Share2 },
] as const

export type PortalSection = (typeof PORTAL_SECTIONS)[number]['id']

export const PORTAL_TOPICS = [
  { title: 'Liderazgo y equipos', icon: Users, description: 'Herramientas para conducir, desarrollar y potenciar equipos de trabajo.', content: 'Liderazgo consciente, delegación, feedback, motivación, escucha activa, gestión de conflictos, desarrollo de personas y conversaciones difíciles.', examples: ['MicroVitaminas: Motivación', 'MicroVitaminas: Balance de gestión anual', 'Masterclass 1: Liderazgo con propósito', 'Masterclass 3: Gestión de equipos'] },
  { title: 'Gestión', icon: BriefcaseBusiness, description: 'Recursos para organizar el trabajo, tomar decisiones y alcanzar objetivos.', content: 'Planificación, gestión del tiempo, reuniones efectivas, priorización, pensamiento estratégico, indicadores y gestión por resultados.', examples: ['MicroVitaminas: Gestión del tiempo', 'MicroVitaminas: Toma de decisiones', 'MicroVitaminas: Reuniones efectivas', 'MicroVitaminas: Pensamiento estratégico', 'Masterclass 5: Toma de decisiones', 'Masterclass 6: Liderazgo estratégico'] },
  { title: 'Comunicación', icon: MessageCircle, description: 'Herramientas para mejorar las conversaciones, la comunicación y la articulación dentro de la organización.', content: 'Comunicación asertiva, conversaciones de desempeño, negociación, comunicación estratégica y colaboración transversal.', examples: ['Masterclass 2: Comunicación y feedback'], resource: { title: 'Conversaciones difíciles', url: 'https://docs.google.com/document/d/1MoQT-DwP_QVSUHuo6q_LZauKimjYOMqdZaOLWYMyeN8/edit?tab=t.0' } },
  { title: 'Bienestar y desarrollo', icon: HeartHandshake, description: 'Contenidos para promover el bienestar, el crecimiento profesional y el desarrollo sostenible de las personas.', content: 'Autoconocimiento, inteligencia emocional, bienestar laboral, salud mental, motivación, desarrollo de carrera y liderazgo sostenible.', examples: ['MicroVitaminas: Autoconocimiento', 'Seminario +45: Bienestar'] },
  { title: 'Innovación', icon: Lightbulb, description: 'Ideas y herramientas para adaptarse a los nuevos desafíos de la gestión pública.', content: 'Inteligencia artificial, transformación digital, innovación pública, nuevas metodologías de trabajo y tecnología aplicada a la gestión.', examples: ['MicroVitaminas: Liderazgo aumentado (IA)', 'Masterclass 4: Innovación'] },
  { title: 'Experiencias', icon: Compass, description: 'Un espacio para compartir aprendizajes, buenas prácticas y soluciones desarrolladas por los propios gerentes.', content: 'Casos de gestión, experiencias exitosas, herramientas creadas por áreas, aprendizajes, recomendaciones y aportes de GO/SGO.', examples: [] },
] as const

export function portalTopic(topic: string) {
  return topic === 'Innovación pública' ? 'Innovación' : topic.trim() || 'Sin temática'
}
