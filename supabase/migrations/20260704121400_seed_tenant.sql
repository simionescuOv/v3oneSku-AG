-- SPEC_CatalogRPC.md §7 — un singur tenant fix pentru development, hardcodat
-- temporar în client (până la autentificare reală).
insert into tenants (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Tenant')
on conflict (id) do nothing;
