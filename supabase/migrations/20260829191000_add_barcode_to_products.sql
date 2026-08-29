-- Adăugare coloană barcode la produse
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;

-- Index unic pe tenant (permite NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode);

-- Actualizare RPC create_product pentru a suporta barcode
drop function if exists create_product(uuid, jsonb, text[], numeric, text);
drop function if exists create_product(uuid, jsonb, text[], numeric, text, text);

create or replace function create_product(
  p_category_id  uuid,
  p_attributes   jsonb default '{}'::jsonb,
  p_tags         text[] default '{}',
  p_list_price   numeric default null,
  p_name_id      text default null,
  p_barcode      text default null
)
returns text
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_name_id text;
  v_trimmed_name text;
  v_trimmed_barcode text;
begin
  if v_tenant_id is null then
    raise exception 'Niciun tenant asociat sesiunii curente';
  end if;

  if not exists (
    select 1 from categories
     where id = p_category_id
       and tenant_id = v_tenant_id
       and node_type = 'category'
       and deleted_at is null
  ) then
    raise exception 'Categoria % nu există, e ștearsă, sau nu e o categorie (frunză)', p_category_id;
  end if;

  if p_name_id is not null and trim(p_name_id) <> '' then
    v_trimmed_name := trim(p_name_id);
    if exists (
      select 1 from products
       where tenant_id = v_tenant_id
         and lower(name_id) = lower(v_trimmed_name)
         and deleted_at is null
    ) then
      raise exception 'Există deja un produs cu NameID-ul „%”', v_trimmed_name;
    end if;
    v_name_id := v_trimmed_name;
  else
    v_name_id := generate_name_id(v_tenant_id);
  end if;

  if p_barcode is not null and trim(p_barcode) <> '' then
    v_trimmed_barcode := trim(p_barcode);
    if exists (
      select 1 from products
       where tenant_id = v_tenant_id
         and barcode = v_trimmed_barcode
    ) then
      raise exception 'Există deja un produs cu codul de bare „%”', v_trimmed_barcode;
    end if;
  else
    v_trimmed_barcode := null;
  end if;

  insert into products (tenant_id, category_id, name_id, attributes, tags, list_price, barcode)
  values (
    v_tenant_id,
    p_category_id,
    v_name_id,
    coalesce(p_attributes, '{}'::jsonb),
    coalesce(p_tags, '{}'),
    p_list_price,
    v_trimmed_barcode
  );

  return v_name_id;
end $$;

-- Actualizare RPC create_products_bulk
create or replace function create_products_bulk(
  p_category_id  uuid,
  p_products     jsonb -- array de obiecte: [{ name_id, attributes, tags, list_price, barcode }]
)
returns integer
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_item jsonb;
  v_name_id text;
  v_barcode text;
  v_count integer := 0;
  v_tags text[];
begin
  if v_tenant_id is null then
    raise exception 'Niciun tenant asociat sesiunii curente';
  end if;

  if not exists (
    select 1 from categories
     where id = p_category_id
       and tenant_id = v_tenant_id
       and node_type = 'category'
       and deleted_at is null
  ) then
    raise exception 'Categoria % nu există, e ștearsă, sau nu e o categorie (frunză)', p_category_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_products) loop
    v_name_id := trim(coalesce(v_item->>'name_id', ''));
    if v_name_id = '' then
      v_name_id := generate_name_id(v_tenant_id);
    end if;

    v_barcode := trim(coalesce(v_item->>'barcode', ''));
    if v_barcode = '' then
      v_barcode := null;
    end if;

    -- Extragere tags ca array de text
    if jsonb_typeof(v_item->'tags') = 'array' then
      select coalesce(array_agg(val), '{}'::text[])
        into v_tags
        from jsonb_array_elements_text(v_item->'tags') as val
       where trim(val) <> '';
    else
      v_tags := '{}'::text[];
    end if;

    insert into products (
      tenant_id,
      category_id,
      name_id,
      attributes,
      tags,
      list_price,
      barcode
    )
    values (
      v_tenant_id,
      p_category_id,
      v_name_id,
      coalesce(v_item->'attributes', '{}'::jsonb),
      coalesce(v_tags, '{}'::text[]),
      case 
        when v_item->>'list_price' is not null and trim(v_item->>'list_price') <> '' then
          (v_item->>'list_price')::numeric
        else null
      end,
      v_barcode
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
