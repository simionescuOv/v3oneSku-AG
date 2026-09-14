# SPEC: Lot Tracking & Transaction Attributes — Arhitectura viitoare

> **Status:** Document de referință pentru implementare viitoare (v2+).
> **Scope:** Trasabilitate loturi, atribute de tranzacție, cost per lot.
> **Dependent de:** `SPEC_Flux_Filtering_Architecture.md` §4.3, `SPEC_DatabaseSchema_v3.md`.

---

## 1. Contextul problemei

Modelul actual (`space_products`) menține **un singur rând per produs per Space**, cu un stoc agregat. Aceasta este suficient pentru majoritatea cazurilor, dar nu acoperă scenariile unde același produs are **instanțe cu atribute diferite** în același Space.

**Scenarii identificate:**
1. Același produs livrat de furnizori diferiți cu costuri diferite (ex: 6 buc. la 10 lei, 4 buc. la 12 lei)
2. Același produs cu termene de valabilitate/garanție diferite (ex: 50 buc. expiră în 5 zile, 50 buc. expiră în 25 de zile)
3. Atribute de context pe tranzacție, nu pe produs (ex: clientul căruia i s-a vândut)

Acestea sunt **trei probleme distincte** cu soluții diferite.

---

## 2. Problema A — Atribute de tranzacție (metadate de context)

**Exemplu:** Space "Vânzări Showroom" vrea să înregistreze cărui client i-a fost vândut fiecare lot de produse.

Atributul (`Nume Client`) aparține **tranzacției**, nu produsului. Valoarea se completează la momentul commitCart.

### Soluție: `attributes JSONB` pe tabela `transactions`

```sql
-- Migrare non-breaking, fără tabele noi
alter table transactions
  add column attributes jsonb;

-- Index pentru filtrare rapidă după atributele definite
create index idx_transactions_attributes on transactions using gin(attributes);
```

**Schema atributelor disponibile per Space** (de proiectat în v2):
- O tabelă de configurare `space_transaction_schema` definește ce atribute pot fi completate pentru un anumit Space
- La commitCart, UI prezintă câmpurile definite în schema Space-ului destinație
- Valorile se salvează în `transactions.attributes` ca JSONB

**Exemplu de date:**
```json
// transactions.attributes
{ "client": "Ion Popescu", "factura": "F-2024-001", "nota": "Urgent" }
```

**Impactul în Flux:** filtrul din Categoria C (`SPEC_Flux_Filtering_Architecture.md` §4.3) va putea filtra tranzacțiile după valorile din `attributes`.

### Ce NU rezolvă această soluție
Nu rezolvă individualizarea stocului — dacă ai 10 buc. din același produs, nu știi câte au fost vândute lui Ion și câte lui Gheorghe. Rezolvă doar trasabilitatea la nivel de tranzacție completă.

---

## 3. Problema B — Cost diferit per lot (cost de achiziție variabil)

**Exemplu:** același produs cumpărat azi la 10 lei/buc. și săptămâna trecută la 12 lei/buc. Ambele loturi se găsesc în stoc simultan.

### Soluție curentă: PMP (Preț Mediu Ponderat)

Schema actuală are deja `unit_cost` pe `transaction_items`:
```sql
unit_cost numeric  -- alimentează PMP; deja prezent în schema v3
```

**PMP** este metoda contabilă standard în România pentru stoc cu costuri mixte. La ieșire din stoc, costul unitar = media ponderată a tuturor intrărilor:

```
PMP = (Σ cantitate_intrare × cost_intrare) / Σ cantitate_intrare
```

Aceasta este **abordarea corectă fiscal** și nu necesită tracking per lot pentru costul de achiziție. Calculul PMP se face la nivel de `space_products` pe baza `transaction_items.unit_cost`.

### Când PMP nu e suficient
Dacă businessul are nevoie de **FIFO** (First In, First Out) sau **LIFO** în loc de PMP — de exemplu pentru raportare fiscală specifică sau pentru industrii reglementate — atunci e necesară trasabilitatea completă de lot (Problema C).

---

## 4. Problema C — Trasabilitate completă de lot (Batch/Lot Tracking)

**Exemplu:** 100 de produse în stoc unde unele expiră în 5 zile, altele în 25 de zile. La ieșire, trebuie să știi exact din ce lot ai scos și câte au rămas din fiecare.

### De ce nu se implementează în v1

Modelul actual `space_products` agregează tot stocul unui produs într-un singur rând. Lot tracking necesită **un rând per lot per produs per Space** și modifică fundamental:
1. Schema DB (`space_products` → `lots`)
2. Motorul de tranzacții (`commit_cart` RPC) — trebuie să știe din ce lot scoate
3. UI-ul coșului — operatorul trebuie să specifice lot-ul la adăugare în coș
4. Logica de filtrare — filtrare după atribute de lot (expiry, supplier)

Este o refactorizare majoră, incompatibilă cu v1.

### Arhitectura preconizată (v2+)

```sql
-- Înlocuiește logica agregată din space_products
create table lots (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  space_id        uuid not null references spaces(id) on delete restrict,
  product_id      uuid not null references products(id) on delete restrict,
  quantity        numeric not null default 0,
  lot_attributes  jsonb,        -- expiry_date, supplier, lot_number, cost, etc.
  received_at     timestamptz not null default now(),
  source_tx_id    uuid references transactions(id),  -- tranzacția de intrare
  created_at      timestamptz not null default now()
);

create index idx_lots_space_product on lots(space_id, product_id);
create index idx_lots_attributes on lots using gin(lot_attributes);
```

**Principiu FEFO (First Expiry, First Out):**
La ieșire din stoc, `commit_cart` consumă mai întâi loturile cu `expiry_date` cea mai apropiată.

**Impactul în `space_products`:**
`space_products.stock` devine o **view calculată** ca `SUM(lots.quantity)` pentru space + produs — stocul agregat rămâne disponibil pentru afișare rapidă.

### Strategia de migrare (când se implementează)

1. Migrare date: fiecare rând existent din `space_products` devine un lot inițial fără `lot_attributes`
2. Noi tranzacții: creează loturi cu atributele specificate la commitCart
3. Compatibilitate retroactivă: stocul agregat funcționează identic pentru tenants care nu folosesc lot tracking

---

## 5. Relația dintre cele 3 probleme

| Problemă | Soluție | Status |
|---|---|---|
| Atribute de context pe tranzacție (Nume Client) | `transactions.attributes JSONB` | TBD v2 — migrare mică |
| Cost variabil per lot | PMP via `transaction_items.unit_cost` | ✅ Rezolvat în schema v3 |
| Trasabilitate completă (expiry, FEFO, FIFO) | Tabelă `lots` + refactorizare motor | TBD v2+ — refactorizare majoră |

---

## 6. Trigger pentru implementare

Funcționalitatea de lot tracking devine prioritară când apare **cel puțin unul** dintre:
- Un tenant din domeniu farma, food retail, sau cu cerințe FEFO
- Cerință de audit fiscal care necesită FIFO/LIFO explicit
- Cerință de trasabilitate furnizor la nivel de unitate individuală (nu lot)

Până atunci, PMP + `transactions.attributes` acoperă 90% din cazuri.

---

*Document inițial — sept. 2026. De revizuit la planificarea v2.*
