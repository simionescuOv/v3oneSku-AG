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
