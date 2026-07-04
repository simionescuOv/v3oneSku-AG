-- SPEC_LocalFilter_v3 §4.1.2, §4.3 — rebuild-ul e parte din aceeași tranzacție
-- ca mutația (trigger Postgres), nu risc de fereastră stale.
--
-- Notă de granularitate (deviere asumată față de §4.3.1 literal): trigger-ul nu
-- diferențiază "a fost atins un atribut filterable?" înainte de a rebuild-ui —
-- rebuild-ul categoriei afectate (și global) rulează la ORICE INSERT/UPDATE/DELETE
-- de produs, respectiv la orice schimbare de category_attributes. Corectitudinea
-- nu are de suferit (rebuild-ul e integral și idempotent), doar se face muncă
-- puțin mai multă decât strict necesar — acceptabil la costul de compute
-- neglijabil menționat în §2.5, și mult mai simplu/robust decât un diff
-- old-vs-new pe chei JSONB filterable (sursă probabilă de bug-uri „index uitat").

create or replace function trg_rebuild_filter_idx_on_product_change()
returns trigger language plpgsql security definer as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);

  if tg_op = 'DELETE' then
    perform rebuild_filter_idx_category(v_tenant_id, old.category_id);
  elsif tg_op = 'INSERT' then
    perform rebuild_filter_idx_category(v_tenant_id, new.category_id);
  elsif tg_op = 'UPDATE' then
    perform rebuild_filter_idx_category(v_tenant_id, new.category_id);
    if new.category_id is distinct from old.category_id then
      perform rebuild_filter_idx_category(v_tenant_id, old.category_id);
    end if;
  end if;

  perform rebuild_filter_idx_global(v_tenant_id);
  return null;
end $$;

create trigger trg_products_filter_idx
  after insert or update or delete on products
  for each row execute procedure trg_rebuild_filter_idx_on_product_change();

create or replace function trg_rebuild_filter_idx_on_attribute_change()
returns trigger language plpgsql security definer as $$
declare
  v_tenant_id uuid;
  v_category_id uuid;
begin
  v_tenant_id := coalesce(new.tenant_id, old.tenant_id);
  v_category_id := coalesce(new.category_id, old.category_id);
  perform rebuild_filter_idx_category(v_tenant_id, v_category_id);
  perform rebuild_filter_idx_global(v_tenant_id);
  return null;
end $$;

create trigger trg_category_attributes_filter_idx
  after insert or update or delete on category_attributes
  for each row execute procedure trg_rebuild_filter_idx_on_attribute_change();
