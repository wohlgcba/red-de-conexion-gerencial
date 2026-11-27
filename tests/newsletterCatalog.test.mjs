import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portalTagKey, portalTagLink, publicationTags } from '../src/config/portal.ts'
import { groupNewsletters, publishedByDate, topicLink } from '../src/components/newsletters/catalogModel.ts'
import { tematica } from '../src/config/tematicas.ts'

test('publication tags include secondary and legacy values, normalize names and keep links intact', () => {
  const tags = publicationTags({ topic: 'Innovación pública', tags: ['#Gestión', 'Comunicacion', 'innOvación', 'I+D / Áreas'] })
  assert.deepEqual(tags, ['Gestión', 'Comunicación', 'Innovación', 'I+D / Áreas'])
  assert.deepEqual(publicationTags({ topic: 'Procesos', tags: [] }), ['Procesos'])
  assert.deepEqual(publicationTags({ topic: 'Sin temática', tags: ['', '#sin tematica'] }), [])
  assert.equal(portalTagKey(tags[1]), 'comunicacion')
  assert.equal(new URL(portalTagLink(tags[3]), 'https://red.example').searchParams.get('tematica'), 'I+D / Áreas')
})

const item = (id, topic, date, authorId = 'one', status = 'publicado') => ({ id, topic, date, authorId, status })
const people = [{ id: 'one', name: 'Ana Ejemplo', ministry: 'Salud' }, { id: 'two', name: 'Ana Ejemplo', ministry: 'Cultura' }]

test('only published newsletters create groups; zero and one publication remain valid', () => {
  assert.deepEqual(groupNewsletters([], []), [])
  const groups = groupNewsletters([item('draft', 'Datos', '2026-11-20', 'one', 'borrador'), item('one', 'Procesos', '2026-11-01')], people)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].topic, 'Procesos')
  assert.equal(groups[0].items.length, 1)
  assert.equal(groups[0].authors.length, 1)
  assert.equal(groups[0].organisms, 1)
})

test('many publications sort groups by latest date and deduplicate actual author identities and organisms', () => {
  const items = Array.from({ length: 40 }, (_, i) => item(`p${i}`, 'Procesos', '2026-11-01', i % 2 ? 'one' : 'two'))
  items.push(item('newest', 'Datos', '2026-11-15'), item('old', 'Datos', '2026-10-01'))
  const originalOrder = items.map(item => item.id)
  const groups = groupNewsletters(items, people)
  assert.deepEqual(groups.map(group => group.topic), ['Datos', 'Procesos'])
  assert.equal(groups[0].latest, '2026-11-15')
  assert.equal(groups[1].items.length, 40)
  assert.equal(groups[1].authors.length, 2, 'same display name does not merge different authors')
  assert.equal(groups[1].organisms, 2)
  assert.deepEqual(items.map(item => item.id), originalOrder)
  assert.equal(publishedByDate(items)[0].id, 'newest')
})

test('unknown and blank topics remain reachable without schema changes or slug collisions', () => {
  const topic = 'I+D / Áreas & Equipos'
  assert.equal(new URL(topicLink(topic), 'https://red.example').searchParams.get('tematica'), topic)
  assert.equal(groupNewsletters([item('blank', '', '2026-11-01')], people)[0].topic, 'Sin temática')
  assert.equal(tematica(topic).color, '#0a5784')
  assert.equal(tematica('Innovación').color, tematica('Innovación pública').color)
  assert.notEqual(tematica('Datos').color, tematica('Procesos').color)
})
