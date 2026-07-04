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
