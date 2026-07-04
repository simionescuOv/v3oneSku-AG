-- Test de paritate: normalize_name() (Postgres) trebuie să producă exact
-- același rezultat ca normalize() din src/lib/search.js, pentru orice input
-- deja trimuit (contractul existent: numele sunt trimuite la creare, în
-- client ȘI înainte de a fi trimise la RPC — vezi §3.1 SPEC_DatabaseSchema_v3).
--
-- normalize_name(p) ≡ normalize(p.trim()) în JS. `normalize_name` face și
-- propriul trim() ca plasă de siguranță (apărare în adâncime), dar contractul
-- de bază e ca ambele părți să primească text deja curat.
--
-- Rulare: psql -d <db> -f supabase/tests/normalize_name_parity.sql
-- Rezultatele așteptate au fost derivate rulând `normalize()` din search.js
-- pe aceleași input-uri (node -e "...").

do $$
declare
  cases jsonb := '[
    ["Electronice", "electronice"],
    ["Tricouri XL-2", "tricouri xl-2"],
    ["Jante  Aliaj", "jante  aliaj"],
    ["ANVELOPE IARNĂ", "anvelope iarna"],
    ["Smartwatch-uri", "smartwatch-uri"],
    ["Îmbrăcăminte", "imbracaminte"],
    ["şi ţest", "si test"],
    ["Café", "cafe"],
    ["Ș Î Â Ă Ț", "s i a a t"],
    ["", ""]
  ]'::jsonb;
  c jsonb;
  got text;
  expected text;
begin
  for c in select * from jsonb_array_elements(cases) loop
    expected := c->>1;
    got := normalize_name(c->>0);
    if got is distinct from expected then
      raise exception 'MISMATCH pentru input % : DB=% JS=%', c->>0, got, expected;
    end if;
  end loop;
  raise notice 'normalize_name: toate % cazurile de paritate au trecut', jsonb_array_length(cases);
end $$;
