-- Expunere RPC generate_name_id() fără parametri (sesiune curentă / tenant_id)
-- și actualizare create_product pentru a accepta p_name_id opțional furnizat de utilizator.

create or replace function generate_name_id()
returns text
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  if v_tenant_id is null then
    raise exception 'Niciun tenant asociat sesiunii curente';
  end if;

  return generate_name_id(v_tenant_id);
end $$;

drop function if exists create_product(uuid, jsonb, text[], numeric);
drop function if exists create_product(uuid, jsonb, text[], numeric, text);

create or replace function create_product(
  p_category_id  uuid,
  p_attributes   jsonb default '{}'::jsonb,
  p_tags         text[] default '{}',
  p_list_price   numeric default null,
  p_name_id      text default null
)
returns text
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_name_id text;
  v_trimmed text;
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
    v_trimmed := trim(p_name_id);
    if exists (
      select 1 from products
       where tenant_id = v_tenant_id
         and lower(name_id) = lower(v_trimmed)
         and deleted_at is null
    ) then
      raise exception 'Există deja un produs cu NameID-ul „%”', v_trimmed;
    end if;
    v_name_id := v_trimmed;
  else
    v_name_id := generate_name_id(v_tenant_id);
  end if;

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
