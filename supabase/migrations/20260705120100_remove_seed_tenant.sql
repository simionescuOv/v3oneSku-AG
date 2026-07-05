-- Decizie: tenantul de seed (20260704121400_seed_tenant.sql) nu are user
-- asociat și nu va primi vreodată unul — sub RLS ar deveni oricum inaccesibil
-- (nicio sesiune auth.uid() nu are rând în tenant_members pentru el). Îl
-- ștergem explicit acum, în loc să rămână orfan la nesfârșit. Cascadează pe
-- categories/products/etc. (toate au `on delete cascade` către tenants).
--
-- Contul demo pre-populat (categorii + produse pentru demonstrație inițială la
-- tenanți noi) e o funcționalitate de produs separată — nu se construiește
-- aici (task-ul curent e strict Auth + RLS). Când se implementează, se va crea
-- un tenant demo dedicat, populat deliberat, nu acest artefact de dev.
--
-- Ștergere explicită, în ordine, înainte de tenant: cascada FK de pe
-- `category_attributes`/`products` declanșează triggere de rebuild
-- `filter_idx` (§7.1 SPEC_DatabaseSchema_v3) care ar insera cu un
-- `tenant_id` deja șters dacă am lăsa totul pe seama `on delete cascade`
-- direct pe `tenants`.
delete from filter_idx where tenant_id = '00000000-0000-0000-0000-000000000001';
delete from category_attributes where tenant_id = '00000000-0000-0000-0000-000000000001';
delete from products where tenant_id = '00000000-0000-0000-0000-000000000001';
delete from tenants where id = '00000000-0000-0000-0000-000000000001';
