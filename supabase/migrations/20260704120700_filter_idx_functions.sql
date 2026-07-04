-- SPEC_LocalFilter_v3 §4, §7, §8.4 — rebuild integral (GROUP BY), niciodată incremental.
-- `idx` = { "<attr_key_sau_global_id_sau_'tags'>": [ {"value": v, "idx": [product_id,...]}, ... ] }

-- ── rebuild_filter_idx_category ──────────────────────────────────────────────
-- Doar atributele LOCALE `filterable` ale schemei categoriei, doar produsele
-- acelei categorii (neșterse). Cheile rămân id-uri locale (category_attributes.id).
create or replace function rebuild_filter_idx_category(p_tenant_id uuid, p_category_id uuid)
returns void language plpgsql security definer as $$
declare
  v_idx jsonb;
begin
  with vals as (
    select ca.id as attr_id, p.attributes ->> ca.id::text as val, p.id as product_id
      from category_attributes ca
      join products p
        on p.category_id = ca.category_id
       and p.tenant_id = ca.tenant_id
     where ca.category_id = p_category_id
       and ca.tenant_id = p_tenant_id
       and ca.filterable = true
       and p.deleted_at is null
       and p.attributes ? ca.id::text
  ),
  grouped as (
    select attr_id, val, jsonb_agg(product_id::text order by product_id) as ids
      from vals
     group by attr_id, val
  ),
  per_attr as (
    select attr_id, jsonb_agg(jsonb_build_object('value', val, 'idx', ids) order by val) as values_arr
      from grouped
     group by attr_id
  )
  select coalesce(jsonb_object_agg(attr_id::text, values_arr), '{}'::jsonb)
    into v_idx
    from per_attr;

  insert into filter_idx (tenant_id, scope_type, scope_id, idx, rebuilt_at)
  values (p_tenant_id, 'category', p_category_id, v_idx, now())
  on conflict (tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set idx = excluded.idx, rebuilt_at = excluded.rebuilt_at;
end $$;

-- ── rebuild_filter_idx_global ────────────────────────────────────────────────
-- Doar Tags + atributele GLOBALE `filterable` (mapare local → global_attribute_id
-- rezolvată aici, §7.2/§8.3), peste TOATE produsele tenantului.
create or replace function rebuild_filter_idx_global(p_tenant_id uuid)
returns void language plpgsql security definer as $$
declare
  v_idx jsonb := '{}'::jsonb;
  v_tags jsonb;
  v_attrs jsonb;
begin
  -- Tags: flat, OR — un produs poate apărea la mai multe valori.
  with tag_pairs as (
    select unnest(p.tags) as val, p.id as product_id
      from products p
     where p.tenant_id = p_tenant_id
       and p.deleted_at is null
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
    v_idx := v_idx || jsonb_build_object('tags', v_tags);
  end if;

  -- Atribute globale: pentru fiecare categorie, cheile locale legate de un
  -- global_attribute_id se agregă sub acel id global, indiferent de categorie.
  with vals as (
    select ca.global_attribute_id as gid, p.attributes ->> ca.id::text as val, p.id as product_id
      from category_attributes ca
      join products p
        on p.category_id = ca.category_id
       and p.tenant_id = ca.tenant_id
     where ca.tenant_id = p_tenant_id
       and ca.global_attribute_id is not null
       and ca.filterable = true
       and p.deleted_at is null
       and p.attributes ? ca.id::text
  ),
  grouped as (
    select gid, val, jsonb_agg(product_id::text order by product_id) as ids
      from vals
     group by gid, val
  ),
  per_attr as (
    select gid, jsonb_agg(jsonb_build_object('value', val, 'idx', ids) order by val) as values_arr
      from grouped
     group by gid
  )
  select jsonb_object_agg(gid::text, values_arr)
    into v_attrs
    from per_attr;

  if v_attrs is not null then
    v_idx := v_idx || v_attrs;
  end if;

  insert into filter_idx (tenant_id, scope_type, scope_id, idx, rebuilt_at)
  values (p_tenant_id, 'global', null, v_idx, now())
  on conflict (tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set idx = excluded.idx, rebuilt_at = excluded.rebuilt_at;
end $$;
