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
