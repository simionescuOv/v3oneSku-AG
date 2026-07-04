-- SPEC_DatabaseSchema_v3 §7 / SPEC_LocalFilter_v3 §3, §8.4
-- Materializare server-side a celor trei tipuri de index de filtrare.
create table filter_idx (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  scope_type  text not null check (scope_type in ('global', 'category', 'space')),
  scope_id    uuid,                            -- null pt. global; category_id sau space_id altfel
  idx         jsonb not null default '{}',
  rebuilt_at  timestamptz not null default now()
);

create unique index uq_filter_idx_scope
  on filter_idx(tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));
