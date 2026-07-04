-- SPEC_CatalogRPC.md (adaptat la schema v3 — unicitate globală normalizată în
-- loc de per-sibling) + SPEC_MutareCrossFolder.md (foldere temporare).

-- ── create_category — creare cu validare + mesaj clar la coliziune ──────────
create or replace function create_category(
  p_tenant_id   uuid,
  p_parent_id   uuid,
  p_name        text,
  p_node_type   text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_new_id uuid;
  v_trimmed text := trim(p_name);
begin
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
         and tenant_id = p_tenant_id
         and node_type = 'folder'
         and deleted_at is null
    ) then
      raise exception 'Părintele % nu există, nu e folder, sau e șters', p_parent_id;
    end if;
  end if;

  begin
    insert into categories (tenant_id, parent_id, name, node_type, position)
    values (
      p_tenant_id,
      p_parent_id,
      v_trimmed,
      p_node_type,
      coalesce(
        (select max(position) + 1 from categories
          where tenant_id = p_tenant_id
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

-- ── move_node — mutare cu anti-ciclu ─────────────────────────────────────────
create or replace function move_node(
  p_tenant_id     uuid,
  p_node_id       uuid,
  p_new_parent_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_parent_id uuid;
begin
  select parent_id into v_current_parent_id
    from categories
   where id = p_node_id
     and tenant_id = p_tenant_id
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
         and tenant_id = p_tenant_id
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
             where tenant_id = p_tenant_id
               and parent_id is not distinct from p_new_parent_id
               and deleted_at is null),
           0
         )
   where id = p_node_id;
end $$;

-- ── get_valid_move_targets — helper pentru UI picker ─────────────────────────
-- Exclude descendenții nodului (anti-ciclu) și folderele temporare (§5 din
-- SPEC_MutareCrossFolder — niciodată vizibile ca destinație).
create or replace function get_valid_move_targets(
  p_tenant_id   uuid,
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
       where c.tenant_id = p_tenant_id
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

-- ── delete_folder — ștergere cu promovare de conținut ────────────────────────
create or replace function delete_folder(
  p_tenant_id   uuid,
  p_folder_id   uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type   text;
  v_parent_id   uuid;
begin
  select node_type, parent_id into v_node_type, v_parent_id
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id
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
     and tenant_id = p_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;
end $$;

-- ── soft_delete_category — trimitere în Trash ────────────────────────────────
create or replace function soft_delete_category(
  p_tenant_id    uuid,
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type text;
begin
  select node_type into v_node_type
    from categories
   where id = p_category_id
     and tenant_id = p_tenant_id
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
     and tenant_id = p_tenant_id;
end $$;

-- ── restore_from_trash — restaurare la rădăcină, blocată la coliziune ────────
create or replace function restore_from_trash(
  p_tenant_id    uuid,
  p_category_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_node_type text;
  v_deleted_at timestamptz;
  v_name text;
begin
  select node_type, deleted_at, name into v_node_type, v_deleted_at, v_name
    from categories
   where id = p_category_id
     and tenant_id = p_tenant_id;

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
               where tenant_id = p_tenant_id
                 and parent_id is null
                 and deleted_at is null),
             0
           )
     where id = p_category_id
       and tenant_id = p_tenant_id;
  exception
    when unique_violation then
      raise exception 'Există deja o categorie „%” — alege alt nume pentru cea restaurată', v_name;
  end;
end $$;

-- ── group_nodes — grupare (creare folder + mutare copii), doar la rădăcină ───
create or replace function group_nodes(
  p_tenant_id    uuid,
  p_node_ids     uuid[],
  p_folder_name  text
)
returns uuid
language plpgsql
security definer
as $$
declare
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
          and tenant_id = p_tenant_id
          and parent_id is null
          and deleted_at is null
     )
  ) then
    raise exception 'Toate nodurile trebuie să fie la rădăcină și neșterse';
  end if;

  v_folder_id := create_category(p_tenant_id, null, p_folder_name, 'folder');

  foreach v_node_id in array p_node_ids loop
    update categories
       set parent_id = v_folder_id
     where id = v_node_id
       and tenant_id = p_tenant_id;
  end loop;

  return v_folder_id;
end $$;

-- ── Mutare cross-folder (Unfold mode) — SPEC_MutareCrossFolder §2 ────────────

create or replace function create_temp_folder(
  p_tenant_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_folder_id uuid;
begin
  insert into categories (tenant_id, parent_id, name, node_type, is_temp, position)
  values (
    p_tenant_id,
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
  p_tenant_id  uuid,
  p_folder_id  uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_parent_id uuid;
  v_is_temp   boolean;
begin
  select parent_id, is_temp into v_parent_id, v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;

  if not found then
    raise exception 'Folderul temporar % nu există', p_folder_id;
  end if;

  if not v_is_temp then
    raise exception 'Nodul % nu este un folder temporar', p_folder_id;
  end if;

  update categories
     set parent_id = v_parent_id
   where parent_id = p_folder_id
     and tenant_id = p_tenant_id;

  delete from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;
end $$;

create or replace function promote_temp_folder(
  p_tenant_id  uuid,
  p_folder_id  uuid,
  p_new_name   text
)
returns void
language plpgsql
security definer
as $$
declare
  v_is_temp boolean;
  v_trimmed text := trim(p_new_name);
begin
  select is_temp into v_is_temp
    from categories
   where id = p_folder_id
     and tenant_id = p_tenant_id;

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
       and tenant_id = p_tenant_id;
  exception
    when unique_violation then
      raise exception 'Categoria „%” există deja', v_trimmed;
  end;
end $$;

create or replace function cleanup_temp_folders(
  p_tenant_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update categories
     set parent_id = null
   where parent_id in (
     select id from categories
      where tenant_id = p_tenant_id
        and is_temp = true
   )
   and tenant_id = p_tenant_id;

  delete from categories
   where tenant_id = p_tenant_id
     and is_temp = true;
end $$;
