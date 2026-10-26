import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeLink, draftMailto, draftText, emailHref, parseMailto } from '../src/utils/emailCompose.ts'
import { candidateInvitation, invitationMailto } from '../src/utils/candidateInvitation.ts'

test('provider composers preserve recipients and Unicode invitation content without fixing the sender account', () => {
  const invitation=candidateInvitation('María Pérez','https://red.example.test')
  const draft=parseMailto(invitationMailto('maria+red@example.test',invitation))
  for (const provider of ['gmail','outlook','outlook-personal']) {
    const {href,requiresCopy}=composeLink(draft,provider),url=new URL(href)
    assert.equal(url.protocol,'https:');assert.equal(requiresCopy,false)
    assert.equal(url.searchParams.get('to'),'maria+red@example.test')
    assert.equal(url.searchParams.get(provider==='gmail'?'su':'subject'),invitation.subject)
    assert.equal(url.searchParams.get('body'),invitation.body)
    assert(!url.searchParams.has('authuser'));assert(!url.pathname.includes('/u/0'))
    assert.equal(url.host,{gmail:'mail.google.com',outlook:'outlook.office.com','outlook-personal':'outlook.live.com'}[provider])
  }
  assert.equal(draftText(draft),`Asunto: ${invitation.subject}\n\n${invitation.body}`)
  assert.deepEqual(parseMailto(draftMailto(draft)),draft)
})
test('RFC 6068 encoding preserves literal plus, reserved characters, accents and line breaks', () => {
  const href=emailHref('  user+tag#x@example.test  ',{subject:'Reunión + agenda & próximos pasos',body:'Hola, María:\n\n¿Nos reunimos? https://example.test/?a=1&b=2\n'})
  assert(href.includes('%20'));assert(href.includes('%2B'))
  const draft=parseMailto(href)
  assert.equal(draft.to[0],'user+tag#x@example.test');assert.equal(draft.subject,'Reunión + agenda & próximos pasos')
  assert.equal(draft.body,'Hola, María:\n\n¿Nos reunimos? https://example.test/?a=1&b=2\n')
  assert.equal(parseMailto('mailto:user+tag@example.test?subject=A+B').subject,'A+B')
})
test('multiple recipients, uppercase fields and cc/bcc survive all composers', () => {
  const draft=parseMailto('MAILTO:a@example.test,b@example.test?TO=c%2Btag%40example.test&CC=d%40example.test&BCC=e%40example.test&Subject=Hola&constructor=ignored&__proto__=ignored')
  assert.deepEqual(draft.to,['a@example.test','b@example.test','c+tag@example.test'])
  for (const provider of ['gmail','outlook','outlook-personal']) {
    const url=new URL(composeLink(draft,provider).href)
    assert.equal(url.searchParams.get('cc'),'d@example.test');assert.equal(url.searchParams.get('bcc'),'e@example.test')
    assert(!url.searchParams.has('constructor'));assert(!url.searchParams.has('__proto__'))
  }
  assert.deepEqual(parseMailto(draftMailto(draft)),draft)
})
test('malformed addresses, schemes and header injection are rejected instead of opening the system handler', () => {
  for (const href of ['https://example.test','javascript:alert(1)','mailto:','mailto:not-an-email','mailto:a@example.test%0Aevil@example.test','mailto:a@example.test?subject=Hola%0d%0aBcc:evil@example.test','mailto:%ZZ@example.test','mailto:a@example.test?body=%ZZ']) assert.throws(()=>parseMailto(href),Error)
  assert.deepEqual(parseMailto('mailto:?cc=cc@example.test').cc,['cc@example.test'])
  assert.throws(()=>parseMailto(emailHref('a@example.test?subject=unexpected')))
})
test('long messages require explicit copying and remain available in full', () => {
  const body='Información extensa con acentos y enlace https://example.test\n'.repeat(500)
  const draft=parseMailto(emailHref('destino@example.test',{subject:'Invitación',body}))
  for (const provider of ['gmail','outlook','outlook-personal']) {
    const result=composeLink(draft,provider),url=new URL(result.href)
    assert.equal(result.requiresCopy,true);assert(!url.searchParams.has('body'));assert(result.href.length<=7500)
    assert.equal(url.searchParams.get('to'),'destino@example.test')
  }
  assert(draftText(draft).endsWith(body));assert.equal(parseMailto(draftMailto(draft)).body,body)
})
