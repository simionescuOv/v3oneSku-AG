-- Auth + RLS — asociere user↔tenant.
--
-- Model: un user devine automat owner/admin al unui tenant NOU la primul login
-- (trigger pe auth.users). Tenantul își poate invita ulterior membri cu alte
-- roluri (rolurile concrete rămân [TBD] — coloana `role` e text liber, fără
-- check constraint, ca să nu blocheze definirea lor ulterioară). Un user poate
-- apărea în mai multe tenant_members (tenantul propriu + tenanți la care a
-- fost invitat); tenantul „activ" pentru sesiunea curentă e primul creat
-- (propriul tenant), via `current_tenant_id()`.
create table tenant_members (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'admin',
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index idx_tenant_members_user on tenant_members(user_id);

-- security definer: citește propria apartenență a userului curent, indiferent
-- de RLS de pe tenant_members (evită recursie policy → funcție → policy).
create or replace function current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.tenant_id
    from tenant_members tm
   where tm.user_id = auth.uid()
   order by tm.created_at asc
   limit 1
$$;

-- La primul login (orice provider Auth, aici doar Google e activat în
-- Dashboard) se creează automat un tenant nou + membership 'admin' pentru
-- userul respectiv. La login-urile ulterioare, auth.users nu mai declanșează
-- INSERT — userul ajunge la tenantul deja creat via current_tenant_id().
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  insert into tenants (name)
  values (coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Tenant nou'))
  returning id into v_tenant_id;

  insert into tenant_members (tenant_id, user_id, role)
  values (v_tenant_id, new.id, 'admin');

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
