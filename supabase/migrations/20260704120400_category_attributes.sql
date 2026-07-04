-- SPEC_DatabaseSchema_v3 §5 — schema dinamică a categoriei.
create table category_attributes (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  category_id          uuid not null references categories(id) on delete cascade,
  name                 text not null,
  attribute_type       text not null check (attribute_type in ('text', 'single_choice')),
  filterable           boolean not null,       -- default aplicat de aplicație/RPC după tip
  global_attribute_id  uuid references global_attributes(id) on delete restrict,
  position             integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_category_attributes_category on category_attributes(category_id);
create index idx_category_attributes_global on category_attributes(global_attribute_id)
  where global_attribute_id is not null;

-- două atribute cu același nume în aceeași categorie ar încurca UI-ul
create unique index uq_category_attributes_name
  on category_attributes(category_id, name);

create trigger trg_category_attributes_updated_at
  before update on category_attributes
  for each row execute procedure extensions.moddatetime(updated_at);

-- Un atribut legat global trebuie să aibă același attribute_type ca atributul
-- global (doar single_choice în v1) — enforțat aici, nu doar în aplicație.
create or replace function enforce_category_attribute_global_type()
returns trigger language plpgsql as $$
declare
  v_global_type text;
begin
  if new.global_attribute_id is not null then
    select attribute_type into v_global_type
      from global_attributes
     where id = new.global_attribute_id;
    if v_global_type is null then
      raise exception 'Atributul global % nu există', new.global_attribute_id;
    end if;
    if v_global_type <> new.attribute_type then
      raise exception 'Tipul atributului local (%) trebuie să coincidă cu tipul atributului global (%)',
        new.attribute_type, v_global_type;
    end if;
  end if;
  return new;
end $$;

create trigger trg_category_attributes_global_type
  before insert or update on category_attributes
  for each row execute procedure enforce_category_attribute_global_type();

-- ── Tabel: category_attribute_options ───────────────────────────────────────
-- Doar atributele single_choice NELEGATE global au rânduri aici (§5) —
-- atributele legate global folosesc exclusiv global_attribute_options (§4.1).
create table category_attribute_options (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  attribute_id  uuid not null references category_attributes(id) on delete cascade,
  value         text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_attribute_options_attribute on category_attribute_options(attribute_id);
create unique index uq_attribute_options_value
  on category_attribute_options(attribute_id, value);

create or replace function enforce_no_local_options_for_global_attribute()
returns trigger language plpgsql as $$
declare
  v_global_attribute_id uuid;
begin
  select global_attribute_id into v_global_attribute_id
    from category_attributes
   where id = new.attribute_id;
  if v_global_attribute_id is not null then
    raise exception
      'Atributul % e legat global — opțiunile se adaugă în global_attribute_options, nu aici',
      new.attribute_id;
  end if;
  return new;
end $$;

create trigger trg_no_local_options_for_global_attribute
  before insert or update on category_attribute_options
  for each row execute procedure enforce_no_local_options_for_global_attribute();
