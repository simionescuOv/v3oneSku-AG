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
