-- BASE GCBA only (pnhskmlejdaklwkvasxp). Isolated from Hub/public and existing data.
begin;
create table if not exists red_conexion_gerencial.newsletter_reactions (
  newsletter_id uuid not null references red_conexion_gerencial.newsletters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('love','like','celebrate','clap','laugh','wow','sad','think','dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (newsletter_id,user_id)
);
alter table red_conexion_gerencial.newsletter_reactions enable row level security;
-- Only authenticated, membership-checked RPCs expose aggregates and one's own type.
revoke all on red_conexion_gerencial.newsletter_reactions from public,anon,authenticated,service_role;

create or replace function red_conexion_gerencial.get_newsletter_reactions(p_newsletter_ids uuid[])
returns table(newsletter_id uuid,counts jsonb,my_reaction text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not red_conexion_gerencial.is_member() then
    raise exception 'Acceso denegado' using errcode='42501';
  end if;
  if coalesce(cardinality(p_newsletter_ids),0)>200 then
    raise exception 'Demasiadas publicaciones' using errcode='22023';
  end if;
  return query
    select n.id,
      coalesce((select jsonb_object_agg(t.reaction,t.total) from (
        select r.reaction,count(*) as total from red_conexion_gerencial.newsletter_reactions r
        where r.newsletter_id=n.id group by r.reaction
      ) t),'{}'::jsonb),
      (select r.reaction from red_conexion_gerencial.newsletter_reactions r
       where r.newsletter_id=n.id and r.user_id=auth.uid())
    from red_conexion_gerencial.newsletters n
    where n.id=any(p_newsletter_ids) and n.status='publicado';
end;
$$;

create or replace function red_conexion_gerencial.set_newsletter_reaction(p_newsletter_id uuid,p_reaction text default null)
returns table(newsletter_id uuid,counts jsonb,my_reaction text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not red_conexion_gerencial.is_member() then
    raise exception 'Acceso denegado' using errcode='42501';
  end if;
  if p_reaction is not null and p_reaction not in ('love','like','celebrate','clap','laugh','wow','sad','think','dislike') then
    raise exception 'Reacción inválida' using errcode='22023';
  end if;
  -- Prevent a publication from being archived/deleted during this write.
  perform 1 from red_conexion_gerencial.newsletters n where n.id=p_newsletter_id and n.status='publicado' for share;
  if not found then raise exception 'Publicación no disponible' using errcode='42501'; end if;
  -- Serialize concurrent requests from the same account without locking other users.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_newsletter_id::text,0));
  if p_reaction is null then
    delete from red_conexion_gerencial.newsletter_reactions r where r.newsletter_id=p_newsletter_id and r.user_id=actor;
  else
    insert into red_conexion_gerencial.newsletter_reactions(newsletter_id,user_id,reaction)
      values(p_newsletter_id,actor,p_reaction)
      on conflict on constraint newsletter_reactions_pkey do update set reaction=excluded.reaction,updated_at=now();
  end if;
  return query select * from red_conexion_gerencial.get_newsletter_reactions(array[p_newsletter_id]);
end;
$$;
revoke all on function red_conexion_gerencial.get_newsletter_reactions(uuid[]),
  red_conexion_gerencial.set_newsletter_reaction(uuid,text) from public,anon,authenticated,service_role;
grant execute on function red_conexion_gerencial.get_newsletter_reactions(uuid[]),
  red_conexion_gerencial.set_newsletter_reaction(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
