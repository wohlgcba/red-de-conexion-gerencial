import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { candidateId, reconcile, paginate, identity, isManager, assignment } from '../server/dotacion/model.ts'
import { parseFilters, createDotacionHandler } from '../server/dotacion/handler.ts'
import { connectionOptions, readCandidateContacts, readSource } from '../server/dotacion/source.ts'
import { CONTACT_FIELDS, sanitizeContacts } from '../server/dotacion/contacts.ts'
import { candidateInvitation, invitationMailto } from '../src/utils/candidateInvitation.ts'
import { DotacionError } from '../server/dotacion/errors.ts'
import { assertAdmin } from '../server/dotacion/supabase.ts'
import { rootCertificates } from 'node:tls'
import { X509Certificate } from 'node:crypto'
import { tlsOptions } from '../server/dotacion/tls.ts'

function key(n) { const base = `209999${String(n).padStart(4,'0')}`; let d=11-[5,4,3,2,7,6,5,4,3,2].reduce((s,w,i)=>s+w*Number(base[i]),0)%11;if(d===11)d=0;if(d===10)d=9;return base+d }
const person = (n, patch={}) => ({ id:`person-${n}`,name:`Persona ${n}`,identifier:key(n),role:'Gerente Operativo de Prueba',ministry:'Ministerio de Prueba',secretariat:'',directorate:'',active:true,exceptionActive:false,exceptionJustification:null,...patch })
const row = (n, patch={}) => ({ identifier:key(n),name:`Apellido ${n}, Nombre ${n}`,role:'Gerente Operativo de Prueba',ministry:'Ministerio de Prueba',unit:'Gerencia de Prueba',path:null,...patch })

test('online reconciliation preserves members, exceptions, multiple roles and private identities', () => {
  const directory=[person(1),person(2),person(3,{exceptionActive:true,exceptionJustification:'Funciones estratégicas verificadas'}),person(4),person(5,{identifier:null}),person(6)]
  const result=reconcile(directory,[row(1),row(2,{ministry:'Otro organismo'}),row(3,{role:'Analista'}),row(6),row(6,{role:'Asesor'}),row(7,{role:'Subgerente Operativo de Prueba'})],'test-secret')
  assert.equal(result.length,7)
  assert.deepEqual(result.slice(0,6).map(x=>x.status),['unchanged','changed','other_role','missing','pending','unchanged'])
  assert.deepEqual(result[1].changes,['Organismo'])
  assert.deepEqual(result[3].changes,[])
  assert.equal(result[2].exceptionActive,true)
  assert.equal(result[2].exceptionJustification,'Funciones estratégicas verificadas')
  assert.equal(result[5].current.length,2)
  assert.equal(result[6].status,'candidate')
  assert.equal(result[6].personId,null)
  assert.equal(result[6].membershipPending,true,'incomplete Directory cannot prove non-membership')
  assert.match(result[6].id,/^candidate-[a-f0-9]{32}$/)
  assert.notEqual(reconcile([], [row(7)],'other-secret')[0].id,result[6].id)
  assert.equal(reconcile([person(1),person(2,{identifier:key(1)})],[row(1)],'test')[0].status,'pending')
  const serialized=JSON.stringify(result)
  for(let n=1;n<=7;n++) assert.ok(!serialized.includes(key(n)))
  assert.ok(!serialized.includes('identifier'))
  assert.equal(reconcile([person(1)],[row(8)],'test')[1].membershipPending,false)
  assert.equal(reconcile([person(1)],[row(1,{role:''})],'test')[0].status,'pending')
  assert.equal(reconcile([person(1,{role:''})],[row(1)],'test')[0].status,'pending')
  assert.deepEqual(reconcile([person(1)],[row(1,{role:'Gerente Operativo de Innovación'})],'test')[0].changes,['Cargo'])
  assert.equal(reconcile([person(1,{secretariat:'Subsecretaría de Prueba',directorate:'Dirección General de Gestión'})],[row(1,{path:'Organismo\\Secretaría de Gobierno\\SS Prueba\\DG Gestión\\GO Prueba'})],'test')[0].status,'unchanged','known abbreviations and intermediate parent levels are not moves')
  const unresolved=reconcile([], [row(9,{identifier:'invalid'})], 'test')[0]
  assert.equal(unresolved.status,'pending');assert.equal(unresolved.membershipPending,true);assert.equal(unresolved.current.length,1)
  const page=paginate(result,parseFilters({query:'persona',exceptionsOnly:true}),new Date().toISOString(),[])
  assert.equal(page.total,1)
  assert.equal(page.counts.exceptions,1)
  assert.equal(page.counts.directory,6)
  assert.equal(page.sourceUpdatedAt,null,'query time is not source-update time')
  assert.equal(paginate(result,parseFilters({query:'nómbre 7',membership:'candidate'}),'now',[]).total,1)
})

