import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const uid=n=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`
// Synthetic CUIT/CUIL with valid checksums. No real Dotación data.
function key(n){const base=`209999${String(n).padStart(4,'0')}`;let d=11-[5,4,3,2,7,6,5,4,3,2].reduce((s,w,i)=>s+w*Number(base[i]),0)%11;if(d===11)d=0;if(d===10)d=9;return base+d}
const migration=name=>readFile(new URL(`../supabase/${name}`,import.meta.url),'utf8')
test('usage metrics: activity recording, history backfill, aggregates, filters and permissions',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,last_sign_in_at timestamptz,raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`)
 for(const name of ['red_conexion_gerencial.sql','rcg_crud.sql','rcg_user_accounts.sql','rcg_organization.sql','rcg_administration.sql','rcg_administration_intake.sql','rcg_admin_newsletters.sql','rcg_newsletter_rich_text.sql','rcg_newsletter_reactions.sql','rcg_gerencial_snapshot.sql'])await db.exec(await migration(name))
 for(let n=1;n<=7;n++)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid(n),`metricas${n}@example.test`])
 await db.query('insert into red_conexion_gerencial.admin_users(user_id,email) values($1,$2)',[uid(1),'metricas1@example.test'])
 const person=(n,title,registered,sheet='Test',active=true)=>db.query('insert into red_conexion_gerencial.people(id,given_name,family_name,position_title,ministry,email,source_sheet,source_registered_at,phone,is_active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
  [uid(n),`Persona${n}`,`Apellido${n}`,title,'Organismo de prueba',`metricas${n}@example.test`,sheet,registered,'',active])
 await person(2,'Gerente Operativo de Datos','2025-07-28 10:00')
 await person(3,'Subgerente de Proyectos','2026-04-10 09:00')
 await person(4,'GO de Planeamiento',null)
 await person(5,'Directora de Área','2026-04-12 12:00')
 await person(6,'Gerenta de Prueba (MOCK)',null,'RCG_MOCK_TEST_USERS_V1')
 await person(7,'Sub gerente sin baja auditada','2025-08-01 08:00','Test',false)
 for(const n of [2,3,4,6])await db.query('insert into red_conexion_gerencial.member_accounts(person_id,auth_user_id,must_change_password) values($1,$1,$2)',[uid(n),n===4])
 await db.query(`update auth.users set raw_app_meta_data='{"rcg_initial_cuit":"true"}',last_sign_in_at='2026-10-15 15:00+00' where id=$1`,[uid(4)])
 await db.query(`update auth.users set last_sign_in_at='2026-10-16 15:00+00' where id=$1`,[uid(3)]) // Shared Hub account: not evidence.
 const published=(await db.query("insert into red_conexion_gerencial.newsletters(author_id,title,topic,body,status,published_at) values($1,'Más leído','Gestión','Texto','publicado',now()) returning id",[uid(2)])).rows[0].id
 const other=(await db.query("insert into red_conexion_gerencial.newsletters(author_id,title,topic,body,status,published_at) values($1,'Menos leído','Datos','Texto','publicado',now()) returning id",[uid(2)])).rows[0].id
 const draft=(await db.query("insert into red_conexion_gerencial.newsletters(author_id,title,topic,body,status) values($1,'Borrador','Datos','Texto','borrador') returning id",[uid(2)])).rows[0].id
 await db.query("insert into red_conexion_gerencial.newsletter_reactions(newsletter_id,user_id,reaction,created_at) values($1,$2,'like','2026-10-20 13:00+00')",[published,uid(2)])

 const metrics=await migration('rcg_metrics.sql');await db.exec(metrics);await db.exec(metrics)
 const level=async title=>(await db.query('select rcg_private.position_level($1) as v',[title])).rows[0].v
 for(const [title,expected] of [['Gerente Operativo','gerente'],['GERENTA de Datos','gerente'],['GO de Compras','gerente'],['Gerencia Operativa X','gerente'],['Subgerente','subgerente'],['Sub gerente','subgerente'],['Sub-gerente','subgerente'],['SGO Legales','subgerente'],['Sugerente Operativo','subgerente'],['Subegerente Operativo','subgerente'],['Gobierno abierto','otro'],['Director General','otro'],['','otro']])assert.equal(await level(title),expected,title)
 const history=(await db.query("select person_id,kind,newsletter_id,source from rcg_private.member_activity order by person_id,kind")).rows
 assert.deepEqual(history.map(r=>[r.person_id,r.kind,r.newsletter_id]),[[uid(2),'newsletter',published],[uid(2),'visit',null],[uid(4),'visit',null]])
 assert(history.every(r=>r.source==='history'))

 const actor=async(n,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);await db.exec(`set role ${role}`)}
 const rpc=async(name,args=[])=>(await db.query(`select red_conexion_gerencial.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value
 await actor(null);await assert.rejects(()=>rpc('record_activity',['visit',null]),/denegado/)
 await actor(3)
 await rpc('record_activity',['visit',null]);await rpc('record_activity',['visit',null])
 await rpc('record_activity',['newsletters',null]);await rpc('record_activity',['newsletter',published]);await rpc('record_activity',['newsletter',published])
 await rpc('record_activity',['newsletter',draft])
 await assert.rejects(()=>rpc('record_activity',['newsletter',null]),/inválida/)
 await assert.rejects(()=>rpc('record_activity',['admin',null]),/inválida/)
 await assert.rejects(()=>rpc('record_activity',['profile',null]),/inválida/)
 await rpc('record_activity',['profile',uid(2)]);await rpc('record_activity',['profile',uid(2)]);await rpc('record_activity',['profile',uid(3)]) // Own profile is ignored.
 await rpc('record_search',['  Datos   Abiertos ',0]);await rpc('record_search',['datos abiertos',0]);await rpc('record_search',['x',4]);await rpc('record_search',['Gestión',2])
 await assert.rejects(()=>db.query('select * from rcg_private.directory_searches'))
 await assert.rejects(()=>db.query('select * from rcg_private.member_activity'))
 await assert.rejects(()=>rpc('admin_metrics',['month']),/denegado/)
 await assert.rejects(()=>rpc('admin_metrics_people',[{}]),/denegado/)
 await actor(4);await rpc('record_activity',['visit',null]) // Pending password change: still a first entry.
 await assert.rejects(()=>rpc('record_activity',['newsletters',null]),/denegado/)
 await assert.rejects(()=>rpc('record_search',['datos',1]),/denegado/)
 await actor(6);await rpc('record_activity',['newsletter',other])
 await actor(1);await rpc('record_activity',['visit',null]) // Administrator without a Directory profile.
 await db.exec('reset role')
 const rows=(await db.query('select person_id,kind,newsletter_id,hits from rcg_private.member_activity where source=$1 order by person_id,kind',['app'])).rows
 assert.deepEqual(rows.map(r=>[r.person_id,r.kind,r.newsletter_id,r.hits]),[[uid(3),'newsletter',published,2],[uid(3),'newsletters',null,1],[uid(3),'profile',null,2],[uid(3),'search',null,2],[uid(3),'visit',null,2],[uid(4),'visit',null,1],[uid(6),'newsletter',other,1]])

 await actor(1)
 await assert.rejects(()=>rpc('admin_metrics',['year']),/inválido/)
 const month=await rpc('admin_metrics',['month'])
 assert.deepEqual(month.summary,{members:4,gerentes:2,subgerentes:1,otros:1,withAccount:3,entered:3,newsletterVisitors:2,newsletterReaders:2,newsletterViews:3,publishedNewsletters:2,directoryUsers:1,searches:2,emptySearches:1,profileViews:2})
 assert.deepEqual(month.directory.topTerms.map(t=>[t.term,t.searches,t.results]),[['datos abiertos',1,0],['gestión',1,2]])
 assert.deepEqual(month.directory.emptyTerms.map(t=>t.term),['datos abiertos'])
 assert.deepEqual(month.directory.topProfiles.map(t=>[t.id,t.views,t.viewers]),[[uid(2),2,1]])
 assert.equal(month.coverage,null,'no Dotación snapshot yet')
 assert.equal(month.growth[0].starts,'2025-07-01');assert.equal(month.growth[0].gerente,1);assert.equal(month.growth[0].joined,1)
 assert.equal(month.growth.find(b=>b.starts==='2025-08-01').subgerente,0,'inactive people without a departure date are excluded')
 const april=month.growth.find(b=>b.starts==='2026-04-01');assert.equal(april.joined,2);assert.equal(april.subgerente,1);assert.equal(april.otro,1)
 const last=month.growth.at(-1);assert.equal(last.gerente+last.subgerente+last.otro,4)
 assert.equal(month.activity.length,month.growth.length)
 assert.equal(month.activity.find(b=>b.starts==='2026-10-01').visitors,2)
 assert.deepEqual(month.newsletters.map(n=>[n.title,n.readers,n.views,n.reactions]),[['Más leído',2,3,1],['Menos leído',0,0,0]],'mock readers are excluded')
 assert(month.trackingSince)
 assert.equal((await rpc('admin_metrics',['day'])).growth.length,30)
 const week=await rpc('admin_metrics',['week']);assert.equal(week.growth.length,26);assert.equal(new Date(`${week.growth[0].starts}T12:00Z`).getUTCDay(),1)
 assert.equal(week.activity.at(-1).visitors,2)

 const people=filters=>rpc('admin_metrics_people',[filters])
 const never=await people({status:'never'})
 assert.deepEqual(never.rows.map(r=>[r.name,r.account,r.level]),[['Persona5 Apellido5','none','otro']])
 assert.deepEqual(never.counts,{all:4,never:1,entered:3})
 const entered=await people({status:'entered',sort:'recent'})
 assert.deepEqual(entered.rows.map(r=>r.id).sort(),[uid(2),uid(3),uid(4)].sort())
 assert.equal(entered.rows.find(r=>r.id===uid(4)).account,'pending_password')
 assert.equal(entered.rows.find(r=>r.id===uid(3)).newslettersRead,1)
 assert.equal((await people({level:'gerente'})).total,2)
 assert.equal((await people({query:'planeamiento'})).rows[0].id,uid(4))
 assert.equal((await people({pageSize:2,page:2})).rows.length,2)
 assert.equal((await people({export:true,pageSize:1})).rows.length,4)
 await assert.rejects(()=>people({status:'todos'}),/filtros/)
 assert.equal(entered.rows.find(r=>r.id===uid(3)).directoryUses,4)
 // Coverage: Dotación managers in the saved snapshot that are active Red members, by CUIT/CUIL.
 await db.exec('reset role')
 await db.query("insert into rcg_private.gerencial_snapshot(synced_at,started_at,coverage) values('2026-10-20 14:16+00','2026-10-20 14:15+00',$1)",[[key(1),key(2),key(3),key(4)]])
 for(const [n,role] of [[1,'Gerente Operativo de Datos'],[2,'Subgerente Operativo de Compras'],[3,'Analista'],[4,'Subgerenta de Personal']])
  await db.query("insert into rcg_private.gerencial_snapshot_people(identifier,assignments,contacts) values($1,$2,'[]')",[key(n),JSON.stringify([{role,unit:'Unidad',ministry:'Organismo'}])])
 for(const [person,n] of [[2,1],[4,4],[6,2]])await db.query("insert into rcg_private.directory_link_keys(person_id,link_key,verified_at,verification_basis) values($1,$2,now(),'Prueba')",[uid(person),key(n)])
 await actor(1)
 const {syncedAt,...coverage}=(await rpc('admin_metrics',['month'])).coverage;assert.equal(new Date(syncedAt).toISOString(),'2026-10-20T14:16:00.000Z')
 assert.deepEqual(coverage,{managers:3,covered:2,gerentes:{total:1,covered:1},subgerentes:{total:2,covered:1}},'mock members do not count')
 await assert.rejects(()=>rpc('admin_set_metrics_universe',[1400]))

 // Previous Red workbook: matched by email, rerunnable, departures without personal data.
 await db.exec('reset role')
 const history_=[[{email:' METRICAS5@example.test',at:'2026-05-04T10:00:00'},{email:'metricas5@example.test',at:'2026-05-04T15:00:00'},{email:'fuera@example.test',at:'2026-05-05T09:00:00'}],
  [{viewer:'metricas5@example.test',target:'metricas2@example.test',at:'2026-05-04T10:05:00'},{viewer:'metricas5@example.test',target:null,at:'2026-05-04T10:06:00'}],
  [{email:'metricas5@example.test',at:'2026-05-04T10:02:00',term:'Cultura',results:3},{email:'metricas5@example.test',at:'2026-05-04T10:03:00',term:' ',results:0}],
  [{joined_on:'2025-07-30',left_on:'2026-06-15',role:'Subgerente Operativo',email:'baja@example.test',reason:'Eliminación manual'},{joined_on:'2025-07-30',left_on:'2026-06-15',role:'Gerente',email:'metricas2@example.test',reason:'Sigue en la Red'}]]
 const load=async()=>(await db.query('select rcg_private.import_metrics_history($1,$2,$3,$4) as v',history_.map(x=>JSON.stringify(x)))).rows[0].v
 const imported=await load();assert.deepEqual(await load(),imported,'rerunnable')
 assert.deepEqual(imported.logins,{total:3,matched:2,people:1});assert.deepEqual(imported.views,{total:2,matched:2,withProfile:1})
 assert.deepEqual(imported.searches,{total:2,matched:1});assert.equal(imported.departures,1)
 const xlsx=(await db.query("select kind,profile_id,hits,user_id,activity_date::text as day from rcg_private.member_activity where source='xlsx' order by kind,hits")).rows
 assert.deepEqual(xlsx.map(r=>[r.kind,r.profile_id,r.hits,r.user_id,r.day]),[['profile',uid(2),1,null,'2026-05-04'],['profile',null,1,null,'2026-05-04'],['search',null,1,null,'2026-05-04'],['visit',null,2,null,'2026-05-04']])
 await actor(1)
 const after=await rpc('admin_metrics',['month'])
 assert.equal(after.summary.entered,4);assert.equal(after.summary.members,4);assert.ok(after.historySince)
 assert.equal(after.activity.find(b=>b.starts==='2026-05-01').visitors,1);assert.equal(after.activity.find(b=>b.starts==='2026-05-01').searches,1)
 const june=after.growth.find(b=>b.starts==='2026-06-01');assert.equal(june.left,1)
 assert.equal(after.growth.find(b=>b.starts==='2026-05-01').subgerente,2,'the departure counts until it leaves');assert.equal(june.subgerente,1)
 assert.equal(after.growth[0].joined,2)
 assert.deepEqual((await people({status:'never'})).counts,{all:4,never:0,entered:4})
})
