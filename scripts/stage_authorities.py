"""Prepare a private, guarded SQL transaction for later authorized activation.

This script never executes SQL remotely. No source contacts are staged.
"""
import json
import calendar
from datetime import date
from pathlib import Path
import uuid
from connect_organization import inserts, literal

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local'


def build(data, snapshot):
    people, candidates, seen = {}, [], set()
    versions = {u['id']: u.get('authority_version', 1) for u in snapshot['units']}
    for result in data['results']:
        for row in sorted(result['candidates'], key=lambda c: ({'high':0,'medium':1,'low':2}[c['confidence']], c['official'])):
            if not row.get('key') or not row['name']:
                continue
            people.setdefault(row['key'], (str(uuid.uuid4()), row['name']))
            identity = (result['unit_id'], row['key'], row['institutional_role'])
            if identity in seen: continue
            seen.add(identity)
            year, month = map(int, row['source_period'].split('-'))
            expiry = date(year, month, calendar.monthrange(year, month)[1]).isoformat()
            candidates.append((str(uuid.uuid4()), result['unit_id'], row['key'], row['institutional_role'], row['role'],
                row['confidence'], row['method'], row['source'], row['source_period'], row.get('source_date'),
                row.get('since'), row.get('until'), row['reason'], expiry))
    units = [(r['unit_id'], r['status'], r['reason'],
              r['winner']['key'] if r['winner'] else None,
              r['winner']['institutional_role'] if r['winner'] else None,
              versions[r['unit_id']], r.get('rename',{}).get('name'), r.get('rename',{}).get('evidence')) for r in data['results']
             if r['expected'] or r.get('before') or r.get('rename') or r['status'] in ('manual','vacant','not_applicable')]
    migration = (ROOT/'supabase/rcg_organization_authorities.sql').read_text(encoding='utf8')
    migration = migration.replace('\nbegin;', '\n', 1).rsplit('commit;',1)[0]
    statements = ["begin; set local statement_timeout='120s'; select pg_advisory_xact_lock(771245904);", migration,
      """create temp table authority_original_hierarchy on commit drop as select id,parent_id,name,code from red_conexion_gerencial.organization_units;
      create temp table authority_state_before on commit drop as select id,authority_status,authority_reason,authority_reference from red_conexion_gerencial.organization_units;
      create temp table authority_manual_before on commit drop as
       select id,unit_id,responsible_id,position_title from rcg_private.organization_assignments where assignment_origin='manual' and responsibility_confirmed;
      create temp table authority_stage_people(id uuid,link_key text,institutional_name text) on commit drop;
      create temp table authority_expected_structure(id uuid,parent_id uuid,name text,code text) on commit drop;
      create temp table authority_stage_candidates(id uuid,unit_id uuid,link_key text,role text,administrative_role text,confidence text,method text,source text,period text,reference_date date,since date,until date,reason text,expiry date) on commit drop;
      create temp table authority_stage_units(id uuid,status text,reason text,winner text,role text,expected integer,proposed_name text,name_evidence text) on commit drop;"""]
    statements.extend(inserts('authority_expected_structure','id,parent_id,name,code',[(u['id'],u.get('parent_id'),u['name'],u.get('code')) for u in snapshot['units']]))
    statements.extend(inserts('authority_stage_people','id,link_key,institutional_name',[(v[0],k,v[1]) for k,v in people.items()]))
    statements.extend(inserts('authority_stage_candidates','id,unit_id,link_key,role,administrative_role,confidence,method,source,period,reference_date,since,until,reason,expiry',candidates))
    statements.extend(inserts('authority_stage_units','id,status,reason,winner,role,expected,proposed_name,name_evidence',units))
    statements.append("""
    do $$ begin
     if """+literal(data['as_of'])+"""::date>current_date or to_char(current_date,'YYYY-MM')<>"""+literal(data['period'])+""" then
      raise exception 'El análisis no corresponde al período actual. Volvé a conciliar.'; end if;
     if exists(select 1 from authority_stage_units s left join red_conexion_gerencial.organization_units u on u.id=s.id where u.id is null or u.authority_version<>s.expected)
      or exists(select 1 from authority_expected_structure b full join red_conexion_gerencial.organization_units u using(id)
       where b.id is null or u.id is null or b.parent_id is distinct from u.parent_id or b.name is distinct from u.name or b.code is distinct from u.code) then
      raise exception 'La estructura cambió desde el análisis. Se requiere volver a conciliar.'; end if;
    end $$;
    insert into rcg_private.organization_people(id,link_key,institutional_name,reconciliation_status,person_id,verified_at,verification_basis)
     select s.id,s.link_key,s.institutional_name,
      case when p.is_active then 'member'
       when not exists(select 1 from red_conexion_gerencial.people all_p left join rcg_private.directory_link_keys all_k on all_k.person_id=all_p.id where all_p.is_active and all_k.person_id is null) then 'non_member'
       else 'pending' end,
      case when p.is_active then p.id end,now(),
      'Conciliación por identificador validado en backend; la ausencia solo se confirma con Directorio completo'
     from authority_stage_people s left join rcg_private.directory_link_keys k on k.link_key=s.link_key
     left join red_conexion_gerencial.people p on p.id=k.person_id
     on conflict(link_key) do update set institutional_name=excluded.institutional_name,
      reconciliation_status=excluded.reconciliation_status,person_id=excluded.person_id,
      verified_at=excluded.verified_at,verification_basis=excluded.verification_basis;
    update rcg_private.organization_assignments a set responsibility_confirmed=false
     where a.assignment_origin<>'manual' and exists(select 1 from red_conexion_gerencial.organization_units u join authority_stage_units s using(id) where u.id=a.unit_id and not u.authority_reviewed);
    insert into rcg_private.organization_assignments(id,unit_id,responsible_id,position_title,administrative_position,
     assignment_origin,confidence,matching_method,source_name,source_period,source_reference,valid_from,valid_until,validity_basis,verification_basis,evidence_until,observed_at)
     select s.id,s.unit_id,p.id,s.role,s.administrative_role,'automatic',s.confidence,s.method,s.source,s.period,s.reference_date,s.since,s.until,s.reason,s.reason,s.expiry,"""+literal(data['as_of'])+"""::date
     from authority_stage_candidates s join rcg_private.organization_people p on p.link_key=s.link_key
     on conflict(unit_id,responsible_id,position_title) do update set administrative_position=excluded.administrative_position,
      confidence=excluded.confidence,matching_method=excluded.matching_method,source_name=excluded.source_name,
      source_period=excluded.source_period,source_reference=excluded.source_reference,valid_from=excluded.valid_from,
      valid_until=excluded.valid_until,validity_basis=excluded.validity_basis,verification_basis=excluded.verification_basis,
      evidence_until=excluded.evidence_until,observed_at=excluded.observed_at
      where organization_assignments.assignment_origin<>'manual';
    update rcg_private.organization_assignments a set responsibility_confirmed=true
     from authority_stage_units s,rcg_private.organization_people p,red_conexion_gerencial.organization_units u
     where a.unit_id=s.id and u.id=s.id and not u.authority_reviewed and a.responsible_id=p.id and p.link_key=s.winner and a.position_title=s.role
      and s.status='automatic' and a.confidence='high' and not a.review_excluded
      and not exists(select 1 from authority_manual_before m where m.unit_id=s.id);
    update red_conexion_gerencial.organization_units u set
     authority_status=case when u.authority_reviewed then u.authority_status when exists(select 1 from authority_manual_before m where m.unit_id=u.id) then 'manual' else s.status end,
     authority_reason=case when u.authority_reviewed then u.authority_reason||' · Nueva evidencia: '||s.reason else s.reason end,
     authority_expected=case when u.authority_reviewed then u.authority_expected
      when s.status in ('automatic','manual','vacant') then true when s.status='not_applicable' then false else null end,
     proposed_name=coalesce(s.proposed_name,u.proposed_name),name_evidence=coalesce(s.name_evidence,u.name_evidence),
     authority_reference="""+literal(data['as_of'])+"""::date,authority_version=authority_version+1
     from authority_stage_units s where s.id=u.id;
    insert into rcg_private.organization_authority_audit(unit_id,action,note,evidence,before_value,after_value)
     select u.id,'reconciliation',s.reason,'Dotación institucional; período '||"""+literal(data['period'])+"""||'; SHA256 '||"""+literal(data['source_sha256'])+""",
      jsonb_build_object('status',b.authority_status,'reason',b.authority_reason,'reference',b.authority_reference),
      jsonb_build_object('status',u.authority_status,'reference',u.authority_reference,'proposedName',u.proposed_name)
     from authority_stage_units s join red_conexion_gerencial.organization_units u on u.id=s.id join authority_state_before b on b.id=u.id;
    do $$ begin
     if exists(select 1 from authority_original_hierarchy b full join red_conexion_gerencial.organization_units a using(id)
      where b.id is null or a.id is null or b.parent_id is distinct from a.parent_id or b.code is distinct from a.code or b.name is distinct from a.name) then
      raise exception 'La conciliación no puede modificar la estructura institucional'; end if;
     if exists(select 1 from authority_manual_before m left join rcg_private.organization_assignments a using(id)
      where not coalesce(a.responsibility_confirmed,false) or a.responsible_id<>m.responsible_id or a.position_title<>m.position_title) then
      raise exception 'Se modificó una confirmación manual. Operación cancelada.'; end if;
    end $$;
    notify pgrst,'reload schema'; commit;
    """)
    return '\n'.join(statements)


if __name__ == '__main__':
    data = json.loads((LOCAL/'authority-reconciliation-private.json').read_text(encoding='utf8'))
    snapshot = json.loads((LOCAL/'authority-current-private.json').read_text(encoding='utf8'))
    (LOCAL/'authority-activation-private.sql').write_text(build(data,snapshot),encoding='utf8')
    print('Conciliación preparada en .local. No se ejecutaron escrituras remotas.')