test('manager classification, hierarchy availability, TLS and filter bounds', () => {
  assert.equal(isManager('SUBGERENTE OPERATIVO'),true)
  assert.equal(isManager('Gerenta General'),true)
  assert.equal(isManager('Asistente del Gerente Operativo'),false)
  assert.equal(isManager('Director General'),false)
  assert.equal(identity('123'),null)
  assert.equal(identity('00000000000'),null)
  assert.equal(identity(key(1)),key(1))
  assert.deepEqual(assignment(row(1)).secretariat,'')
  const value=assignment(row(1,{path:'Ministerio de Prueba|SS de Prueba|DG de Prueba|GO de Prueba'}))
  assert.equal(value.secretariat,'SS de Prueba'); assert.equal(value.directorate,'DG de Prueba');assert.equal(value.management,'GO de Prueba')
  const options=connectionOptions({DOTACION_DB_HOST:'localhost',DOTACION_DB_USER:'read_only',DOTACION_DB_PASSWORD:'synthetic',DOTACION_DB_NAME:'test'})
  assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.ssl.verifyIdentity,true);assert.equal(options.multipleStatements,false)
  assert.throws(()=>parseFilters({pageSize:100000}))
  assert.throws(()=>parseFilters({status:"'; DROP TABLE employees;"}))
  assert.throws(()=>parseFilters({exceptionsOnly:'false'}))
})

test('API verifies admin before any source access, returns only safe DTOs and fails closed', async t => {
  let accesses=0,sourceCalls=0,contactCalls=0,failed=false,alreadyMember=false
  const handler=createDotacionHandler({
    assertAdmin:async token => { accesses++; if(token!=='admin') throw new DotacionError(403,'forbidden','Acceso administrativo requerido'); return 'admin-id' },
    readDirectory:async()=>alreadyMember?[person(1),person(2)]:[person(1)],
    readSource:async()=> {sourceCalls++;if(failed)throw new Error('Sensitive database error '+key(1));return {rows:[row(1),row(2)],warnings:[]} },
    readCandidateContacts:async identifier=>{contactCalls++;assert.equal(identifier,key(2));return [{kind:'email',label:'Correo laboral',value:'candidate@example.test',sourceField:'MAIL_LABORAL'}]},
  },{DOTACION_ROW_KEY:'synthetic-secret'})
  const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close())
  const url=`http://127.0.0.1:${server.address().port}/api/admin-dotacion`
  const request=(token,body='{}',method='POST',headers={})=>fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},...(method==='POST'?{body}:{})})
  assert.equal((await fetch(url,{method:'POST',body:'{}'})).status,401)
  assert.equal(accesses,0);assert.equal(sourceCalls,0)
  assert.equal((await request('member')).status,403);assert.equal(sourceCalls,0)
  assert.equal((await request('admin','{}','GET')).status,405)
  assert.equal((await request('admin','{}','POST',{Origin:'https://unrelated.test'})).status,403)
  assert.equal((await request('admin','invalid json')).status,400)
  assert.equal((await request('admin',JSON.stringify({pageSize:1000}))).status,400)
  assert.equal((await request('admin',JSON.stringify({query:'x'.repeat(5000)}))).status,413)
  const ok=await request('admin');assert.equal(ok.status,200)
  assert.equal(ok.headers.get('cache-control'),'private, no-store, max-age=0')
  const data=await ok.json();assert.equal(data.total,2);assert.equal(data.counts.candidate,1)
  assert.equal(contactCalls,0);assert.ok(!JSON.stringify(data).includes('candidate@example.test'))
  assert.ok(!JSON.stringify(data).includes(key(1)));assert.ok(!JSON.stringify(data).includes(key(2)))
  const contactBody=JSON.stringify({action:'contacts',candidateId:candidateId(key(2),'synthetic-secret')})
  assert.equal((await request('member',contactBody)).status,403);assert.equal(contactCalls,0)
  assert.equal((await request('admin',JSON.stringify({action:'contacts',candidateId:key(2)}))).status,400);assert.equal(contactCalls,0)
  assert.equal((await request('admin',JSON.stringify({action:'contacts',candidateId:candidateId(key(99),'synthetic-secret')}))).status,404);assert.equal(contactCalls,0)
  const contactResponse=await request('admin',contactBody);assert.equal(contactResponse.status,200)
  assert.equal(contactResponse.headers.get('cache-control'),'private, no-store, max-age=0')
  const contactData=await contactResponse.json();assert.equal(contactData.contacts[0].value,'candidate@example.test')
  assert.ok(!JSON.stringify(contactData).includes(key(2)));assert.equal(contactCalls,1)
  alreadyMember=true;assert.equal((await request('admin',contactBody)).status,404);assert.equal(contactCalls,1,'no candidate contact if already added to Directory')
  failed=true
  const unavailable=await request('admin');assert.equal(unavailable.status,500)
  const safe=await unavailable.json();assert.ok(!JSON.stringify(safe).includes(key(1)));assert.equal(safe.rows,undefined)
})

