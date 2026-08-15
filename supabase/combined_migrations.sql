-- Combined Supabase Migrations for oneSku
-- Generated automatically

-- ==========================================
-- File: 20260704120000_extensions.sql
-- ==========================================

-- Extensii necesare (SPEC_DatabaseSchema_v3 §1).
-- pgcrypto e adăugat defensiv pentru gen_random_uuid() — Supabase îl are deja
-- activat în majoritatea proiectelor noi, dar `if not exists` face operația idempotentă.
create extension if not exists moddatetime schema extensions;
create extension if not exists unaccent schema extensions;
create extension if not exists pgcrypto schema extensions;


-- ==========================================
-- File: 20260704120100_tenants.sql
-- ==========================================

-- SPEC_DatabaseSchema_v3 §2
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_tenants_updated_at
  before update on tenants
  for each row execute procedure extensions.moddatetime(updated_at);


-- ==========================================
-- File: 20260704120200_categories.sql
-- ==========================================

-- SPEC_DatabaseSchema_v3 §3 (arbore de foldere + categorii, unicitate globală normalizată)
-- + coloana `is_temp` din SPEC_MutareCrossFolder §1.1 (foldere temporare, mutare cross-folder),
--   inclusă direct aici fiindcă schema pornește de la zero.
create table categories (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  parent_id     uuid references categories(id) on delete restrict,
  name          text not null,
  node_type     text not null check (node_type in ('folder', 'category')),
  position      integer not null default 0,
  is_temp       boolean not null default false,  -- foldere temporare de mutare cross-folder; niciodată vizibile în UI
  deleted_at    timestamptz,                      -- soft-delete (doar node_type = 'category')
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_categories_tenant_parent on categories(tenant_id, parent_id);
create index idx_categories_deleted_at on categories(deleted_at) where deleted_at is not null;
create index idx_categories_is_temp on categories(tenant_id) where is_temp = true;

create trigger trg_categories_updated_at
  before update on categories
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── 3.1 Unicitate globală per tenant — doar categorii, pe nume normalizat ──────
-- Normalizarea trebuie identică cu `normalize()` din src/lib/search.js
-- (lowercase + NFD + strip diacritice). `unaccent` e marcată stable de extensie,
-- dar comportamentul ei e determinist pentru un input dat cu configurația
-- implicită — wrapper-ul immutable e pattern-ul standard Supabase pentru a o
-- putea folosi într-un unique index.
create or replace function normalize_name(p text)
returns text
language sql
immutable
as $$
  select lower(trim(extensions.unaccent(p)));
$$;

create unique index uq_categories_global_name
  on categories (tenant_id, normalize_name(name))
  where deleted_at is null and node_type = 'category';

-- ── 3.3 Constrângere de frunză ──────────────────────────────────────────────
create or replace function enforce_category_tree_rules()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from categories where parent_id = new.id) then
    if new.node_type = 'category' then
      raise exception 'O categorie nu poate avea copii (id=%)', new.id;
    end if;
  end if;
  if new.parent_id is not null then
    if (select node_type from categories where id = new.parent_id) = 'category' then
      raise exception 'Părintele % este o categorie (frunză), nu poate avea copii', new.parent_id;
    end if;
  end if;
  return new;
end $$;

create trigger trg_categories_tree_rules
  before insert or update on categories
  for each row execute procedure enforce_category_tree_rules();


-- ==========================================
-- File: 20260704120300_global_attributes.sql
-- ==========================================

-- SPEC_DatabaseSchema_v3 §4 — registry independent de atribute cross-categorie (ex. Brand).
create table global_attributes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  attribute_type text not null check (attribute_type in ('single_choice')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index uq_global_attributes_name on global_attributes(tenant_id, name);

create trigger trg_global_attributes_updated_at
  before update on global_attributes
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── 4.1 Opțiunile atributelor globale ───────────────────────────────────────
create table global_attribute_options (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  global_attribute_id  uuid not null references global_attributes(id) on delete cascade,
  value                text not null,
  position             integer not null default 0,
  created_at           timestamptz not null default now()
);

create index idx_global_attr_options_attr on global_attribute_options(global_attribute_id);
create unique index uq_global_attr_options_value
  on global_attribute_options(global_attribute_id, value);


-- ==========================================
-- File: 20260704120400_category_attributes.sql
-- ==========================================

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


-- ==========================================
-- File: 20260704120500_products.sql
-- ==========================================

-- SPEC_DatabaseSchema_v3 §6 — produse. `name_id` înlocuiește `name` (§6.1);
-- `listPrice` e legalizat ca `list_price numeric` simplu, conform task de migrare
-- (decizia de preț complex rămâne deschisă — vezi §11, nu se construiește aici
-- niciun model suplimentar de preț/cost).
create table products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete restrict,
  name_id       text not null,
  attributes    jsonb not null default '{}',   -- chei = category_attributes.id (UUID)
  tags          text[] not null default '{}',
  list_price    numeric,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index uq_products_name_id on products(tenant_id, name_id);
create index idx_products_tenant_category on products(tenant_id, category_id);
create index idx_products_attributes on products using gin(attributes jsonb_path_ops);
create index idx_products_tags on products using gin(tags);

create trigger trg_products_updated_at
  before update on products
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── 6.1 NameID imuabil ───────────────────────────────────────────────────────
create or replace function enforce_name_id_immutable()
returns trigger language plpgsql as $$
begin
  if new.name_id <> old.name_id then
    raise exception 'name_id este imuabil (produs %)', old.id;
  end if;
  return new;
end $$;

create trigger trg_products_name_id_immutable
  before update of name_id on products
  for each row execute procedure enforce_name_id_immutable();

-- ── 6.3 category_id trebuie să refere mereu un nod node_type = 'category' ────
create or replace function enforce_product_on_leaf()
returns trigger language plpgsql as $$
begin
  if (select node_type from categories where id = new.category_id) <> 'category' then
    raise exception 'Produsele se atașează doar la noduri category, nu folder (id=%)', new.category_id;
  end if;
  return new;
end $$;

create trigger trg_products_leaf
  before insert or update of category_id on products
  for each row execute procedure enforce_product_on_leaf();


-- ==========================================
-- File: 20260704120600_filter_idx.sql
-- ==========================================

-- SPEC_DatabaseSchema_v3 §7 / SPEC_LocalFilter_v3 §3, §8.4
-- Materializare server-side a celor trei tipuri de index de filtrare.
create table filter_idx (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  scope_type  text not null check (scope_type in ('global', 'category', 'space')),
  scope_id    uuid,                            -- null pt. global; category_id sau space_id altfel
  idx         jsonb not null default '{}',
  rebuilt_at  timestamptz not null default now()
);

create unique index uq_filter_idx_scope
  on filter_idx(tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));


