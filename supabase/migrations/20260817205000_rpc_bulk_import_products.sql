-- RPC pentru import în masă (bulk) produse într-o singură tranzacție rapidă
-- Optimizează timpul de execuție de la sute de secunde la sub 1 secundă.

create or replace function create_products_bulk(
  p_category_id  uuid,
  p_products     jsonb -- array de obiecte: [{ name_id, attributes, tags, list_price }]
)
returns integer
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_item jsonb;
  v_name_id text;
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
      list_price
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
      end
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;
