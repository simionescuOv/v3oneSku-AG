-- 1. Extindem tabelul spaces pentru a suporta ierarhie
alter table spaces
  add column type text not null default 'space' check (type in ('folder', 'space')),
  add column parent_id uuid references spaces(id) on delete cascade,
  add column position numeric;

-- Index pentru performanța căutărilor ierarhice
create index idx_spaces_parent on spaces(parent_id);

-- Restricție de integritate: doar folderele pot fi părinți
-- (Același mecanism ca la catalog)
-- Funcție helper pentru trigger (verifică tipul părintelui)
create or replace function check_space_parent_is_folder()
returns trigger
language plpgsql
security definer as $$
declare
  v_parent_type text;
begin
  if new.parent_id is not null then
    select type into v_parent_type from spaces where id = new.parent_id;
    if v_parent_type != 'folder' then
      raise exception 'A space cannot be a parent. Only folders can have children.';
    end if;
  end if;
  return new;
end $$;

create trigger trg_check_space_parent
  before insert or update on spaces
  for each row execute procedure check_space_parent_is_folder();

-- Restricție de integritate pentru space_products (inventar / tranzacții):
-- Tranzacțiile/Produsele se pot atasa strict de "space", nu de "folder"
create or replace function check_space_product_target_is_space()
returns trigger
language plpgsql
security definer as $$
declare
  v_target_type text;
begin
  select type into v_target_type from spaces where id = new.space_id;
  if v_target_type != 'space' then
    raise exception 'Products and inventory can only be attached to a space, not a folder.';
  end if;
  return new;
end $$;

create trigger trg_check_space_product_target
  before insert or update on space_products
  for each row execute procedure check_space_product_target_is_space();

-- 2. Modificăm VIEW-ul spaces_summary
-- Drop view-ul existent și recreăm
drop view if exists spaces_summary;

create or replace view spaces_summary as
select
  s.id,
  s.tenant_id,
  s.name,
  s.type,
  s.parent_id,
  s.position,
  s.allow_negative_stock,
  s.created_at,
  coalesce(count(distinct sp.product_id), 0) as product_count,
  coalesce(sum(sp.stock), 0) as total_units
from spaces s
left join space_products sp on sp.space_id = s.id
group by s.id;