-- ==========================================
-- File: 20260704120700_filter_idx_functions.sql
-- ==========================================

-- SPEC_LocalFilter_v3 §4, §7, §8.4 — rebuild integral (GROUP BY), niciodată incremental.
-- `idx` = { "<attr_key_sau_global_id_sau_'tags'>": [ {"value": v, "idx": [product_id,...]}, ... ] }

-- ── rebuild_filter_idx_category ──────────────────────────────────────────────
-- Doar atributele LOCALE `filterable` ale schemei categoriei, doar produsele
-- acelei categorii (neșterse). Cheile rămân id-uri locale (category_attributes.id).
create or replace function rebuild_filter_idx_category(p_tenant_id uuid, p_category_id uuid)
returns void language plpgsql security definer as $$
declare
  v_idx jsonb;
begin
  with vals as (
    select ca.id as attr_id, p.attributes ->> ca.id::text as val, p.id as product_id
      from category_attributes ca
      join products p
        on p.category_id = ca.category_id
       and p.tenant_id = ca.tenant_id
     where ca.category_id = p_category_id
       and ca.tenant_id = p_tenant_id
       and ca.filterable = true
       and p.deleted_at is null
       and p.attributes ? ca.id::text
  ),
  grouped as (
    select attr_id, val, jsonb_agg(product_id::text order by product_id) as ids
      from vals
     group by attr_id, val
  ),
  per_attr as (
    select attr_id, jsonb_agg(jsonb_build_object('value', val, 'idx', ids) order by val) as values_arr
      from grouped
     group by attr_id
  )
  select coalesce(jsonb_object_agg(attr_id::text, values_arr), '{}'::jsonb)
    into v_idx
    from per_attr;

  insert into filter_idx (tenant_id, scope_type, scope_id, idx, rebuilt_at)
  values (p_tenant_id, 'category', p_category_id, v_idx, now())
  on conflict (tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set idx = excluded.idx, rebuilt_at = excluded.rebuilt_at;
end $$;

-- ── rebuild_filter_idx_global ────────────────────────────────────────────────
-- Doar Tags + atributele GLOBALE `filterable` (mapare local → global_attribute_id
-- rezolvată aici, §7.2/§8.3), peste TOATE produsele tenantului.
create or replace function rebuild_filter_idx_global(p_tenant_id uuid)
returns void language plpgsql security definer as $$
declare
  v_idx jsonb := '{}'::jsonb;
  v_tags jsonb;
  v_attrs jsonb;
begin
  -- Tags: flat, OR — un produs poate apărea la mai multe valori.
  with tag_pairs as (
    select unnest(p.tags) as val, p.id as product_id
      from products p
     where p.tenant_id = p_tenant_id
       and p.deleted_at is null
  ),
  tag_grouped as (
    select val, jsonb_agg(product_id::text order by product_id) as ids
      from tag_pairs
     group by val
  )
  select jsonb_agg(jsonb_build_object('value', val, 'idx', ids) order by val)
    into v_tags
    from tag_grouped;

  if v_tags is not null then
    v_idx := v_idx || jsonb_build_object('tags', v_tags);
  end if;

  -- Atribute globale: pentru fiecare categorie, cheile locale legate de un
  -- global_attribute_id se agregă sub acel id global, indiferent de categorie.
  with vals as (
    select ca.global_attribute_id as gid, p.attributes ->> ca.id::text as val, p.id as product_id
      from category_attributes ca
      join products p
        on p.category_id = ca.category_id
       and p.tenant_id = ca.tenant_id
     where ca.tenant_id = p_tenant_id
       and ca.global_attribute_id is not null
       and ca.filterable = true
       and p.deleted_at is null
       and p.attributes ? ca.id::text
  ),
  grouped as (
    select gid, val, jsonb_agg(product_id::text order by product_id) as ids
      from vals
     group by gid, val
  ),
  per_attr as (
    select gid, jsonb_agg(jsonb_build_object('value', val, 'idx', ids) order by val) as values_arr
      from grouped
     group by gid
  )
  select jsonb_object_agg(gid::text, values_arr)
    into v_attrs
    from per_attr;

  if v_attrs is not null then
    v_idx := v_idx || v_attrs;
  end if;

  insert into filter_idx (tenant_id, scope_type, scope_id, idx, rebuilt_at)
  values (p_tenant_id, 'global', null, v_idx, now())
  on conflict (tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set idx = excluded.idx, rebuilt_at = excluded.rebuilt_at;
end $$;


-- ==========================================
-- File: 20260704120800_filter_idx_triggers.sql
-- ==========================================

-- SPEC_LocalFilter_v3 §4.1.2, §4.3 — rebuild-ul e parte din aceeași tranzacție
-- ca mutația (trigger Postgres), nu risc de fereastră stale.
--
-- Notă de granularitate (deviere asumată față de §4.3.1 literal): trigger-ul nu
-- diferențiază "a fost atins un atribut filterable?" înainte de a rebuild-ui —
-- rebuild-ul categoriei afectate (și global) rulează la ORICE INSERT/UPDATE/DELETE
-- de produs, respectiv la orice schimbare de category_attributes. Corectitudinea
-- nu are de suferit (rebuild-ul e integral și idempotent), doar se face muncă
-- puțin mai multă decât strict necesar — acceptabil la costul de compute
-- neglijabil menționat în §2.5, și mult mai simplu/robust decât un diff
-- old-vs-new pe chei JSONB filterable (sursă probabilă de bug-uri „index uitat").

create or replace function trg_rebuild_filter_idx_on_product_change()
returns trigger language plpgsql security definer as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  if tg_op = 'DELETE' then
    perform rebuild_filter_idx_category(v_tenant_id, old.category_id);
  elsif tg_op = 'INSERT' then
    perform rebuild_filter_idx_category(v_tenant_id, new.category_id);
  elsif tg_op = 'UPDATE' then
    perform rebuild_filter_idx_category(v_tenant_id, new.category_id);
    if new.category_id is distinct from old.category_id then
      perform rebuild_filter_idx_category(v_tenant_id, old.category_id);
    end if;
  end if;

  perform rebuild_filter_idx_global(v_tenant_id);
  return null;
end $$;

create trigger trg_products_filter_idx
  after insert or update or delete on products
  for each row execute procedure trg_rebuild_filter_idx_on_product_change();

create or replace function trg_rebuild_filter_idx_on_attribute_change()
returns trigger language plpgsql security definer as $$
declare
  v_tenant_id uuid;
  v_category_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);
  v_category_id := coalesce(new.category_id, old.category_id);
  perform rebuild_filter_idx_category(v_tenant_id, v_category_id);
  perform rebuild_filter_idx_global(v_tenant_id);
  return null;
end $$;

create trigger trg_category_attributes_filter_idx
  after insert or update or delete on category_attributes
  for each row execute procedure trg_rebuild_filter_idx_on_attribute_change();


-- ==========================================
-- File: 20260704120900_name_id_generator.sql
-- ==========================================

-- SPEC_DatabaseSchema_v3 §6.1, SPEC_LocalFilter_v3 §5.1 — generator NameID.
-- Cuvânt EN lizibil; la coliziune, retry cu combinație adjectiv-substantiv;
-- fallback garantat: substantiv + sufix numeric (spațiul practic inepuizabil
-- la scara vizată — mii de produse/tenant).
create or replace function generate_name_id(p_tenant_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_nouns text[] := array[
    'carrot','meadow','comet','lantern','harbor','cinder','willow','ember','granite','thicket',
    'otter','falcon','marble','quartz','ridge','brook','hazel','linden','cobalt','amber',
    'birch','cedar','coral','delta','ferry','glacier','heron','indigo','jasper','kestrel',
    'lagoon','maple','nectar','opal','pebble','quokka','raven','saffron','tundra','umber',
    'violet','walnut','yucca','zephyr','sparrow','thistle','canyon','meridian','anchor','basalt'
  ];
  v_adjectives text[] := array[
    'brave','quiet','swift','golden','silver','gentle','bold','calm','bright','clever',
    'eager','fierce','humble','jolly','keen','lively','merry','noble','proud','rustic',
    'sturdy','tidy','urban','vivid','warm','young','zealous','azure','crimson','dusty',
    'emerald','frosty','hollow','ivory','jade','lunar','misty','olive','coral','maroon'
  ];
  v_candidate text;
  i integer;
begin
  -- 1) cuvânt simplu
  for i in 1..8 loop
    v_candidate := v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int];
    if not exists (select 1 from products where tenant_id = p_tenant_id and name_id = v_candidate) then
      return v_candidate;
    end if;
  end loop;

  -- 2) combinație adjectiv-substantiv (ex: brave-carrot)
  for i in 1..8 loop
    v_candidate :=
      v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::int]
      || '-' ||
      v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int];
    if not exists (select 1 from products where tenant_id = p_tenant_id and name_id = v_candidate) then
      return v_candidate;
    end if;
  end loop;

  -- 3) fallback garantat: substantiv + sufix numeric (ex: carrot-42)
  loop
    v_candidate :=
      v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int]
      || '-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from products where tenant_id = p_tenant_id and name_id = v_candidate);
  end loop;

  return v_candidate;
