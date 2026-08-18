-- SPEC_DatabaseSchema_v3 & SPEC_LocalFilter_v3 enhancement:
-- Control fin asupra atributelor pre-incarcate local si afisate pe carduri (card_preview).

alter table category_attributes
  add column if not exists card_preview boolean not null default true;

-- Actualizare create_category_attribute pentru a accepta p_card_preview
create or replace function create_category_attribute(
  p_category_id          uuid,
  p_name                 text,
  p_attribute_type       text,
  p_filterable           boolean default null,
  p_global_attribute_id  uuid default null,
  p_card_preview         boolean default null
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
  v_card_preview boolean;
begin
  if p_attribute_type not in ('text', 'single_choice') then
    raise exception 'attribute_type invalid: %', p_attribute_type;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele atributului nu poate fi gol';
  end if;

  v_filterable := coalesce(p_filterable, p_attribute_type = 'single_choice');
  v_card_preview := coalesce(p_card_preview, p_attribute_type = 'single_choice');

  begin
    insert into category_attributes (
      tenant_id, category_id, name, attribute_type, filterable, global_attribute_id, card_preview, position
    )
    values (
      v_tenant_id, p_category_id, v_trimmed, p_attribute_type, v_filterable, p_global_attribute_id, v_card_preview,
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

-- RPC pentru editare setari atribut existent (nume, filterable, card_preview)
create or replace function update_category_attribute(
  p_attribute_id  uuid,
  p_name          text default null,
  p_filterable    boolean default null,
  p_card_preview  boolean default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_trimmed text := nullif(trim(p_name), '');
begin
  update category_attributes
     set name = coalesce(v_trimmed, name),
         filterable = coalesce(p_filterable, filterable),
         card_preview = coalesce(p_card_preview, card_preview),
         updated_at = now()
   where id = p_attribute_id
     and tenant_id = v_tenant_id;

  if not found then
    raise exception 'Atributul % nu există', p_attribute_id;
  end if;
end $$;
