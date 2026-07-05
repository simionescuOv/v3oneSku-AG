-- RPC-urile existente primeau `p_tenant_id` direct din client — nesigur,
-- falsificabil. Le rescriem să deducă tenantul din sesiune (`current_tenant_id()`,
-- migrarea anterioară), nu din input extern. Semnătura se schimbă (un
-- parametru mai puțin) → drop explicit înainte de create or replace.

drop function if exists create_category(uuid, uuid, text, text);
drop function if exists move_node(uuid, uuid, uuid);
drop function if exists get_valid_move_targets(uuid, uuid);
drop function if exists delete_folder(uuid, uuid);
drop function if exists soft_delete_category(uuid, uuid);
drop function if exists restore_from_trash(uuid, uuid);
drop function if exists group_nodes(uuid, uuid[], text);
drop function if exists create_temp_folder(uuid);
drop function if exists dissolve_temp_folder(uuid, uuid);
drop function if exists promote_temp_folder(uuid, uuid, text);
drop function if exists cleanup_temp_folders(uuid);
drop function if exists create_category_attribute(uuid, uuid, text, text, boolean, uuid);
drop function if exists add_category_attribute_option(uuid, uuid, text);
drop function if exists create_product(uuid, uuid, jsonb, text[], numeric);
drop function if exists add_product_to_space(uuid, uuid, uuid, numeric);

