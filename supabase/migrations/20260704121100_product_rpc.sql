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
