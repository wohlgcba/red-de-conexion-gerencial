import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createIntakeHandler, verifyApplicant } from '../server/intake/handler.ts'
import { DotacionError } from '../server/dotacion/errors.ts'
import { savedIntakeProfile, saveSource } from '../server/dotacion/snapshot.ts'
import { reconcile } from '../server/dotacion/model.ts'

const key='20999900020'
test('intake authenticates the chosen verified mailbox before reading a private cached profile', async t=>{
  let calls=0
  const handler=createIntakeHandler({verifyApplicant:async(token,email)=>{
    if(token!=='owner'||email!=='owner@example.test') throw new DotacionError(403,'identity','Correo no verificado para esta sesión')
    return 'owner-id'
  },readIntakeProfile:async(identifier,email,env,userId)=>{
    calls++;assert.equal(identifier,key);assert.equal(email,'owner@example.test');assert.equal(userId,'owner-id')
    return {outcome:'matched',profiles:[{given:'Nombre',family:'Prueba',role:'Gerente Operativo',ministry:'Organismo de prueba',secretariat:'',directorate:'',unit:''}]}
  }},{})
  const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close())
  const url=`http://127.0.0.1:${server.address().port}`
  const request=(token,email='owner@example.test',identifier=key)=>fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({email,identifier})})
  assert.equal((await request('wrong')).status,403);assert.equal(calls,0)
  assert.equal((await request('owner','unrelated@example.test')).status,403);assert.equal(calls,0)
  assert.equal((await request('owner','owner@example.test','123')).status,400);assert.equal(calls,0)
  const response=await request('owner');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/)
  const result=await response.text();assert(!result.includes(key));assert(!result.includes('owner@example.test'));assert.equal(calls,1)
})
test('remote Auth verification refuses an unconfirmed or mismatching account',async t=>{
  const previous=global.fetch;t.after(()=>global.fetch=previous)
  let confirmed=false
  global.fetch=async()=>Response.json({id:'owner-id',email:'owner@example.test',email_confirmed_at:confirmed?'2026-10-01':null})
  const env={VITE_SUPABASE_URL:'https://example.test',VITE_SUPABASE_PUBLISHABLE_KEY:'public'}
  await assert.rejects(()=>verifyApplicant('token','owner@example.test',env),/verificá/i)
  confirmed=true
  await assert.rejects(()=>verifyApplicant('token','unrelated@example.test',env),/otro correo/)
  assert.equal(await verifyApplicant('token','owner@example.test',env),'owner-id')
})
test('cache uses service-only RPCs, returns editable data, and excludes arbitrary personal fields',async t=>{
  const previous=global.fetch;t.after(()=>global.fetch=previous)
  const calls=[]
  const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'}
  const row={identifier:key,name:'Apellido, Nombre',role:'Gerente Operativo',ministry:'Organismo de prueba',unit:'GO Prueba',path:'Organismo|SS Prueba|DG Prueba|GO Prueba',birthDate:'must-not-persist'}
  global.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(url.endsWith('server_gerencial_intake')?[row]:null)}
  const result=await savedIntakeProfile(key,'owner@example.test',env,'owner-id')
  assert.equal(result.profiles[0].given,'Nombre');assert.equal(result.profiles[0].family,'Apellido');assert.equal(result.profiles[0].directorate,'DG Prueba')
  assert(!JSON.stringify(result).includes(key));assert(!JSON.stringify(result).includes('birthDate'))
  await saveSource('admin-id',{rows:[row,row],warnings:[]},[],new Date().toISOString(),env)
  assert.equal(calls[1].body.p_people[0].rows.length,1)
  assert(!JSON.stringify(calls[1].body).includes('birthDate'))
  await assert.rejects(()=>saveSource('admin-id',{rows:[{...row,role:'Analista'}],warnings:[]},[],new Date().toISOString(),env),/autorizado/)
  assert.equal(calls.length,2,'out-of-scope import never reaches Supabase')
  const directory=[{id:'new-profile',name:'Ejemplo',identifier:key,role:'Gerente',ministry:'Organismo',secretariat:'',directorate:'',active:true,exceptionActive:false,exceptionJustification:null}]
  assert.equal(reconcile(directory,[],'secret',[])[0].status,'pending','new profiles are not falsely marked absent before refresh')
  assert.equal(reconcile(directory,[],'secret',[key])[0].status,'missing')
})
