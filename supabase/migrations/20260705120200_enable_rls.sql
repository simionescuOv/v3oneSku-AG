-- RLS pe toate tabelele cu tenant_id — un user autentificat citește/scrie
-- doar rândurile tenantului lui (SPEC_DatabaseSchema_v3 §9, activat acum că
-- există al doilea "tenant real": autentificare Google).
--
-- RPC-urile de mutație rulează `security definer` (deci tehnic ocolesc RLS),
-- dar ele deduc `tenant_id` din `current_tenant_id()` intern (vezi migrarea
-- următoare) — RLS de aici e linia de apărare pentru citirile directe făcute
-- de client prin `supabase.from(...)`.

alter table tenants enable row level security;
create policy tenants_isolation on tenants
  for select using (id = current_tenant_id());
create policy tenants_update on tenants
  for update using (id = current_tenant_id()) with check (id = current_tenant_id());

alter table tenant_members enable row level security;
create policy tenant_members_isolation on tenant_members
  for select using (tenant_id = current_tenant_id() or user_id = auth.uid());

alter table categories enable row level security;
create policy categories_isolation on categories
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table global_attributes enable row level security;
create policy global_attributes_isolation on global_attributes
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table global_attribute_options enable row level security;
create policy global_attribute_options_isolation on global_attribute_options
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table category_attributes enable row level security;
create policy category_attributes_isolation on category_attributes
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table category_attribute_options enable row level security;
create policy category_attribute_options_isolation on category_attribute_options
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table products enable row level security;
create policy products_isolation on products
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table filter_idx enable row level security;
create policy filter_idx_isolation on filter_idx
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table spaces enable row level security;
create policy spaces_isolation on spaces
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table space_products enable row level security;
create policy space_products_isolation on space_products
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table transactions enable row level security;
create policy transactions_isolation on transactions
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table transaction_items enable row level security;
create policy transaction_items_isolation on transaction_items
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
