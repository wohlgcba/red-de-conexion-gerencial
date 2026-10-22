import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'

const sql = name => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8')
const id = n => `30000000-0000-4000-8000-${String(n).padStart(12,'0')}`
function key(n) { const base=`209999${String(n).padStart(4,'0')}`; let d=11-[5,4,3,2,7,6,5,4,3,2].reduce((s,w,i)=>s+w*Number(base[i]),0)%11; if(d===11)d=0;if(d===10)d=9;return base+d }

test('authority migration, guarded reconciliation, manual review, renames and privacy', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create role authenticated; create role anon; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`)
  for (const file of ['red_conexion_gerencial.sql','rcg_crud.sql','rcg_user_accounts.sql','rcg_organization.sql','rcg_administration.sql']) await db.exec(await sql(file))
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${id(1)}','admin@example.test',now()),('${id(2)}','outsider@example.test',now());
   insert into red_conexion_gerencial.admin_users(user_id,email) values('${id(1)}','admin@example.test');`)
  const actor = async (n,role='authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']); await db.exec(`set role ${role}`) }
  const rpc = async (name,args=[]) => (await db.query(`select red_conexion_gerencial.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0]?.value
  const root = { id:id(10),parent_id:null,name:'Ministerio de Prueba',unit_type:'Organismo',code:'01' }
  const unit = { id:id(11),parent_id:id(10),name:'GO Anterior',unit_type:'Gerencia Operativa',code:'08010000' }
  for (const u of [root,unit]) await db.query('insert into red_conexion_gerencial.organization_units(id,parent_id,name,unit_type,code,source_key) values($1,$2,$3,$4,$5,$6)',[u.id,u.parent_id,u.name,u.unit_type,u.code,u.id])
  // Existing manual holder in a third office must survive later automatic imports.
  const manualUnit = { ...unit,id:id(12),name:'GO Manual',code:'02' }
  await db.query('insert into red_conexion_gerencial.organization_units(id,parent_id,name,unit_type,code,source_key) values($1,$2,$3,$4,$5,$6)',[manualUnit.id,manualUnit.parent_id,manualUnit.name,manualUnit.unit_type,manualUnit.code,manualUnit.id])
  await db.query("insert into rcg_private.organization_people(id,link_key,institutional_name,verified_at) values($1,$2,'Titular Manual',now())",[id(20),key(20)])
  await db.query("insert into rcg_private.organization_assignments(id,unit_id,responsible_id,position_title,responsibility_confirmed,verification_basis) values($1,$2,$3,'Gerente Operativo/a',true,'Confirmación humana por norma')",[id(30),manualUnit.id,id(20)])
  const migration = await sql('rcg_organization_authorities.sql')
  await db.exec(migration); await db.exec(migration)
  await actor(2); await assert.rejects(()=>rpc('get_organization_chart'),/autorizado/)
  await assert.rejects(()=>rpc('admin_organization_authorities'),/denegado/)
  await assert.rejects(()=>db.query('select * from rcg_private.organization_authority_audit'))
  await actor(null,'anon'); await assert.rejects(()=>rpc('admin_organization_authorities'))
  await actor(1)
  assert.equal((await rpc('get_organization_chart')).responsibilities[0].identificationStatus,'manual')
  const day = (await db.query("select current_date::text as day,to_char(current_date,'YYYY-MM') as period")).rows[0]
  const candidate = { key:key(21),name:'Persona Sintética',role:'GERENTE OPERATIVO',institutional_role:'Gerente Operativo/a',confidence:'high',method:'code_numeric_equivalent',source:'Dotación institucional',source_period:day.period,official:false,since:null,until:null,reason:'Código, organismo y trayectoria verificados' }
  const results = [
    {unit_id:root.id,status:'unidentified',reason:'Sin titular',winner:null,candidates:[],expected:true},
    {unit_id:unit.id,status:'automatic',reason:'Coincidencia verificada',winner:candidate,candidates:[{...candidate,confidence:'medium'},candidate],expected:true,rename:{name:'GO Nueva',evidence:'PDF institucional de prueba, misma dependencia; confirmar continuidad'}},
    {unit_id:manualUnit.id,status:'pending',reason:'Cambio detectado en fuente institucional',winner:null,candidates:[{...candidate,key:key(22),name:'Otra Persona'}],expected:true},
  ]
  const buildSQL = (units=[root,unit,manualUnit], selectedResults=results) => {
    const data={as_of:day.day,period:day.period,source_sha256:'synthetic-test',results:selectedResults}
    const result = spawnSync('python',['-c',"import json,sys; sys.path.insert(0,'scripts'); from stage_authorities import build; x=json.load(sys.stdin); print(build(x['data'],x['snapshot']))"],{input:JSON.stringify({data,snapshot:{units}}),encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'},maxBuffer:4e6})
    assert.equal(result.status,0,result.stderr); return result.stdout
  }
  await db.exec('reset role')
  await db.exec(buildSQL())
  await actor(1)
  let chart = await rpc('get_organization_chart')
  assert.equal(chart.units.length,3); assert.equal(chart.responsibilities.length,2)
  const holder = chart.responsibilities.find(a=>a.unitId===unit.id)
  assert.equal(holder.confidence,'high','best evidence is staged before duplicate rows')
  assert.equal(holder.membership,'non_member'); assert.equal(holder.personId,null)
  assert.equal(chart.units.find(u=>u.id===unit.id).name,'GO Anterior','a proposal never renames automatically')
  assert.equal(chart.units.find(u=>u.id===manualUnit.id).identificationStatus,'manual')
  assert(!JSON.stringify(chart).includes(key(21))); assert(!JSON.stringify(chart).includes('link_key')); assert(!JSON.stringify(chart).includes('email'))
  let page = await rpc('admin_organization_authorities',['','renamed',1,25])
  assert.equal(page.total,1); let u=page.rows[0]
  assert.equal(u.proposedName,'GO Nueva'); assert.equal(u.version,2)
  assert(!JSON.stringify(page).includes(key(21)))
  const review = (version=u.version,assignment=holder.id,state='manual',note='Titularidad corroborada mediante documento institucional',evidence='PDF institucional de prueba',rename=true) => rpc('admin_review_authority',[unit.id,version,assignment,state,note,evidence,rename])
  await assert.rejects(()=>review(u.version,id(30)),/candidato/,'candidate must belong to the same unit')
  await assert.rejects(()=>review(u.version,holder.id,'vacant','corto'),/justificación/)
  await review()
  await assert.rejects(()=>review(),/cambió/,'stale review is rejected')
  chart=await rpc('get_organization_chart')
  const renamed=chart.units.find(v=>v.id===unit.id)
  assert.equal(renamed.name,'GO Nueva'); assert.deepEqual(renamed.aliases,['GO Anterior'])
  assert.equal(renamed.parentId,root.id); assert.equal(renamed.code,'08010000'); assert.equal(renamed.identificationStatus,'manual')
  assert.equal((await rpc('admin_organization_authorities',['','manual',1,25])).total,2)
  await db.exec('reset role')
  assert.equal((await db.query('select count(*)::int as n from red_conexion_gerencial.people')).rows[0].n,0,'reconciliation never creates members')
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,2,'reconciliation never creates accounts')
  assert.equal((await db.query('select count(*)::int as n from rcg_private.organization_authority_audit')).rows[0].n,4)
  // A stale structure/version aborts the complete transaction.
  await assert.rejects(()=>db.exec(buildSQL()),/estructura cambió/); await db.exec('rollback')
  // A persisted no-holder manual decision also survives subsequent reconciliation.
  await actor(1)
  const current=(await rpc('admin_organization_authorities',['GO Nueva','',1,25])).rows[0]
  await rpc('admin_review_authority',[unit.id,current.version,null,'not_applicable','Unidad presupuestaria sin titular individual según norma de prueba','Norma sintética verificable',false])
  await db.exec('reset role')
  const freshUnits=(await db.query('select * from red_conexion_gerencial.organization_units')).rows
  await db.exec(buildSQL(freshUnits))
  await actor(1); chart=await rpc('get_organization_chart')
  assert.equal(chart.units.find(v=>v.id===unit.id).identificationStatus,'not_applicable')
  assert(!chart.responsibilities.some(v=>v.unitId===unit.id))
  // Expired evidence returns the unit to pending in the displayed chart.
  await db.exec('reset role')
  await db.query("update rcg_private.organization_assignments set assignment_origin='automatic',responsibility_confirmed=true,evidence_until=current_date-1 where id=$1",[holder.id])
  await db.query("update red_conexion_gerencial.organization_units set authority_status='automatic' where id=$1",[unit.id])
  await actor(1); chart=await rpc('get_organization_chart')
  assert.equal(chart.units.find(v=>v.id===unit.id).identificationStatus,'pending')
  assert(!chart.responsibilities.some(v=>v.unitId===unit.id))
  assert((await rpc('admin_organization_authorities',['GO Nueva','pending',1,25])).rows.some(v=>v.id===unit.id),'administration also shows expired evidence as pending')
  // Even an identifier pasted into a manual note never enters the public DTO.
  await db.exec('reset role')
  await db.query("update red_conexion_gerencial.organization_units set authority_reason=$1 where id=$2",['Evidencia sintética '+key(21),unit.id])
  await db.query("update rcg_private.organization_assignments set verification_basis=$1 where id=$2",['Referencia '+key(21),holder.id])
  await actor(1)
  assert(!JSON.stringify(await rpc('get_organization_chart')).includes(key(21)))
  assert(!JSON.stringify(await rpc('admin_organization_authorities',['','',1,25])).includes(key(21)))
  // Only an active, backend-verified member gets a profile reference.
  await db.exec('reset role')
  await db.query("insert into red_conexion_gerencial.people(id,given_name,family_name,position_title,ministry,email,phone) values($1,'Titular','Manual','Gerente','Prueba','private-member@example.test','555')",[id(40)])
  await db.query("insert into rcg_private.directory_link_keys(link_key,person_id,verified_at,verification_basis) values($1,$2,now(),'Identidad sintética verificada')",[key(20),id(40)])
  await db.query("update rcg_private.organization_people set reconciliation_status='member',person_id=$1,verification_basis='Identidad sintética verificada' where id=$2",[id(40),id(20)])
  await actor(1); chart=await rpc('get_organization_chart')
  let linked=chart.responsibilities.find(a=>a.unitId===manualUnit.id)
  assert.equal(linked.membership,'member');assert.equal(linked.personId,id(40))
  assert(!JSON.stringify(chart).includes('private-member@example.test'));assert(!JSON.stringify(chart).includes('555'))
  await db.exec('reset role');await db.query('update red_conexion_gerencial.people set is_active=false where id=$1',[id(40)])
  await actor(1); linked=(await rpc('get_organization_chart')).responsibilities.find(a=>a.unitId===manualUnit.id)
  assert.equal(linked.membership,'pending');assert.equal(linked.personId,null)
})
