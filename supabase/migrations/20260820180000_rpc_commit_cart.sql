-- 1. Tabel pentru alerte de stoc negativ neașteptat
create table stock_alerts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  space_id     uuid not null references spaces(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  stock_value  numeric not null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Indexuri pentru performanță
create index idx_stock_alerts_tenant on stock_alerts(tenant_id);
create index idx_stock_alerts_space on stock_alerts(space_id);
create index idx_stock_alerts_resolved on stock_alerts(resolved_at);

-- RLS pentru stock_alerts
alter table stock_alerts enable row level security;

create policy "Tenant members can view their stock_alerts" on stock_alerts
  for select using (tenant_id = (select get_session_tenant_id()));

create policy "Tenant members can update their stock_alerts" on stock_alerts
  for update using (tenant_id = (select get_session_tenant_id()));

-- 2. VIEW pentru spaces summary (înlocuiește mock-urile din StockHub)
create or replace view spaces_summary as
select
  s.id,
  s.tenant_id,
  s.name,
  s.allow_negative_stock,
  s.created_at,
  coalesce(count(distinct sp.product_id), 0) as product_count,
  coalesce(sum(sp.stock), 0) as total_units
from spaces s
left join space_products sp on sp.space_id = s.id
group by s.id;

-- 3. RPC pentru commit_cart (tranzacție atomică)
create or replace function commit_cart(
  p_source_type          text,
  p_source_space_id      uuid,
  p_destination_space_id uuid,
  p_items                jsonb
) returns jsonb
language plpgsql security definer as $$
declare
  v_tenant_id uuid;
  v_transaction_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_dest_stock numeric;
  v_source_stock numeric;
  v_dest_allow_negative boolean;
  v_source_allow_negative boolean;
  v_alerts jsonb := '[]'::jsonb;
begin
  -- Preia tenant-ul curent din sesiune
  v_tenant_id := get_session_tenant_id();
  if v_tenant_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Validări
  if p_source_type not in ('catalog', 'space') then
    raise exception 'Invalid source_type. Must be catalog or space.';
  end if;

  if p_source_type = 'space' and p_source_space_id = p_destination_space_id then
    raise exception 'Source and destination spaces cannot be the same.';
  end if;

  -- Verifică destinația
  select allow_negative_stock into v_dest_allow_negative
  from spaces where id = p_destination_space_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'Destination space not found or unauthorized.';
  end if;

  -- Verifică sursa dacă e space
  if p_source_type = 'space' then
    select allow_negative_stock into v_source_allow_negative
    from spaces where id = p_source_space_id and tenant_id = v_tenant_id;
    if not found then
      raise exception 'Source space not found or unauthorized.';
    end if;
  end if;

  -- Creează tranzacția
  insert into transactions (tenant_id, source_type, source_space_id, destination_space_id)
  values (v_tenant_id, p_source_type, p_source_space_id, p_destination_space_id)
  returning id into v_transaction_id;

  -- Procesează item-urile
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;

    if v_quantity <= 0 then
      raise exception 'Quantity must be greater than zero.';
    end if;

    -- Inserare transaction_items
    insert into transaction_items (tenant_id, transaction_id, product_id, quantity)
    values (v_tenant_id, v_transaction_id, v_product_id, v_quantity);

    -- Logica de mutare stoc
    if p_source_type = 'catalog' then
      -- Intrare stoc în destinație
      insert into space_products (tenant_id, space_id, product_id, stock)
      values (v_tenant_id, p_destination_space_id, v_product_id, v_quantity)
      on conflict (space_id, product_id)
      do update set stock = space_products.stock + excluded.stock
      returning stock into v_dest_stock;
      
    elsif p_source_type = 'space' then
      -- Scade din sursă
      insert into space_products (tenant_id, space_id, product_id, stock)
      values (v_tenant_id, p_source_space_id, v_product_id, -v_quantity)
      on conflict (space_id, product_id)
      do update set stock = space_products.stock - excluded.stock
      returning stock into v_source_stock;

      -- Adaugă în destinație
      insert into space_products (tenant_id, space_id, product_id, stock)
      values (v_tenant_id, p_destination_space_id, v_product_id, v_quantity)
      on conflict (space_id, product_id)
      do update set stock = space_products.stock + excluded.stock
      returning stock into v_dest_stock;

      -- Verifică alertă pentru sursă (dacă a scăzut sub 0 și nu permite stoc negativ)
      if v_source_stock < 0 and not v_source_allow_negative then
        insert into stock_alerts (tenant_id, space_id, product_id, stock_value)
        values (v_tenant_id, p_source_space_id, v_product_id, v_source_stock);
        
        v_alerts := v_alerts || jsonb_build_object(
          'space_id', p_source_space_id,
          'product_id', v_product_id,
          'stock_value', v_source_stock
        );
      end if;
    end if;

  end loop;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'alerts', v_alerts
  );
end $$;