-- ── create_category ──────────────────────────────────────────────────────
create or replace function create_category(
  p_parent_id   uuid,
  p_name        text,
  p_node_type   text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_new_id uuid;
  v_trimmed text := trim(p_name);
begin
  if v_tenant_id is null then
    raise exception 'Niciun tenant asociat sesiunii curente';
  end if;

  if p_node_type not in ('folder', 'category') then
    raise exception 'node_type invalid: %', p_node_type;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele nu poate fi gol';
  end if;

  if p_parent_id is not null then
    if not exists (
      select 1 from categories
       where id = p_parent_id
         and tenant_id = v_tenant_id
         and node_type = 'folder'
         and deleted_at is null
    ) then
      raise exception 'Părintele % nu există, nu e folder, sau e șters', p_parent_id;
    end if;
  end if;

  begin
    insert into categories (tenant_id, parent_id, name, node_type, position)
    values (
      v_tenant_id,
      p_parent_id,
      v_trimmed,
      p_node_type,
      coalesce(
        (select max(position) + 1 from categories
          where tenant_id = v_tenant_id
            and parent_id is not distinct from p_parent_id
            and deleted_at is null),
        0
      )
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Categoria „%” există deja', v_trimmed;
  end;

  return v_new_id;
end $$;

-- ── move_node ─────────────────────────────────────────────────────────────
create or replace function move_node(
  p_node_id       uuid,
  p_new_parent_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_current_parent_id uuid;
begin
  select parent_id into v_current_parent_id
    from categories
   where id = p_node_id
     and tenant_id = v_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Nodul % nu există sau e șters', p_node_id;
  end if;

  if p_new_parent_id is not distinct from v_current_parent_id then
    return;
  end if;

  if p_new_parent_id is not null then
    if not exists (
      select 1 from categories
       where id = p_new_parent_id
         and tenant_id = v_tenant_id
         and deleted_at is null
    ) then
      raise exception 'Destinația % nu există sau e ștearsă', p_new_parent_id;
    end if;

    if (select node_type from categories where id = p_new_parent_id) = 'category' then
      raise exception 'Destinația % este o categorie (frunză), nu poate avea copii', p_new_parent_id;
    end if;

    if p_new_parent_id = p_node_id then
      raise exception 'Un nod nu poate fi mutat în el însuși';
    end if;

    if exists (
      with recursive descendants as (
        select id from categories where parent_id = p_node_id
        union all
        select c.id from categories c
          join descendants d on c.parent_id = d.id
      )
      select 1 from descendants where id = p_new_parent_id
    ) then
      raise exception 'Destinația % este un descendent al nodului % — mutarea ar crea un ciclu',
        p_new_parent_id, p_node_id;
    end if;
  end if;

  update categories
     set parent_id = p_new_parent_id,
         position = coalesce(
           (select max(position) + 1 from categories
             where tenant_id = v_tenant_id
               and parent_id is not distinct from p_new_parent_id
               and deleted_at is null),
           0
         )
   where id = p_node_id;
end $$;

-- ── get_valid_move_targets ────────────────────────────────────────────────
create or replace function get_valid_move_targets(
  p_node_id     uuid
)
returns table (id uuid, parent_id uuid, name text, depth integer)
language sql
stable
security definer
as $$
  with recursive
    excluded as (
      select id from categories where id = p_node_id
      union all
      select c.id from categories c join excluded e on c.parent_id = e.id
    ),
    folders as (
      select c.id, c.parent_id, c.name, 0 as depth
        from categories c
       where c.tenant_id = current_tenant_id()
         and c.node_type = 'folder'
         and c.deleted_at is null
         and c.is_temp = false
         and c.parent_id is null
      union all
      select c.id, c.parent_id, c.name, f.depth + 1
        from categories c
        join folders f on c.parent_id = f.id
       where c.node_type = 'folder'
         and c.deleted_at is null
         and c.is_temp = false
    )
  select f.id, f.parent_id, f.name, f.depth
    from folders f
   where f.id not in (select id from excluded)
   order by f.depth, f.name;
$$;

-- ── delete_folder ─────────────────────────────────────────────────────────
create or replace function delete_folder(
  p_folder_id   uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_node_type   text;
  v_parent_id   uuid;
begin
  select node_type, parent_id into v_node_type, v_parent_id
    from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Folderul % nu există sau e șters', p_folder_id;
  end if;

  if v_node_type <> 'folder' then
    raise exception 'Nodul % nu este un folder (este %)', p_folder_id, v_node_type;
  end if;

  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = v_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;
end $$;

-- ── soft_delete_category ──────────────────────────────────────────────────
create or replace function soft_delete_category(
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_node_type text;
begin
  select node_type into v_node_type
    from categories
   where id = p_category_id
     and tenant_id = v_tenant_id
     and deleted_at is null;

  if not found then
    raise exception 'Categoria % nu există sau e deja ștearsă', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Nodul % nu este o categorie (este %) — folderele nu au soft-delete',
      p_category_id, v_node_type;
  end if;

  update categories
     set deleted_at = now()
   where id = p_category_id
     and tenant_id = v_tenant_id;
end $$;

-- ── restore_from_trash ────────────────────────────────────────────────────
create or replace function restore_from_trash(
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_node_type text;
  v_deleted_at timestamptz;
  v_name text;
begin
  select node_type, deleted_at, name into v_node_type, v_deleted_at, v_name
    from categories
   where id = p_category_id
     and tenant_id = v_tenant_id;

  if not found then
    raise exception 'Categoria % nu există', p_category_id;
  end if;

  if v_deleted_at is null then
    raise exception 'Categoria % nu este în Trash', p_category_id;
  end if;

  if v_node_type <> 'category' then
    raise exception 'Doar categoriile pot fi restaurate din Trash (nodul % este %)',
      p_category_id, v_node_type;
  end if;

  begin
    update categories
       set deleted_at = null,
           parent_id = null,
           position = coalesce(
             (select max(position) + 1 from categories
               where tenant_id = v_tenant_id
                 and parent_id is null
                 and deleted_at is null),
             0
           )
     where id = p_category_id
       and tenant_id = v_tenant_id;
  exception
    when unique_violation then
      raise exception 'Există deja o categorie „%” — alege alt nume pentru cea restaurată', v_name;
  end;
end $$;

-- ── group_nodes ───────────────────────────────────────────────────────────
create or replace function group_nodes(
  p_node_ids     uuid[],
  p_folder_name  text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_folder_id uuid;
  v_node_id uuid;
begin
  if array_length(p_node_ids, 1) is null or array_length(p_node_ids, 1) < 2 then
    raise exception 'Gruparea necesită minim 2 elemente';
  end if;

  if exists (
    select 1 from unnest(p_node_ids) as nid
     where not exists (
       select 1 from categories
        where id = nid
          and tenant_id = v_tenant_id
          and parent_id is null
          and deleted_at is null
     )
  ) then
    raise exception 'Toate nodurile trebuie să fie la rădăcină și neșterse';
  end if;

  v_folder_id := create_category(null, p_folder_name, 'folder');

  foreach v_node_id in array p_node_ids loop
    update categories
       set parent_id = v_folder_id
     where id = v_node_id
       and tenant_id = v_tenant_id;
  end loop;

  return v_folder_id;
end $$;

-- ── Mutare cross-folder (Unfold mode) ─────────────────────────────────────

create or replace function create_temp_folder()
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_folder_id uuid;
begin
  insert into categories (tenant_id, parent_id, name, node_type, is_temp, position)
  values (
    v_tenant_id,
    null,
    '__temp_' || gen_random_uuid()::text,
    'folder',
    true,
    -1
  )
  returning id into v_folder_id;

  return v_folder_id;
end $$;

create or replace function dissolve_temp_folder(
  p_folder_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_parent_id uuid;
  v_is_temp   boolean;
begin
  select parent_id, is_temp into v_parent_id, v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;

  if not found then
    raise exception 'Folderul temporar % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = v_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;
end $$;

create or replace function promote_temp_folder(
  p_folder_id  uuid,
  p_new_name   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_is_temp boolean;
  v_trimmed text := trim(p_new_name);
begin
  select is_temp into v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = v_tenant_id;

  if not found then
    raise exception 'Folderul % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  if v_trimmed = '' then
    raise exception 'Numele subfolderului nu poate fi gol';
  end if;

  begin
    update categories
       set is_temp = false,
           name    = v_trimmed
     where id = p_folder_id
       and tenant_id = v_tenant_id;
  exception
    when unique_violation then
      raise exception 'Categoria „%” există deja', v_trimmed;
  end;
end $$;

create or replace function cleanup_temp_folders()
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  update categories
     set parent_id = null
   where parent_id in (
     select id from categories
      where tenant_id = v_tenant_id
        and is_temp = true
   )
   and tenant_id = v_tenant_id;

  delete from categories
   where tenant_id = v_tenant_id
     and is_temp = true;
end $$;

-- ── create_category_attribute ─────────────────────────────────────────────
create or replace function create_category_attribute(
  p_category_id          uuid,
  p_name                 text,
  p_attribute_type       text,
  p_filterable           boolean default null,
  p_global_attribute_id  uuid default null
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
      v_tenant_id, p_category_id, v_trimmed, p_attribute_type, v_filterable, p_global_attribute_id,
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

-- ── add_category_attribute_option ─────────────────────────────────────────
create or replace function add_category_attribute_option(
  p_attribute_id uuid,
  p_value        text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
  v_new_id uuid;
  v_trimmed text := trim(p_value);
begin
  if v_trimmed = '' then
    raise exception 'Valoarea nu poate fi goală';
  end if;

  begin
    insert into category_attribute_options (tenant_id, attribute_id, value, position)
    values (
      v_tenant_id, p_attribute_id, v_trimmed,
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

-- ── create_product ────────────────────────────────────────────────────────
create or replace function create_product(
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
  v_tenant_id uuid := current_tenant_id();
  v_name_id text;
begin
  if not exists (
    select 1 from categories
     where id = p_category_id
       and tenant_id = v_tenant_id
       and node_type = 'category'
       and deleted_at is null
  ) then
    raise exception 'Categoria % nu există, e ștearsă, sau nu e o categorie (frunză)', p_category_id;
  end if;

  v_name_id := generate_name_id(v_tenant_id);

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

-- ── add_product_to_space ──────────────────────────────────────────────────
create or replace function add_product_to_space(
  p_space_id    uuid,
  p_product_id  uuid,
  p_quantity    numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := current_tenant_id();
begin
  insert into space_products (tenant_id, space_id, product_id, stock)
  values (v_tenant_id, p_space_id, p_product_id, p_quantity)
  on conflict (space_id, product_id)
  do update set stock = space_products.stock + excluded.stock;
end $$;