test('candidate contacts prioritize work mail, deduplicate sources and reject invalid data', () => {
  const rows=[{MAIL_LABORAL:'WORK@example.test; work@example.test',MAIL_MIA:'work@example.test',MAIL_PERSONAL:'personal@example.test',TELEFONO:'(11) 4444-5555',FEC_NACIM:'not-allowed'},
    {MAIL_LABORAL:'javascript:alert(1)',MAIL_PERSONAL:'invalid text',CELULAR:'00000000'}]
  const contacts=sanitizeContacts(rows,[...CONTACT_FIELDS])
  assert.deepEqual(contacts.map(x=>x.value),['work@example.test','personal@example.test','(11) 4444-5555'])
  assert.equal(contacts[0].label,'Correo laboral');assert.equal(contacts[1].label,'Correo personal')
  assert.ok(!JSON.stringify(contacts).includes('FEC_NACIM'))
  assert.deepEqual(sanitizeContacts([{MAIL_LABORAL:null,MAIL_PERSONAL:'nan',TELEFONO:'No informado'}],[...CONTACT_FIELDS]),[])
})

test('invitation uses the existing intake form and composes mail without sending or bypassing approval', () => {
  const invitation=candidateInvitation('Persona Ejemplo','https://red.example.test')
  assert.equal(invitation.formUrl,'https://red.example.test/solicitar-acceso')
  assert.ok(invitation.body.includes('Persona Ejemplo'))
  assert.ok(invitation.body.includes('contraseña actual'))
  assert.ok(invitation.body.includes('revisada por la administración'))
  const url=new URL(invitationMailto('work@example.test',invitation))
  assert.equal(url.protocol,'mailto:');assert.equal(decodeURIComponent(url.pathname),'work@example.test')
  assert.equal(url.searchParams.get('body'),invitation.body)
  assert.equal(url.searchParams.get('subject'),invitation.subject)
  assert.ok(!invitation.formUrl.includes('?'),'no identity or automatic-access token in public invitation')
})

test('candidate contact SQL selects only available contact fields for exactly one validated key',async()=>{
  const calls=[];let closed=false
  const fake={
    query:async options=>{
      calls.push(options)
      if(options.sql.startsWith('SHOW SESSION'))return [[{Value:'TLS_AES_256_GCM_SHA384'}]]
      if(options.sql.startsWith('SHOW COLUMNS'))return [[...['CUIL_SIN_GUIONES','AYN','MINISTERIO','LIT_PUESTO','DESC_REP','MAIL_LABORAL','MAIL_PERSONAL'].map(Field=>({Field}))]]
      if(options.sql.startsWith('SELECT COUNT'))return [[{total:200000}]]
      return [[]]
    },
    execute:async(options,values)=>{calls.push({...options,values});return [options.sql.startsWith('SELECT ENGINE')?[{engine:'InnoDB'}]:[{MAIL_LABORAL:'work@example.test',MAIL_PERSONAL:null}]]},
    commit:async()=>{},destroy:()=>{closed=true},
  }
  const env={DOTACION_DB_HOST:'localhost',DOTACION_DB_USER:'read_only',DOTACION_DB_PASSWORD:'synthetic',DOTACION_DB_NAME:'test'}
  const result=await readCandidateContacts(key(2),env,async()=>fake)
  assert.equal(result[0].value,'work@example.test');assert.equal(closed,true)
  const query=calls.find(x=>x.sql.startsWith('SELECT DISTINCT'))
  assert.deepEqual(query.values,[key(2)]);assert.ok(query.sql.includes(' = ? AND '))
  assert.ok(query.sql.includes('MAIL_LABORAL'));assert.ok(!query.sql.includes('MAIL_MIA'))
  assert.ok(!/FEC_NACIM|INGRESO|SELECT \*|AYN/.test(query.sql))
  assert.ok(!query.sql.includes(key(2)))
  let connected=false
  await assert.rejects(()=>readCandidateContacts('invalid',env,async()=>{connected=true;return fake}),{code:'candidate_unavailable'})
  assert.equal(connected,false)
})

