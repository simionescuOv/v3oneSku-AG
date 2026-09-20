-- Modificăm VIEW-ul spaces_summary pentru a rula cu permisiunile invoker-ului
-- Aceasta asigură că RLS-ul de pe tabelele spaces și space_products este respectat

drop view if exists spaces_summary;

create or replace view spaces_summary with (security_invoker = true) as
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

