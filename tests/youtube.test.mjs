import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicationVideoIds, youtubeVideoId } from '../src/utils/youtube.ts'

const id = 'M7lc1UVf-VE'

test('accepts YouTube watch, short, live and embed links', () => {
  for (const link of [
    `https://youtu.be/${id}?si=sample`, `https://www.youtube.com/watch?v=${id}&t=21`,
    `https://m.youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) assert.equal(youtubeVideoId(link), id)
})

test('rejects external lookalikes, non-video URLs and invalid IDs', () => {
  for (const link of [
    `https://youtu.be.example.org/${id}`, `https://example.org/watch?v=${id}`,
    `https://example.org@youtu.be/${id}`, `https://youtube.com:555/watch?v=${id}`,
    `https://youtube.com/redirect?v=${id}`, 'https://youtu.be/too-short', 'javascript:void(0)',
  ]) assert.equal(youtubeVideoId(link), null)
})

test('combines anchors and text links without duplicate players', () => {
  assert.deepEqual(publicationVideoIds(
    [`https://youtu.be/${id}`, 'https://example.org/video'],
    [`Mirá https://www.youtube.com/watch?v=${id}. Otro video (https://youtu.be/aqz-KE-bpKQ).`],
  ), [id, 'aqz-KE-bpKQ'])
})