test('Supabase authorization checks the remote session and actual admin RPC', async t => {
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original})
  const calls=[];let admin=false,valid=true
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/user')?{id:'trusted-user'}:admin),{status:valid?200:401})}
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'synthetic'}
  await assert.rejects(()=>assertAdmin('user-token',env),{status:403})
  assert.equal(calls[1].options.headers['Content-Profile'],'red_conexion_gerencial')
  admin=true;assert.equal(await assertAdmin('user-token',env),'trusted-user')
  valid=false;await assert.rejects(()=>assertAdmin('user-token',env),{status:401})
})

test('client dependency graph never references server secrets or MySQL',async()=>{
  const client=await readFile(new URL('../src/services/dotacion.ts',import.meta.url),'utf8')
  assert.ok(!/mysql|SERVICE_ROLE|DB_PASSWORD/.test(client))
})

test('private-CA mode requires an exact CA pin and endpoint while preserving chain verification', () => {
  const ca = rootCertificates[0]
  const fingerprint = new X509Certificate(ca).fingerprint256
  const env = { DOTACION_DB_TLS_MODE:'private-ca', DOTACION_DB_CA:ca, DOTACION_DB_CA_SHA256:fingerprint, DOTACION_DB_CA_ENDPOINT:'source.example.test:3307' }
  const options=tlsOptions(env,'source.example.test',3307)
  assert.equal(options.rejectUnauthorized,true);assert.equal(options.verifyIdentity,false)
  assert.equal(options.minVersion,'TLSv1.2')
  assert.throws(()=>tlsOptions({...env,DOTACION_DB_CA_SHA256:'00'.repeat(32)},'source.example.test',3307))
  assert.throws(()=>tlsOptions({...env,DOTACION_DB_CA:''},'source.example.test',3307))
  assert.throws(()=>tlsOptions({...env,DOTACION_DB_CA:ca+'\n'+rootCertificates[1]},'source.example.test',3307),'un-pinned additional roots cannot sneak into the CA bundle')
  assert.throws(()=>tlsOptions(env,'other.example.test',3307))
  assert.throws(()=>tlsOptions({...env,DOTACION_DB_TLS_MODE:'insecure'},'source.example.test',3307))
})

test('source projects institutional fields only, binds keys, filters managers in SQL and discards partial failures',async()=>{
  const calls=[];let destroyed=0,broken=false
  const fake={
    query:async options=>{
      calls.push(options)
      if(options.sql.startsWith('SHOW SESSION'))return [[{Value:'TLS_AES_256_GCM_SHA384'}]]
      if(options.sql.startsWith('SHOW COLUMNS'))return [[...['CUIL_SIN_GUIONES','AYN','MINISTERIO','LIT_PUESTO','DESC_REP','PATH_NOMBRES'].map(Field=>({Field}))]]
      if(options.sql.startsWith('SELECT COUNT'))return [[{total:200000}]]
      if(options.sql.startsWith('SELECT')) {if(broken)throw new Error('private SQL error');return [[row(2)]]}
      return [[]]
    },
    execute:async(options,values)=>{calls.push({...options,values});return [options.sql.startsWith('SELECT ENGINE')?[{engine:'InnoDB'}]:[row(1)]]},
    commit:async()=>{},destroy:()=>{destroyed++},
  }
  const env={DOTACION_DB_HOST:'localhost',DOTACION_DB_USER:'read_only',DOTACION_DB_PASSWORD:'synthetic',DOTACION_DB_NAME:'test'}
  const result=await readSource([key(1)],env,async()=>fake)
  assert.equal(result.rows.length,2)
  const lookup=calls.find(x=>x.sql.includes(' IN ('))
  assert.deepEqual(lookup.values,[key(1)]);assert.ok(!lookup.sql.includes(key(1)));assert.ok(lookup.sql.includes(' IN (?)'))
  assert.ok(calls.some(x=>x.sql.includes("REGEXP '^(SUB)?GERENT[EA]")))
  assert.ok(calls.some(x=>x.sql==='START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY'))
  for(const call of calls) assert.ok(!/MAIL_|FEC_NACIM|INGRESO|SELECT \*/.test(call.sql))
  assert.equal(destroyed,1)
  broken=true
  await assert.rejects(()=>readSource([key(1)],env,async()=>fake),error=>error.code==='source_unavailable'&&!error.message.includes('SQL error'))
  assert.equal(destroyed,2)
  const noTLS={...fake,query:async()=>[[{Value:''}]]}
  await assert.rejects(()=>readSource([],env,async()=>noTLS),{code:'tls'})
  const updating={...fake,query:async options=>options.sql.startsWith('SELECT COUNT')?[[{total:0}]]:fake.query(options)}
  await assert.rejects(()=>readSource([key(1)],env,async()=>updating),{code:'source_updating'})
})