end $$;


-- ==========================================
-- File: 20260704121000_catalog_rpc.sql
-- ==========================================

-- SPEC_CatalogRPC.md (adaptat la schema v3 — unicitate globală normalizată în
-- loc de per-sibling) + SPEC_MutareCrossFolder.md (foldere temporare).

-- ── create_category — creare cu validare + mesaj clar la coliziune ──────────
create or replace function create_category(
  p_tenant_id   uuid,
  p_parent_id   uuid,
  p_name        text,
  p_node_type   text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_trimmed text := trim(p_name);
begin
  if p_node_type not in ('folder', 'category') then
    raise exception 'node_type invalid: %', p_node_type;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele nu poate fi gol';
  end if;

  if p_parent_id is not null then
    if not exists (
      select 1 from categories
       where id = p_parent_id
         and tenant_id = p_tenant_id
         and node_type = 'folder'
         and deleted_at is null
    ) then
      raise exception 'Părintele % nu există, nu e folder, sau e șters', p_parent_id;
    end if;
  end if;

  begin
    insert into categories (tenant_id, parent_id, name, node_type, position)
    values (
      p_tenant_id,
      p_parent_id,
      v_trimmed,
      p_node_type,
      coalesce(
        (select max(position) + 1 from categories
          where tenant_id = p_tenant_id
            and parent_id is not distinct from p_parent_id
            and deleted_at is null),
        0
      )
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Categoria „%” există deja', v_trimmed;
  end;

  return v_new_id;
end $$;

-- ── move_node — mutare cu anti-ciclu ─────────────────────────────────────────
create or replace function move_node(
  p_tenant_id     uuid,
  p_node_id       uuid,
  p_new_parent_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_parent_id uuid;
begin
  select parent_id into v_current_parent_id
    from categories
   where id = p_node_id
     and tenant_id = p_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Nodul % nu există sau e șters', p_node_id;
  end if;

  if p_new_parent_id is not distinct from v_current_parent_id then
    return;
  end if;

  if p_new_parent_id is not null then
    if not exists (
      select 1 from categories
       where id = p_new_parent_id
         and tenant_id = p_tenant_id
         and deleted_at is null
    ) then
      raise exception 'Destinația % nu există sau e ștearsă', p_new_parent_id;
    end if;

    if (select node_type from categories where id = p_new_parent_id) = 'category' then
      raise exception 'Destinația % este o categorie (frunză), nu poate avea copii', p_new_parent_id;
    end if;

    if p_new_parent_id = p_node_id then
      raise exception 'Un nod nu poate fi mutat în el însuși';
    end if;

    if exists (
      with recursive descendants as (
        select id from categories where parent_id = p_node_id
        union all
        select c.id from categories c
          join descendants d on c.parent_id = d.id
      )
      select 1 from descendants where id = p_new_parent_id
    ) then
      raise exception 'Destinația % este un descendent al nodului % — mutarea ar crea un ciclu',
        p_new_parent_id, p_node_id;
    end if;
  end if;

  update categories
     set parent_id = p_new_parent_id,
         position = coalesce(
           (select max(position) + 1 from categories
             where tenant_id = p_tenant_id
               and parent_id is not distinct from p_new_parent_id
               and deleted_at is null),
           0
         )
   where id = p_node_id;
end $$;

-- ── get_valid_move_targets — helper pentru UI picker ─────────────────────────
-- Exclude descendenții nodului (anti-ciclu) și folderele temporare (§5 din
-- SPEC_MutareCrossFolder — niciodată vizibile ca destinație).
create or replace function get_valid_move_targets(
  p_tenant_id   uuid,
  p_node_id     uuid
)
returns table (id uuid, parent_id uuid, name text, depth integer)
language sql
stable
security definer
as $$
  with recursive
    excluded as (
      select id from categories where id = p_node_id
      union all
      select c.id from categories c join excluded e on c.parent_id = e.id
    ),
    folders as (
      select c.id, c.parent_id, c.name, 0 as depth
        from categories c
       where c.tenant_id = p_tenant_id
         and c.node_type = 'folder'
         and c.deleted_at is null
         and c.is_temp = false
         and c.parent_id is null
      union all
      select c.id, c.parent_id, c.name, f.depth + 1
        from categories c
        join folders f on c.parent_id = f.id
       where c.node_type = 'folder'
         and c.deleted_at is null
         and c.is_temp = false
    )
  select f.id, f.parent_id, f.name, f.depth
    from folders f
   where f.id not in (select id from excluded)
   order by f.depth, f.name;
$$;

-- ── delete_folder — ștergere cu promovare de conținut ────────────────────────
create or replace function delete_folder(
  p_tenant_id   uuid,
  p_folder_id   uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type   text;
  v_parent_id   uuid;
begin
  select node_type, parent_id into v_node_type, v_parent_id
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Folderul % nu există sau e șters', p_folder_id;
  end if;

  if v_node_type <> 'folder' then
    raise exception 'Nodul % nu este un folder (este %)', p_folder_id, v_node_type;
  end if;

  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = p_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;
end $$;

-- ── soft_delete_category — trimitere în Trash ────────────────────────────────
create or replace function soft_delete_category(
  p_tenant_id    uuid,
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type text;
begin
  select node_type into v_node_type
    from categories
   where id = p_category_id
     and tenant_id = p_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Categoria % nu există sau e deja ștearsă', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Nodul % nu este o categorie (este %) — folderele nu au soft-delete',
      p_category_id, v_node_type;
  end if;

  update categories
     set deleted_at = now()
   where id = p_category_id
     and tenant_id = p_tenant_id;
end $$;

-- ── restore_from_trash — restaurare la rădăcină, blocată la coliziune ────────
create or replace function restore_from_trash(
  p_tenant_id    uuid,
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type text;
  v_deleted_at timestamptz;
  v_name text;
begin
  select node_type, deleted_at, name into v_node_type, v_deleted_at, v_name
    from categories
   where id = p_category_id
     and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Categoria % nu există', p_category_id;
  end if;

  if v_deleted_at is null then
    raise exception 'Categoria % nu este în Trash', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Doar categoriile pot fi restaurate din Trash (nodul % este %)',
      p_category_id, v_node_type;
  end if;

  begin
    update categories
       set deleted_at = null,
           parent_id = null,
           position = coalesce(
             (select max(position) + 1 from categories
               where tenant_id = p_tenant_id
                 and parent_id is null
                 and deleted_at is null),
             0
           )
     where id = p_category_id
       and tenant_id = p_tenant_id;
  exception
    when unique_violation then
      raise exception 'Există deja o categorie „%” — alege alt nume pentru cea restaurată', v_name;
  end;
end $$;

-- ── group_nodes — grupare (creare folder + mutare copii), doar la rădăcină ───
create or replace function group_nodes(
  p_tenant_id    uuid,
  p_node_ids     uuid[],
  p_folder_name  text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_folder_id uuid;
  v_node_id uuid;
begin
  if array_length(p_node_ids, 1) is null or array_length(p_node_ids, 1) < 2 then
    raise exception 'Gruparea necesită minim 2 elemente';
  end if;

  if exists (
    select 1 from unnest(p_node_ids) as nid
     where not exists (
       select 1 from categories
        where id = nid
          and tenant_id = p_tenant_id
          and parent_id is null
          and deleted_at is null
     )
  ) then
    raise exception 'Toate nodurile trebuie să fie la rădăcină și neșterse';
  end if;

  v_folder_id := create_category(p_tenant_id, null, p_folder_name, 'folder');

  foreach v_node_id in array p_node_ids loop
    update categories
       set parent_id = v_folder_id
     where id = v_node_id
       and tenant_id = p_tenant_id;
  end loop;

  return v_folder_id;
end $$;

-- ── Mutare cross-folder (Unfold mode) — SPEC_MutareCrossFolder §2 ────────────

create or replace function create_temp_folder(
  p_tenant_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_folder_id uuid;
begin
  insert into categories (tenant_id, parent_id, name, node_type, is_temp, position)
  values (
    p_tenant_id,
    null,
    '__temp_' || gen_random_uuid()::text,
    'folder',
    true,
    -1
  )
  returning id into v_folder_id;

  return v_folder_id;
end $$;

create or replace function dissolve_temp_folder(
  p_tenant_id  uuid,
  p_folder_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_parent_id uuid;
  v_is_temp   boolean;
begin
  select parent_id, is_temp into v_parent_id, v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Folderul temporar % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = p_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;
end $$;

create or replace function promote_temp_folder(
  p_tenant_id  uuid,
  p_folder_id  uuid,
  p_new_name   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_is_temp boolean;
  v_trimmed text := trim(p_new_name);
begin
  select is_temp into v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Folderul % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele subfolderului nu poate fi gol';
  end if;

  begin
    update categories
       set is_temp = false,
           name    = v_trimmed
     where id = p_folder_id
       and tenant_id = p_tenant_id;
  exception
    when unique_violation then
      raise exception 'Categoria „%” există deja', v_trimmed;
  end;
end $$;

create or replace function cleanup_temp_folders(
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update categories
     set parent_id = null
   where parent_id in (
     select id from categories
      where tenant_id = p_tenant_id
        and is_temp = true
   )
   and tenant_id = p_tenant_id;

  delete from categories
   where tenant_id = p_tenant_id
     and is_temp = true;
end $$;


-- ==========================================
-- File: 20260704121100_product_rpc.sql
-- ==========================================

-- SPEC_CatalogRPC (extindere v3) + SPEC_DatabaseSchema_v3 §6 — creare produs cu
-- NameID generat server-side. Clientul nu trimite niciodată `name_id`.
-- Returnează `name_id`-ul generat (nu UUID-ul intern) — e singurul lucru pe
-- care clientul are nevoie să-l afișeze imediat după creare (§5.1.7).
create or replace function create_product(
  p_tenant_id    uuid,
  p_category_id  uuid,
  p_attributes   jsonb default '{}'::jsonb,
  p_tags         text[] default '{}',
  p_list_price   numeric default null
)
returns text
language plpgsql
security definer
as $$
declare
  v_name_id text;
begin
  if not exists (
    select 1 from categories
     where id = p_category_id
       and tenant_id = p_tenant_id
       and node_type = 'category'
       and deleted_at is null
  ) then
    raise exception 'Categoria % nu există, e ștearsă, sau nu e o categorie (frunză)', p_category_id;
  end if;

  v_name_id := generate_name_id(p_tenant_id);

  insert into products (tenant_id, category_id, name_id, attributes, tags, list_price)
  values (
    p_tenant_id,
    p_category_id,
    v_name_id,
    coalesce(p_attributes, '{}'::jsonb),
    coalesce(p_tags, '{}'),
    p_list_price
  );

  return v_name_id;
end $$;


-- ==========================================
-- File: 20260704121200_stockhub_base.sql
-- ==========================================

-- SPEC_DatabaseSchema_v3 §10 — tabele de bază pentru StockHub (fără UI, fără
-- motor complet de tranzacții). Produsul într-un Space = pointer (product_id)
-- + delta locală (stoc, tag-uri locale), NU clonă.

create table spaces (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  name                  text not null,
  allow_negative_stock  boolean not null default false,  -- setat o singură dată la creare
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_spaces_updated_at
  before update on spaces
  for each row execute procedure extensions.moddatetime(updated_at);

-- Pointer + delta. PK compus — variantele/SKU (viitor) vor lega stocul de
-- variant_id, moment în care acest PK se va extinde (notă §10 din spec).
create table space_products (
  tenant_id    uuid not null references tenants(id) on delete cascade,
  space_id     uuid not null references spaces(id) on delete cascade,
  product_id   uuid not null references products(id) on delete restrict,
  stock        numeric not null default 0,
  local_tags   text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (space_id, product_id)
);

create index idx_space_products_product on space_products(product_id);

create trigger trg_space_products_updated_at
  before update on space_products
  for each row execute procedure extensions.moddatetime(updated_at);

-- Tranzacții — schema de bază (§10). Sursă = catalog sau un Space; destinația
-- e mereu un Space (Catalogul e exclus ca destinație, §7.2 ARCHITECTURE).
-- Motorul complet de procesare a coșului (Cart) rămâne de construit separat —
-- aici doar structura de date.
create table transactions (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  source_type            text not null check (source_type in ('catalog', 'space')),
  source_space_id        uuid references spaces(id) on delete restrict,
  destination_space_id   uuid not null references spaces(id) on delete restrict,
  created_at             timestamptz not null default now(),
  constraint chk_transactions_source_space check (
    (source_type = 'catalog' and source_space_id is null) or
    (source_type = 'space' and source_space_id is not null)
  )
);

create index idx_transactions_source_space on transactions(source_space_id);
create index idx_transactions_destination_space on transactions(destination_space_id);

create table transaction_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  transaction_id  uuid not null references transactions(id) on delete cascade,
  product_id      uuid not null references products(id) on delete restrict,
  quantity        numeric not null,
  unit_cost       numeric,               -- alimentează PMP; decizia de preț/cost rămâne deschisă (§11)
  created_at      timestamptz not null default now()
);

create index idx_transaction_items_transaction on transaction_items(transaction_id);
create index idx_transaction_items_product on transaction_items(product_id);

-- ── add_product_to_space — pointer + delta, „prima apariție” = insert pointer ─
-- RPC de bază (fără motorul complet de Cart): inserează pointerul cu stocul
-- dat dacă nu există încă, altfel adaugă la stocul existent (delta locală).
create or replace function add_product_to_space(
  p_tenant_id   uuid,
  p_space_id    uuid,
  p_product_id  uuid,
  p_quantity    numeric
)
returns void
language plpgsql
security definer
as $$
begin
  insert into space_products (tenant_id, space_id, product_id, stock)
  values (p_tenant_id, p_space_id, p_product_id, p_quantity)
  on conflict (space_id, product_id)
  do update set stock = space_products.stock + excluded.stock;
end $$;

-- ── filter_idx local de Space (§3.3, §6.2.4 SPEC_LocalFilter_v3) ────────────
-- Doar tag-urile locale de Space sunt indexate ca valori discrete aici.
-- `stoc` NU e inclus — filtrarea de tip interval numeric e deferred explicit
-- (SPEC_LocalFilter_v3 §12.7); structura `filter_idx` curentă suportă doar
-- valori discrete (value → idx), nu range-uri.
create or replace function rebuild_filter_idx_space(p_tenant_id uuid, p_space_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_idx jsonb := '{}'::jsonb;
  v_tags jsonb;
begin
  with tag_pairs as (
    select unnest(sp.local_tags) as val, sp.product_id as product_id
      from space_products sp
     where sp.tenant_id = p_tenant_id
       and sp.space_id = p_space_id
  ),
  tag_grouped as (
    select val, jsonb_agg(product_id::text order by product_id) as ids
      from tag_pairs
     group by val
  )
  select jsonb_agg(jsonb_build_object('value', val, 'idx', ids) order by val)
    into v_tags
    from tag_grouped;

  if v_tags is not null then
    v_idx := v_idx || jsonb_build_object('local_tags', v_tags);
  end if;

  insert into filter_idx (tenant_id, scope_type, scope_id, idx, rebuilt_at)
  values (p_tenant_id, 'space', p_space_id, v_idx, now())
  on conflict (tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set idx = excluded.idx, rebuilt_at = excluded.rebuilt_at;
end $$;

create or replace function trg_rebuild_filter_idx_on_space_product_change()
returns trigger language plpgsql security definer as $$
declare
  v_tenant_id uuid;
  v_space_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);
  v_space_id := coalesce(new.space_id, old.space_id);
  perform rebuild_filter_idx_space(v_tenant_id, v_space_id);
  return null;
end $$;

create trigger trg_space_products_filter_idx
  after insert or update or delete on space_products
  for each row execute procedure trg_rebuild_filter_idx_on_space_product_change();


-- ==========================================
-- File: 20260704121300_schema_rpc.sql
-- ==========================================

-- RPC-uri pentru schema dinamică de categorie (nu erau în SPEC_CatalogRPC.md —
-- document v2, dependent de SPEC_DatabaseSchema_v2 fără `filterable`/`global_attribute_id`;
-- nu se modifică acel fișier, dar logica de aici e consistentă cu schema v3, §5).
create or replace function create_category_attribute(
  p_tenant_id            uuid,
  p_category_id          uuid,
  p_name                 text,
  p_attribute_type       text,
  p_filterable           boolean default null,  -- null → default după tip (§5, §6.1.2 SPEC_LocalFilter_v3)
  p_global_attribute_id  uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_trimmed text := trim(p_name);
  v_filterable boolean;
begin
  if p_attribute_type not in ('text', 'single_choice') then
    raise exception 'attribute_type invalid: %', p_attribute_type;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele atributului nu poate fi gol';
  end if;

  v_filterable := coalesce(p_filterable, p_attribute_type = 'single_choice');

  begin
    insert into category_attributes (
      tenant_id, category_id, name, attribute_type, filterable, global_attribute_id, position
    )
    values (
      p_tenant_id, p_category_id, v_trimmed, p_attribute_type, v_filterable, p_global_attribute_id,
      coalesce(
        (select max(position) + 1 from category_attributes
          where category_id = p_category_id and tenant_id = p_tenant_id),
        0
      )
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Există deja un atribut „%” în această categorie', v_trimmed;
  end;

  return v_new_id;
end $$;

create or replace function add_category_attribute_option(
  p_tenant_id    uuid,
  p_attribute_id uuid,
  p_value        text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_trimmed text := trim(p_value);
begin
  if v_trimmed = '' then
    raise exception 'Valoarea nu poate fi goală';
  end if;

  begin
    insert into category_attribute_options (tenant_id, attribute_id, value, position)
    values (
      p_tenant_id, p_attribute_id, v_trimmed,
      coalesce(
        (select max(position) + 1 from category_attribute_options where attribute_id = p_attribute_id),
        0
      )
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Există deja valoarea „%”', v_trimmed;
  end;

  return v_new_id;
end $$;


-- ==========================================
-- File: 20260704121400_seed_tenant.sql
-- ==========================================

-- SPEC_CatalogRPC.md §7 — un singur tenant fix pentru development, hardcodat
-- temporar în client (până la autentificare reală).
insert into tenants (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Tenant')
on conflict (id) do nothing;


-- ==========================================
-- File: 20260705120000_tenant_membership.sql
-- ==========================================

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


-- ==========================================
-- File: 20260705120100_remove_seed_tenant.sql
-- ==========================================

-- Decizie: tenantul de seed (20260704121400_seed_tenant.sql) nu are user
-- asociat și nu va primi vreodată unul — sub RLS ar deveni oricum inaccesibil
-- (nicio sesiune auth.uid() nu are rând în tenant_members pentru el). Îl
-- ștergem explicit acum, în loc să rămână orfan la nesfârșit. Cascadează pe
-- categories/products/etc. (toate au `on delete cascade` către tenants).
--
-- Contul demo pre-populat (categorii + produse pentru demonstrație inițială la
-- tenanți noi) e o funcționalitate de produs separată — nu se construiește
-- aici (task-ul curent e strict Auth + RLS). Când se implementează, se va crea
-- un tenant demo dedicat, populat deliberat, nu acest artefact de dev.
--
-- Ștergere explicită, în ordine, înainte de tenant: cascada FK de pe
-- `category_attributes`/`products` declanșează triggere de rebuild
-- `filter_idx` (§7.1 SPEC_DatabaseSchema_v3) care ar insera cu un
-- `tenant_id` deja șters dacă am lăsa totul pe seama `on delete cascade`
-- direct pe `tenants`.
delete from filter_idx where tenant_id = '00000000-0000-0000-0000-000000000001';
delete from category_attributes where tenant_id = '00000000-0000-0000-0000-000000000001';
delete from products where tenant_id = '00000000-0000-0000-0000-000000000001';
delete from tenants where id = '00000000-0000-0000-0000-000000000001';


-- ==========================================
-- File: 20260705120200_enable_rls.sql
-- ==========================================

-- RLS pe toate tabelele cu tenant_id — un user autentificat citește/scrie
-- doar rândurile tenantului lui (SPEC_DatabaseSchema_v3 §9, activat acum că
-- există al doilea "tenant real": autentificare Google).
--
-- RPC-urile de mutație rulează `security definer` (deci tehnic ocolesc RLS),
-- dar ele deduc `tenant_id` din `current_tenant_id()` intern (vezi migrarea
-- următoare) — RLS de aici e linia de apărare pentru citirile directe făcute
-- de client prin `supabase.from(...)`.

alter table tenants enable row level security;
create policy tenants_isolation on tenants
  for select using (id = current_tenant_id());
create policy tenants_update on tenants
  for update using (id = current_tenant_id()) with check (id = current_tenant_id());

alter table tenant_members enable row level security;
create policy tenant_members_isolation on tenant_members
  for select using (tenant_id = current_tenant_id() or user_id = auth.uid());

alter table categories enable row level security;
create policy categories_isolation on categories
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table global_attributes enable row level security;
create policy global_attributes_isolation on global_attributes
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table global_attribute_options enable row level security;
create policy global_attribute_options_isolation on global_attribute_options
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table category_attributes enable row level security;
create policy category_attributes_isolation on category_attributes
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table category_attribute_options enable row level security;
create policy category_attribute_options_isolation on category_attribute_options
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table products enable row level security;
create policy products_isolation on products
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table filter_idx enable row level security;
create policy filter_idx_isolation on filter_idx
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table spaces enable row level security;
create policy spaces_isolation on spaces
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table space_products enable row level security;
create policy space_products_isolation on space_products
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table transactions enable row level security;
create policy transactions_isolation on transactions
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table transaction_items enable row level security;
create policy transaction_items_isolation on transaction_items
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());


-- ==========================================
-- File: 20260705120300_rpc_session_tenant.sql
-- ==========================================

-- RPC-urile existente primeau `p_tenant_id` direct din client — nesigur,
-- falsificabil. Le rescriem să deducă tenantul din sesiune (`current_tenant_id()`,
-- migrarea anterioară), nu din input extern. Semnătura se schimbă (un
-- parametru mai puțin) → drop explicit înainte de create or replace.

drop function if exists create_category(uuid, uuid, text, text);
drop function if exists move_node(uuid, uuid, uuid);
drop function if exists get_valid_move_targets(uuid, uuid);
drop function if exists delete_folder(uuid, uuid);
drop function if exists soft_delete_category(uuid, uuid);
drop function if exists restore_from_trash(uuid, uuid);
drop function if exists group_nodes(uuid, uuid[], text);
drop function if exists create_temp_folder(uuid);
drop function if exists dissolve_temp_folder(uuid, uuid);
drop function if exists promote_temp_folder(uuid, uuid, text);
drop function if exists cleanup_temp_folders(uuid);
drop function if exists create_category_attribute(uuid, uuid, text, text, boolean, uuid);
drop function if exists add_category_attribute_option(uuid, uuid, text);
drop function if exists create_product(uuid, uuid, jsonb, text[], numeric);
drop function if exists add_product_to_space(uuid, uuid, uuid, numeric);

-- ── create_category ──────────────────────────────────────────────────────
create or replace function create_category(
  p_parent_id   uuid,
  p_name        text,
  p_node_type   text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_new_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_tenant_id is null then
    raise exception 'Niciun tenant asociat sesiunii curente';
  end if;

  if p_node_type not in ('folder', 'category') then
    raise exception 'node_type invalid: %', p_node_type;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele nu poate fi gol';
  end if;

  if p_parent_id is not null then
    if not exists (
      select 1 from categories
       where id = p_parent_id
         and tenant_id = v_tenant_id
         and node_type = 'folder'
         and deleted_at is null
    ) then
      raise exception 'Părintele % nu există, nu e folder, sau e șters', p_parent_id;
    end if;
  end if;

  begin
    insert into categories (tenant_id, parent_id, name, node_type, position)
    values (
      v_tenant_id,
      p_parent_id,
      v_trimmed,
      p_node_type,
      coalesce(
        (select max(position) + 1 from categories
          where tenant_id = v_tenant_id
            and parent_id is not distinct from p_parent_id
            and deleted_at is null),
        0
      )
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Categoria „%” există deja', v_trimmed;
  end;

  return v_new_id;
end $$;

-- ── move_node ─────────────────────────────────────────────────────────────
create or replace function move_node(
  p_node_id       uuid,
  p_new_parent_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_current_parent_id uuid;
begin
  select parent_id into v_current_parent_id
    from categories
   where id = p_node_id
     and tenant_id = v_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Nodul % nu există sau e șters', p_node_id;
  end if;

  if p_new_parent_id is not distinct from v_current_parent_id then
    return;
  end if;

  if p_new_parent_id is not null then
    if not exists (
      select 1 from categories
       where id = p_new_parent_id
         and tenant_id = v_tenant_id
         and deleted_at is null
    ) then
      raise exception 'Destinația % nu există sau e ștearsă', p_new_parent_id;
    end if;

    if (select node_type from categories where id = p_new_parent_id) = 'category' then
      raise exception 'Destinația % este o categorie (frunză), nu poate avea copii', p_new_parent_id;
    end if;

    if p_new_parent_id = p_node_id then
      raise exception 'Un nod nu poate fi mutat în el însuși';
    end if;

    if exists (
      with recursive descendants as (
        select id from categories where parent_id = p_node_id
        union all
        select c.id from categories c
          join descendants d on c.parent_id = d.id
      )
      select 1 from descendants where id = p_new_parent_id
    ) then
      raise exception 'Destinația % este un descendent al nodului % — mutarea ar crea un ciclu',
        p_new_parent_id, p_node_id;
    end if;
  end if;

  update categories
     set parent_id = p_new_parent_id,
         position = coalesce(
           (select max(position) + 1 from categories
             where tenant_id = v_tenant_id
               and parent_id is not distinct from p_new_parent_id
               and deleted_at is null),
           0
         )
   where id = p_node_id;
end $$;

-- ── get_valid_move_targets ────────────────────────────────────────────────
create or replace function get_valid_move_targets(
  p_node_id     uuid
)
returns table (id uuid, parent_id uuid, name text, depth integer)
language sql
stable
security definer
as $$
  with recursive
    excluded as (
      select id from categories where id = p_node_id
      union all
      select c.id from categories c join excluded e on c.parent_id = e.id
    ),
    folders as (
      select c.id, c.parent_id, c.name, 0 as depth
        from categories c
       where c.tenant_id = current_tenant_id()
         and c.node_type = 'folder'
         and c.deleted_at is null
         and c.is_temp = false
         and c.parent_id is null
      union all
      select c.id, c.parent_id, c.name, f.depth + 1
        from categories c
        join folders f on c.parent_id = f.id
       where c.node_type = 'folder'
         and c.deleted_at is null
         and c.is_temp = false
    )
  select f.id, f.parent_id, f.name, f.depth
    from folders f
   where f.id not in (select id from excluded)
   order by f.depth, f.name;
$$;

-- ── delete_folder ─────────────────────────────────────────────────────────
create or replace function delete_folder(
  p_folder_id   uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_node_type   text;
  v_parent_id   uuid;
begin
  select node_type, parent_id into v_node_type, v_parent_id
    from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Folderul % nu există sau e șters', p_folder_id;
  end if;

  if v_node_type <> 'folder' then
    raise exception 'Nodul % nu este un folder (este %)', p_folder_id, v_node_type;
  end if;

  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = v_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;
end $$;

-- ── soft_delete_category ──────────────────────────────────────────────────
create or replace function soft_delete_category(
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_node_type text;
begin
  select node_type into v_node_type
    from categories
   where id = p_category_id
     and tenant_id = v_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Categoria % nu există sau e deja ștearsă', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Nodul % nu este o categorie (este %) — folderele nu au soft-delete',
      p_category_id, v_node_type;
  end if;

  update categories
     set deleted_at = now()
   where id = p_category_id
     and tenant_id = v_tenant_id;
end $$;

-- ── restore_from_trash ────────────────────────────────────────────────────
create or replace function restore_from_trash(
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_node_type text;
  v_deleted_at timestamptz;
  v_name text;
begin
  select node_type, deleted_at, name into v_node_type, v_deleted_at, v_name
    from categories
   where id = p_category_id
     and tenant_id = v_tenant_id;

  if not found then
    raise exception 'Categoria % nu există', p_category_id;
  end if;

  if v_deleted_at is null then
    raise exception 'Categoria % nu este în Trash', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Doar categoriile pot fi restaurate din Trash (nodul % este %)',
      p_category_id, v_node_type;
  end if;

  begin
    update categories
       set deleted_at = null,
           parent_id = null,
           position = coalesce(
             (select max(position) + 1 from categories
               where tenant_id = v_tenant_id
                 and parent_id is null
                 and deleted_at is null),
             0
           )
     where id = p_category_id
       and tenant_id = v_tenant_id;
  exception
    when unique_violation then
      raise exception 'Există deja o categorie „%” — alege alt nume pentru cea restaurată', v_name;
  end;
end $$;

-- ── group_nodes ───────────────────────────────────────────────────────────
create or replace function group_nodes(
  p_node_ids     uuid[],
  p_folder_name  text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_folder_id uuid;
  v_node_id uuid;
begin
  if array_length(p_node_ids, 1) is null or array_length(p_node_ids, 1) < 2 then
    raise exception 'Gruparea necesită minim 2 elemente';
  end if;

  if exists (
    select 1 from unnest(p_node_ids) as nid
     where not exists (
       select 1 from categories
        where id = nid
          and tenant_id = v_tenant_id
          and parent_id is null
          and deleted_at is null
     )
  ) then
    raise exception 'Toate nodurile trebuie să fie la rădăcină și neșterse';
  end if;

  v_folder_id := create_category(null, p_folder_name, 'folder');

  foreach v_node_id in array p_node_ids loop
    update categories
       set parent_id = v_folder_id
     where id = v_node_id
       and tenant_id = v_tenant_id;
  end loop;

  return v_folder_id;
end $$;

-- ── Mutare cross-folder (Unfold mode) ─────────────────────────────────────

create or replace function create_temp_folder()
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_folder_id uuid;
begin
  insert into categories (tenant_id, parent_id, name, node_type, is_temp, position)
  values (
    v_tenant_id,
    null,
    '__temp_' || gen_random_uuid()::text,
    'folder',
    true,
    -1
  )
  returning id into v_folder_id;

  return v_folder_id;
end $$;

create or replace function dissolve_temp_folder(
  p_folder_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_parent_id uuid;
  v_is_temp   boolean;
begin
  select parent_id, is_temp into v_parent_id, v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;

  if not found then
    raise exception 'Folderul temporar % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = v_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;
end $$;

create or replace function promote_temp_folder(
  p_folder_id  uuid,
  p_new_name   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_is_temp boolean;
  v_trimmed text := trim(p_new_name);
begin
  select is_temp into v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;

  if not found then
    raise exception 'Folderul % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele subfolderului nu poate fi gol';
  end if;

  begin
    update categories
       set is_temp = false,
           name    = v_trimmed
     where id = p_folder_id
       and tenant_id = v_tenant_id;
  exception
    when unique_violation then
      raise exception 'Categoria „%” există deja', v_trimmed;
  end;
end $$;

create or replace function cleanup_temp_folders()
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  update categories
     set parent_id = null
   where parent_id in (
     select id from categories
      where tenant_id = v_tenant_id
        and is_temp = true
   )
   and tenant_id = v_tenant_id;

  delete from categories
   where tenant_id = v_tenant_id
     and is_temp = true;
end $$;

-- ── create_category_attribute ─────────────────────────────────────────────
create or replace function create_category_attribute(
  p_category_id          uuid,
  p_name                 text,
  p_attribute_type       text,
  p_filterable           boolean default null,
  p_global_attribute_id  uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_new_id uuid;
  v_trimmed text := trim(p_name);
  v_filterable boolean;
begin
  if p_attribute_type not in ('text', 'single_choice') then
    raise exception 'attribute_type invalid: %', p_attribute_type;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele atributului nu poate fi gol';
  end if;

  v_filterable := coalesce(p_filterable, p_attribute_type = 'single_choice');

  begin
    insert into category_attributes (
      tenant_id, category_id, name, attribute_type, filterable, global_attribute_id, position
    )
    values (
      v_tenant_id, p_category_id, v_trimmed, p_attribute_type, v_filterable, p_global_attribute_id,
      coalesce(
        (select max(position) + 1 from category_attributes
          where category_id = p_category_id and tenant_id = v_tenant_id),
        0
      )
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Există deja un atribut „%” în această categorie', v_trimmed;
  end;

  return v_new_id;
end $$;

-- ── add_category_attribute_option ─────────────────────────────────────────
create or replace function add_category_attribute_option(
  p_attribute_id uuid,
  p_value        text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_new_id uuid;
  v_trimmed text := trim(p_value);
begin
  if v_trimmed = '' then
    raise exception 'Valoarea nu poate fi goală';
  end if;

  begin
    insert into category_attribute_options (tenant_id, attribute_id, value, position)
    values (
      v_tenant_id, p_attribute_id, v_trimmed,
      coalesce(
        (select max(position) + 1 from category_attribute_options where attribute_id = p_attribute_id),
        0
      )
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Există deja valoarea „%”', v_trimmed;
  end;

  return v_new_id;
end $$;

-- ── create_product ────────────────────────────────────────────────────────
create or replace function create_product(
  p_category_id  uuid,
  p_attributes   jsonb default '{}'::jsonb,
  p_tags         text[] default '{}',
  p_list_price   numeric default null
)
returns text
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_name_id text;
begin
  if not exists (
    select 1 from categories
     where id = p_category_id
       and tenant_id = v_tenant_id
       and node_type = 'category'
       and deleted_at is null
  ) then
    raise exception 'Categoria % nu există, e ștearsă, sau nu e o categorie (frunză)', p_category_id;
  end if;

  v_name_id := generate_name_id(v_tenant_id);

  insert into products (tenant_id, category_id, name_id, attributes, tags, list_price)
  values (
    v_tenant_id,
    p_category_id,
    v_name_id,
    coalesce(p_attributes, '{}'::jsonb),
    coalesce(p_tags, '{}'),
    p_list_price
  );

  return v_name_id;
end $$;

-- ── add_product_to_space ──────────────────────────────────────────────────
create or replace function add_product_to_space(
  p_space_id    uuid,
  p_product_id  uuid,
  p_quantity    numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  insert into space_products (tenant_id, space_id, product_id, stock)
  values (v_tenant_id, p_space_id, p_product_id, p_quantity)
  on conflict (space_id, product_id)
  do update set stock = space_products.stock + excluded.stock;
end $$;



-- ==========================================
-- File: 20260705120400_grants.sql (Permisiuni Supabase)
-- ==========================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
