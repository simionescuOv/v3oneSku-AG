-- SPEC_DatabaseSchema_v3 §4 — registry independent de atribute cross-categorie (ex. Brand).
create table global_attributes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  attribute_type text not null check (attribute_type in ('single_choice')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index uq_global_attributes_name on global_attributes(tenant_id, name);

create trigger trg_global_attributes_updated_at
  before update on global_attributes
  for each row execute procedure extensions.moddatetime(updated_at);

-- ── 4.1 Opțiunile atributelor globale ───────────────────────────────────────
create table global_attribute_options (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  global_attribute_id  uuid not null references global_attributes(id) on delete cascade,
  value                text not null,
  position             integer not null default 0,
  created_at           timestamptz not null default now()
);

create index idx_global_attr_options_attr on global_attribute_options(global_attribute_id);
create unique index uq_global_attr_options_value
  on global_attribute_options(global_attribute_id, value);
