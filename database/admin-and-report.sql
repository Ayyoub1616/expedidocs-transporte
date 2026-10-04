
begin;
create schema if not exists expedidocs_private;
revoke all on schema expedidocs_private from public, anon;
grant usage on schema expedidocs_private to authenticated;
create or replace function public.expedidocs_is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() = '9a1cb1b9-f0a0-4db3-9263-d9f4bb0e4511'::uuid
$$;
revoke all on function public.expedidocs_is_admin() from public,anon;
grant execute on function public.expedidocs_is_admin() to authenticated;
drop policy if exists "ExpediDocs administrator access" on public.expedidocs_data;
create policy "ExpediDocs administrator access" on public.expedidocs_data for all to authenticated
 using ((select public.expedidocs_is_admin())) with check ((select public.expedidocs_is_admin()));

create or replace function expedidocs_private.admin_accounts() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.expedidocs_is_admin() then raise exception 'Solo administración' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'shipments',coalesce(jsonb_array_length(d.payload->'shipments'),0)) order by u.email),'[]'::jsonb)
 from auth.users u left join public.expedidocs_data d on d.user_id=u.id);
end $$;
create or replace function public.expedidocs_admin_accounts() returns jsonb language sql stable security invoker set search_path='' as $$ select expedidocs_private.admin_accounts() $$;
revoke all on function expedidocs_private.admin_accounts(),public.expedidocs_admin_accounts() from public,anon;
grant execute on function expedidocs_private.admin_accounts(),public.expedidocs_admin_accounts() to authenticated;

create or replace function expedidocs_private.report(date_from text default null,date_to text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
 return (with entries as (
 select s, d.updated_at,row_number() over (partition by coalesce(nullif(s->>'id',''),d.user_id::text||'/'||ordinality::text) order by d.updated_at desc) n
 from public.expedidocs_data d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.payload->'shipments')='array' then d.payload->'shipments' else '[]'::jsonb end) with ordinality as x(s,ordinality)
 ), grouped as (
 select upper(coalesce(nullif(trim(s->>'destination'),''),'SIN DESTINO')) destination,count(*) shipments,
 sum(case when s->>'pallets' ~ '^\d+(\.\d+)?$' then (s->>'pallets')::numeric else 0 end) pallets,
 sum(case when s->>'weight' ~ '^\d+(\.\d+)?$' then (s->>'weight')::numeric else 0 end) weight,
 max(s->>'date') last_date
 from entries where n=1 and (date_from is null or s->>'date'>=date_from) and (date_to is null or s->>'date'<=date_to)
 group by 1
 ) select coalesce(jsonb_agg(to_jsonb(grouped) order by pallets desc,destination),'[]'::jsonb) from grouped);
end $$;
create or replace function public.expedidocs_report(date_from text default null,date_to text default null) returns jsonb language sql stable security invoker set search_path='' as $$ select expedidocs_private.report(date_from,date_to) $$;
revoke all on function expedidocs_private.report(text,text),public.expedidocs_report(text,text) from public,anon;
grant execute on function expedidocs_private.report(text,text),public.expedidocs_report(text,text) to authenticated;

create or replace function public.expedidocs_admin_backup() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.expedidocs_is_admin() then raise exception 'Solo administración' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'payload',payload,'updated_at',updated_at)),'[]'::jsonb) from public.expedidocs_data);
end $$;
revoke all on function public.expedidocs_admin_backup() from public,anon;
grant execute on function public.expedidocs_admin_backup() to authenticated;
notify pgrst,'reload schema';
commit;