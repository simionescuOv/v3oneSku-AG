# oneSku — Spec schemă bază de date v3 (Supabase / PostgreSQL)

> **v3** — rescriere completă. Înlocuiește `SPEC_DatabaseSchema_v2.md`. Integrează deciziile
> sesiunii de reconciliere arhitecturală (vezi `SPEC_LocalFilter_v3.md` §13–§14 și
> `HANDOFF_oneSku_reconciliere.md` §2). Trasabilitatea schimbărilor față de v2 este
> consemnată exclusiv în §13 („Jurnal de revizuire v2 → v3") — corpul documentului descrie
> starea definitivă, fără marcaje istorice.
>
> Acoperă modulul **Catalog** (categorii, schema dinamică de atribute, atribute globale,
> produse, NameID, tags) plus structurile de materializare `filter_idx`. StockHub,
> Tranzacții, Users/Roles, Orders rămân `[TBD]` — schema e proiectată să se extindă spre
> ele fără refactorizare (§10).

---

## 0. Decizii de design confirmate

| Decizie | Alegere | Motiv |
|---|---|---|
| Reprezentare arbore categorii | **Adjacency List** (`parent_id`) | Simplu, suficient la scara curentă; PostgreSQL suportă nativ `WITH RECURSIVE` |
| Multi-tenant | **`tenant_id` pe fiecare tabel, fără excepție** | RLS viitor va filtra direct pe coloană, fără join-uri către părinte |
| Identificator uman al produsului | **`products.name_id`** — coloană dedicată, auto-generată, imuabilă, unică per tenant | Nu există `products.name`; NameID îi preia integral rolul (vezi §6.1) |
| Unicitate nume categorie | **Globală per tenant** (nu per-sibling), pe nume normalizat, doar `node_type = 'category'` | Tab-ul Flux afișează categorii fără context ierarhic — duplicatele ar fi indistinguibile |
| Schema dinamică a categoriei | **Tabel separat `category_attributes`** | Queryabil, validabil, CRUD pe rânduri |
| Atribute globale | **Registry separat `global_attributes`** + FK opțional din `category_attributes` | Atribute cross-categorie (ex. Brand); doar `single_choice` în v1 |
| Opțiuni pentru "single choice" | **Tabel separat `category_attribute_options`** | Redenumire/reordonare curată |
| Valori atribute pe produs | **JSONB pe rândul produsului, cheiat după `category_attributes.id` (UUID)** | Cheia rămâne mereu locală, chiar și pentru atribute legate global (§8.3 din SPEC_LocalFilter_v3) |
| Tags | **`products.tags text[]` flat** — sursă unică pentru date și filtrare | Filtrare OR flat; Tag Groups = metadata pur UI, tabel separat, fără relație cu produsele |
| Produs în Space | **Pointer + delta locală** (`product_id` + stoc + tags locale), nu clonă | Atributele de Catalog se văd live prin pointer; zero desincronizare |
| `filter_idx` | **Materializat server-side**, tabel dedicat cheiat pe scope, rebuild integral prin trigger | Clientul consumă indexuri gata calculate (SPEC_LocalFilter_v3 §4) |
| `ON DELETE` pe `parent_id` | **`restrict`**, nu `cascade` | Regula de business e promovarea copiilor, nu ștergerea în cascadă (§3) |

### 0.1 `tenant_id` peste tot

Fiecare tabel poartă `tenant_id`. Când se activează RLS, o policy pe un tabel fără
`tenant_id` ar trebui să facă join către părinte ca să afle tenantul — mai lent și mai
fragil decât un filtru direct pe coloană. Coloana e ieftină acum, dureroasă de adăugat
retroactiv.

### 0.2 JSONB cheiat după UUID, nu după nume

`products.attributes` cheiază după `category_attributes.id` (UUID imuabil):
`attributes = {"a1b2...": "Roșu"}`. Numele atributului e editabil de tenant; dacă valorile
ar fi cheiate după nume, redenumirea ar orfana toate produsele existente. Afișarea face
oricum join cu `category_attributes` pentru `name`-ul curent, deci utilizatorul nu vede
niciodată UUID-ul. **Niciodată nu lega valorile de un string editabil de utilizator.**

Invariantul se păstrează și pentru atributele legate global: cheia JSONB rămâne id-ul
**local** de categorie; maparea local → `global_attribute_id` se rezolvă în builder-ul
`filter_idx`-ului global (§7.2, SPEC_LocalFilter_v3 §8.3).

### 0.3 `restrict`, nu `cascade`, pe `parent_id`

Arhitectura cere ca la ștergerea unui folder copiii să se **promoveze la părinte**, nu să
se șteargă. Un FK cu `on delete cascade` face exact opusul. `restrict` forțează logica de
promovare să fie explicită — cascade-ul nu se poate întâmpla accidental.

---

## 1. Extensii necesare

```sql
create extension if not exists moddatetime schema extensions;
-- menține updated_at corect la fiecare UPDATE (triggere în §2–§6)

create extension if not exists unaccent;
-- necesară funcției de normalizare a numelor de categorie (§3.1)
```

---

## 2. Tabel: `tenants`

```sql
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_tenants_updated_at
  before update on tenants
  for each row execute procedure extensions.moddatetime(updated_at);
```

> Un singur tenant va exista la început, dar fiecare tabel referențiază `tenant_id` de la start.

---

## 3. Tabel: `categories`

Reprezintă **atât foldere cât și categorii**. Distincția e dată de `node_type`.

```sql
create table categories (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  parent_id     uuid references categories(id) on delete restrict,
  name          text not null,
  node_type     text not null check (node_type in ('folder', 'category')),
  position      integer not null default 0,
  deleted_at    timestamptz,                   -- soft-delete (doar node_type = 'category')
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_categories_tenant_parent on categories(tenant_id, parent_id);
create index idx_categories_deleted_at on categories(deleted_at) where deleted_at is not null;

create trigger trg_categories_updated_at
  before update on categories
  for each row execute procedure extensions.moddatetime(updated_at);
```

### 3.1 Unicitate globală per tenant — doar categorii, pe nume normalizat

Numele de **categorie** trebuie unic în tot catalogul tenantului (nu doar între frați),
pentru că tab-ul Flux din StockHub afișează categoriile într-o listă plată, fără context
ierarhic — două categorii „Accesorii" în foldere diferite ar fi indistinguibile.

**Folderele sunt libere** — nu apar niciodată în context fără ierarhie, deci nu au
constrângere de unicitate.

Normalizarea (lowercase + trim + diacritice pliate) trebuie **identică** în client
(`src/lib/search.js → normalize()`) și în DB:

```sql
create or replace function normalize_name(p text)
returns text
language sql
immutable
as $$
  select lower(trim(extensions.unaccent(p)));
$$;

create unique index uq_categories_global_name
  on categories (tenant_id, normalize_name(name))
  where deleted_at is null and node_type = 'category';
```

> Stratul de UX (`prefix-first` + rândul „+ Adaugă") previne majoritatea duplicatelor
> înainte de submit, dar **nu înlocuiește** indexul — nu prinde race condition, offline
> sau diferențe de normalizare. Ambele straturi sunt necesare.

### 3.2 Reguli de business

- `node_type = 'category'` → frunză; poate avea `category_attributes` și produse; nu are copii.
- `node_type = 'folder'` → poate avea copii; nu are produse directe.
- **Soft-delete**: doar categoriile au `deleted_at`. La restaurare din Trash, `parent_id` → `null` (rădăcină).
- **Ștergere folder**: NU e soft-delete. RPC-ul promovează copiii, apoi șterge rândul
  folder. Cu `on delete restrict`, dacă promovarea nu s-a făcut, DELETE-ul eșuează —
  plasa de siguranță dorită.
- **Anti-ciclu la mutare**: enforțat server-side în RPC (`WITH RECURSIVE`, vezi `SPEC_CatalogRPC.md`).

### 3.3 Constrângere de frunză (trigger recomandat)

```sql
create or replace function enforce_category_tree_rules()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from categories where parent_id = new.id) then
    if new.node_type = 'category' then
      raise exception 'O categorie nu poate avea copii (id=%)', new.id;
    end if;
  end if;
  if new.parent_id is not null then
    if (select node_type from categories where id = new.parent_id) = 'category' then
      raise exception 'Părintele % este o categorie (frunză), nu poate avea copii', new.parent_id;
    end if;
  end if;
  return new;
end $$;

create trigger trg_categories_tree_rules
  before insert or update on categories
  for each row execute procedure enforce_category_tree_rules();
```

---

## 4. Tabel: `global_attributes`

Registry independent de atribute valabile cross-categorie (ex. „Brand"). În v1 doar
`single_choice` — cazul multi-select cross-categorie e acoperit de Tags.

```sql
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
```

### 4.1 Tabel: `global_attribute_options`

```sql
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
```

> Când un atribut de categorie e legat global (§5), lista de opțiuni de referință e cea
> a atributului global — opțiunile trăiesc aici, nu duplicat per categorie. Detaliile de
> sincronizare UI (ce vede userul la editare per-categorie) aparțin spec-ului de UI.

---

## 5. Tabel: `category_attributes`

Schema dinamică a unei categorii.

```sql
create table category_attributes (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  category_id          uuid not null references categories(id) on delete cascade,
  name                 text not null,          -- afișat, editabil de tenant, ex: "Culoare"
  attribute_type       text not null check (attribute_type in ('text', 'single_choice')),
  filterable           boolean not null,       -- default aplicat de aplicație după tip:
                                               -- single_choice → true, text → false
  global_attribute_id  uuid references global_attributes(id) on delete restrict,
  position             integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_category_attributes_category on category_attributes(category_id);
create index idx_category_attributes_global on category_attributes(global_attribute_id)
  where global_attribute_id is not null;

-- două atribute cu același nume în aceeași categorie ar încurca UI-ul
create unique index uq_category_attributes_name
  on category_attributes(category_id, name);

create trigger trg_category_attributes_updated_at
  before update on category_attributes
  for each row execute procedure extensions.moddatetime(updated_at);
```

**Reguli:**

- `id` (UUID) e cheia stabilă folosită în `products.attributes`. `name` e doar pentru
  afișare — invariantul se păstrează și când atributul e legat global (§0.2).
- `global_attribute_id not null` → atributul e o **legare** a unui atribut global în
  această categorie. Tipul trebuie să coincidă cu al atributului global (`single_choice`
  în v1) — validat de aplicație/RPC.
- `filterable`: flag per atribut, cu default după tip (single_choice → `true`,
  text → `false`), override manual pe ambele direcții. Doar atributele `filterable`
  declanșează rebuild de `filter_idx` (§9.3).
- `on delete restrict` pe `global_attribute_id`: un atribut global nu se poate șterge
  cât timp e legat în vreo categorie — dezlegarea trebuie să fie explicită.
- **Un atribut legat global folosește exclusiv opțiunile din `global_attribute_options`.**
  Nu poate avea opțiuni locale suplimentare — `category_attribute_options` nu conține
  niciun rând pentru atribute cu `global_attribute_id not null` (validat de aplicație/RPC).
  Adăugarea unei opțiuni noi din contextul unei categorii scrie în
  `global_attribute_options` și devine vizibilă în toate categoriile care leagă atributul.
  Un vocabular divergent per categorie ar corupe agregarea din builder-ul indexului global.

---

## 6. Tabel: `products`

```sql
create table products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete restrict,
  name_id       text not null,                 -- NameID: identificator de sistem (§6.1)
  attributes    jsonb not null default '{}',   -- chei = category_attributes.id (UUID)
                                                -- ex: {"a1b2c3...": "Roșu", "d4e5f6...": "128GB"}
  tags          text[] not null default '{}',  -- flat, sursă unică date + filtrare (§6.2)
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index uq_products_name_id on products(tenant_id, name_id);
create index idx_products_tenant_category on products(tenant_id, category_id);
create index idx_products_attributes on products using gin(attributes jsonb_path_ops);
create index idx_products_tags on products using gin(tags);

create trigger trg_products_updated_at
  before update on products
  for each row execute procedure extensions.moddatetime(updated_at);
```

### 6.1 NameID — identificator de sistem, imuabil

- **Nu există coloană `name`.** `name_id` preia integral rolul de identificator uman
  obligatoriu al produsului. Descrierea comercială lungă e un atribut `text` opțional,
  definit de user per categorie.
- **Auto-generat, needitabil de user, imuabil** pe toată durata de viață a produsului.
  Analog UUID-ului, dar pronunțabil (stil nume de deploy Netlify).
- **Unic per tenant** (`uq_products_name_id`). Generatorul garantează unicitatea prin
  retry la coliziune: sufix numeric (`carrot-42`) sau combinație de două cuvinte
  (`brave-carrot`). Generarea se face în RPC-ul de creare produs, nu în client.
- `searchable: true, filterable: false` — permanent. Nu apare niciodată ca rând în
  modulul de filtrare.
- Imuabilitatea se enforțează prin trigger:

```sql
create or replace function enforce_name_id_immutable()
returns trigger language plpgsql as $$
begin
  if new.name_id <> old.name_id then
    raise exception 'name_id este imuabil (produs %)', old.id;
  end if;
  return new;
end $$;

create trigger trg_products_name_id_immutable
  before update of name_id on products
  for each row execute procedure enforce_name_id_immutable();
```

- Identificatorii aleși de user (coduri/porecle proprii) se fac prin atribute normale
  definite de el — nu prin NameID. (Flag `unique` pe atribute user-defined — deferred.)

### 6.2 Tags — `text[]` flat

- Sursa unică pentru date și filtrare. Fără structură de grupuri la nivel de produs.
- Filtrare **OR flat** peste toate tag-urile bifate, indiferent de orice grupare vizuală.
- Gruparea vizuală (Tag Groups) e metadata pur UI (§8) — fără nicio relație cu această
  coloană sau cu `filter_idx`.
- Tag-urile de aici sunt **tags de Catalog**, vizibile live prin pointer în orice Space.
  Tag-urile locale de Space trăiesc în delta locală a Space-ului (§10), nu aici.

### 6.3 Constrângeri de business

- `category_id` trebuie să refere mereu un nod `node_type = 'category'`:

```sql
create or replace function enforce_product_on_leaf()
returns trigger language plpgsql as $$
begin
  if (select node_type from categories where id = new.category_id) <> 'category' then
    raise exception 'Produsele se atașează doar la noduri category, nu folder (id=%)', new.category_id;
  end if;
  return new;
end $$;

create trigger trg_products_leaf
  before insert or update of category_id on products
  for each row execute procedure enforce_product_on_leaf();
```

- Cheile din `attributes` = id-urile din `category_attributes` ale categoriei produsului.
  La afișare/editare, aplicația face join ca să mapeze `id → name` curent.

---

## 7. Tabel: `filter_idx` — indexuri de filtrare materializate

Materializarea server-side a celor trei tipuri de index descrise în
`SPEC_LocalFilter_v3.md` §3. Un rând per scope; clientul cere doar rândurile relevante
ecranului curent.

```sql
create table filter_idx (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  scope_type  text not null check (scope_type in ('global', 'category', 'space')),
  scope_id    uuid,                            -- null pt. global; category_id sau space_id altfel
  idx         jsonb not null default '{}',     -- structura din SPEC_LocalFilter_v3 §8.4
  rebuilt_at  timestamptz not null default now()
);

create unique index uq_filter_idx_scope
  on filter_idx(tenant_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));
```

**Reguli:**

- `scope_type = 'global'` → un singur rând per tenant (`scope_id` null). Conține Tags +
  atributele globale, agregate din tot catalogul.
- `scope_type = 'category'` → un rând per categorie. Conține doar atributele locale
  `filterable` ale schemei, doar din produsele acelei categorii.
- `scope_type = 'space'` → un rând per Space. Conține doar atributele locale de Space
  (stoc, tags locale), calculate peste pointerii Space-ului. Se creează la migrarea
  StockHub — structura tabelului e deja pregătită.
- **Rebuild integral, nu incremental** — `GROUP BY` pe `products` (respectiv pe tabelele
  de stoc/pointeri pentru scope `space`), rescriere completă a coloanei `idx`.
- Conținutul `idx` referențiază exclusiv `product_id` (UUID), niciodată poziții.

### 7.1 Mecanism de rebuild — trigger Postgres

Recomandat: funcții `rebuild_filter_idx_global(tenant_id)`,
`rebuild_filter_idx_category(tenant_id, category_id)` (și, la StockHub,
`rebuild_filter_idx_space(tenant_id, space_id)`), apelate din triggere pe `products`
(și viitor pe tranzacții/stoc). Rebuild-ul e astfel parte din aceeași tranzacție ca
mutația — indexul nu e niciodată stale.

Declanșatori (detaliați în SPEC_LocalFilter_v3 §4.3):
- global → modificare `tags` sau a valorii unui atribut legat global `filterable`, pe orice produs;
- per-categorie → modificare atribut local `filterable`, insert / soft-delete / restore de produs în acea categorie;
- space → modificare atribut local de Space sau modificarea listei de pointeri (tranzacții Cart).

Atributele nefilterabile nu declanșează rebuild. Trigger-ul compară `old` vs. `new` și
iese devreme dacă mutația nu atinge nimic filterable.

Alternativă acceptabilă pentru început: RPC apelat explicit de client imediat după
mutație (mai simplu de depanat, cu risc de stale dacă apelul eșuează).

### 7.2 Maparea local → global în builder

Builder-ul indexului **global** rezolvă maparea: pentru fiecare categorie, identifică
cheile locale (`category_attributes.id`) legate de un `global_attribute_id` și agregă
valorile din `products.attributes` sub acel id global, indiferent din ce categorie provin.
Cheile JSONB de pe produs rămân mereu locale (§0.2).

---

## 8. Tabel: `tag_groups` — metadata pur UI

Gruparea vizuală a tag-urilor în bottom sheet. **Fără nicio relație cu `products.tags`
sau cu `filter_idx`** — strat de configurare consumat exclusiv de UI, amânabil fără
refactorizare.

```sql
create table tag_groups (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index uq_tag_groups_name on tag_groups(tenant_id, name);

create table tag_group_members (
  tenant_id     uuid not null references tenants(id) on delete cascade,
  tag_group_id  uuid not null references tag_groups(id) on delete cascade,
  tag           text not null,                 -- valoarea textuală a tag-ului
  primary key (tag_group_id, tag)
);
create index idx_tag_group_members_tag on tag_group_members(tenant_id, tag);
```

**Reguli:**

- `tag_group_members.tag` referențiază tag-ul prin **valoarea sa textuală**, nu prin FK —
  tag-urile nu au tabel propriu, trăiesc ca `text[]` pe produse. Un tag negrupat pur și
  simplu nu are rând aici.
- Ștergerea unui grup nu atinge niciun produs — dispare doar organizarea vizuală.
- Filtrarea și căutarea rămân flat, indiferent de grupare.
- **Implementare amânabilă:** aceste două tabele se creează când se atacă feature-ul de
  Tag Groups, nu acum. Sunt incluse aici ca schemă de referință.

---

## 9. Row Level Security (RLS) — deferred

Amânat integral (inclusiv scrierea policy-urilor) până la al doilea tenant real. La un
tenant, RLS rezolvă o problemă inexistentă, iar policy-urile vor fi rescrise oricum când
se știe forma concretă a autentificării. Coloanele `tenant_id` **sunt** prezente peste
tot de la început — asta e asigurarea ieftină, greu de retrofitat.

Șablon pentru momentul respectiv:

```sql
alter table categories enable row level security;
create policy tenant_isolation on categories
  using (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
-- similar pentru fiecare tabel cu tenant_id
```

---

## 10. Note de extensibilitate (StockHub / Tranzacții — viitor)

Nu se creează acum. Cum susține schema actuală extensia, fără refactorizare:

- **`spaces`** — `tenant_id` + `allow_negative_stock boolean` (setat o singură dată la creare).
- **Produs în Space = pointer + delta.** Tabela de legătură (ex. `space_products`) ține
  `(space_id, product_id)` ca pointer + atributele locale: `stock numeric`, `local_tags
  text[]`. **Nu se copiază** niciun atribut de Catalog — NameID, tags, atribute se citesc
  live prin join pe `product_id`. Nu există snapshot de etichetă nicăieri: NameID e imuabil,
  deci eticheta din istoric coincide mereu cu cea curentă.
- **`transactions`** + **`transaction_items`** — `source`/`destination` = `'catalog'` sau
  `space_id`. `transaction_items` referențiază produsul prin `product_id` (UUID) — legătura
  stabilă; afișarea folosește NameID prin join. `unit_cost` alimentează PMP.
- **„Prima apariție într-un Space"**: la procesarea tranzacției, dacă `(space_id,
  product_id)` nu există în tabela de pointeri, se **inserează pointerul** cu stocul
  inițial din coș — nu se clonează nimic.
- **Variante / SKU** — first-class în arhitectură, absente din schema curentă. Când vine
  feature-ul: `product_variants(id, product_id, sku, attributes jsonb, ...)`, iar
  pointerii/stocul din Space se vor lega de `variant_id`. De proiectat PK-ul tabelei de
  pointeri cu asta în minte la prima migrare StockHub.
- `filter_idx` cu `scope_type = 'space'` e deja pregătit structural (§7).
- `products.category_id` rămâne sursa de adevăr pentru apartenența la categorie
  (dimensiune de filtrare în Space) — nu se duplică nicăieri.

---

## 11. Decizie deschisă: PREȚ și COST

Rămâne **deschisă** (nemodificat față de v2). Întrebarea: prețul/costul trăiește în
Catalog (preț de listă) sau e exclusiv concept de Space/tranzacție (cost intră cu marfa,
PMP calculat per Space)?

Direcția probabilă: costul = atribut de tranzacție (`transaction_items.unit_cost`),
agregat per Space; prețul de vânzare = candidat pentru Catalog sau pentru layer-ul
Storefront. Filtrarea de tip interval numeric (preț) depinde de această decizie și e
deferred împreună cu ea (SPEC_LocalFilter_v3 §12.7).

**Nu implementa nimic aici până nu se confirmă modelul în chat.**

---

## 12. Rezumat tabele (ordinea de creare / dependențe)

```
[acum]
tenants
  ├── categories (parent_id → self ON DELETE RESTRICT; unicitate globală normalizată)
  │     ├── category_attributes (category_id → categories;
  │     │                        global_attribute_id → global_attributes, opțional)
  │     │     └── category_attribute_options (attribute_id → category_attributes)
  │     └── products (category_id → categories ON DELETE RESTRICT;
  │                   name_id unic per tenant; tags text[]; attributes jsonb)
  ├── global_attributes
  │     └── global_attribute_options
  └── filter_idx (scope: global / category / [space — viitor])

[amânat — la feature-ul Tag Groups]
tag_groups → tag_group_members

[viitor — StockHub]
spaces → space_products(space_id, product_id, stock, local_tags)
       → transactions → transaction_items
       → filter_idx scope 'space'
```

Tabel `category_attribute_options` (neschimbat ca structură):

```sql
create table category_attribute_options (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  attribute_id  uuid not null references category_attributes(id) on delete cascade,
  value         text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index idx_attribute_options_attribute on category_attribute_options(attribute_id);
create unique index uq_attribute_options_value
  on category_attribute_options(attribute_id, value);
```

> Doar atributele `single_choice` **nelegate global** (`global_attribute_id is null`) au
> rânduri aici. Atributele legate global folosesc exclusiv `global_attribute_options`
> (§4.1) — fără opțiuni locale suplimentare (regula din §5).

---

## 13. Jurnal de revizuire (v2 → v3)

13.1. **`products.name` eliminat → `products.name_id`.** NameID = identificator de sistem
auto-generat, imuabil, unic per tenant, cu trigger de imuabilitate. Preia integral rolul
de identificator uman; descrierea comercială devine atribut `text` opțional per categorie.
(Decizia din SPEC_LocalFilter_v3 §5.1.)

13.2. **Unicitate categorii: per-sibling → globală per tenant.** Indexul
`uq_categories_sibling_name` din v2 înlocuit cu `uq_categories_global_name` pe nume
normalizat (`lower + trim + unaccent`), doar `node_type = 'category'`, doar neșterse.
Folderele rămân libere. Motivul: tab-ul Flux afișează categorii fără context ierarhic.
Normalizarea trebuie identică client ↔ DB. Extensia `unaccent` adăugată.

13.3. **Tags restructurat complet.** v2 amâna un model normalizat pe trei tabele
(`tag_groups` → `tag_values` → `product_tags`) cu relație produs↔tag prin FK. v3 adoptă
`products.tags text[]` flat ca sursă unică (cu index GIN), iar gruparea devine metadata
pur UI (`tag_groups` + `tag_group_members` referențiind tag-ul prin valoare textuală, fără
relație cu produsele). Filtrarea = OR flat. Tabelele de grupare rămân amânabile.

13.4. **Atribute globale materializate în schemă.** v2 nu le conținea. v3 adaugă
`global_attributes` + `global_attribute_options` + FK opțional
`category_attributes.global_attribute_id` (ON DELETE RESTRICT), doar `single_choice` în
v1. Cheia JSONB pe produs rămâne locală; maparea local→global e treaba builder-ului de
index (SPEC_LocalFilter_v3 §8.3).

13.5. **Flag `filterable` adăugat pe `category_attributes`.** Default după tip
(single_choice → true, text → false), override manual. Condiționează declanșarea
rebuild-ului de `filter_idx`.

13.6. **Tabel `filter_idx` adăugat.** Materializare server-side a celor trei scope-uri
(global / category / space), JSONB per rând, rebuild integral prin trigger Postgres
(alternativ RPC explicit la început). Scope `space` pregătit structural, populat la
migrarea StockHub.

13.7. **Model pointer + delta pentru Space (nota de extensibilitate rescrisă).** v2 §7
descria „clonarea automată la prima apariție" prin inserare în `stock`. v3 elimină
limbajul de clonare: tabela viitoare `space_products` ține pointer (`product_id`) +
delta locală (stoc, tags locale); atributele de Catalog se citesc live; fără snapshot de
etichetă în tranzacții (NameID imuabil garantează coincidența).

13.8. **Preț/Cost:** rămâne decizie deschisă, nemodificată — mutată în secțiune proprie (§11).

13.9. **Păstrate din v2 fără schimbare:** adjacency list cu `parent_id ON DELETE
RESTRICT`; `tenant_id` pe toate tabelele; JSONB cheiat după UUID local; triggere
`moddatetime` pe `updated_at`; triggerele de integritate arbore/frunză; `gin
jsonb_path_ops` pe `attributes`; RLS deferred integral; seed tenant cu UUID fix (vezi
`SPEC_CatalogRPC.md` §7).

---

## 14. Instrucțiuni pentru agentul Claude Code

1. **Verifică contra codului React existent** — atenție specială la: (a) orice referință
   la `products.name` (nu mai există — devine `name_id`, generat server-side); (b) forma
   `products.attributes` (chei = UUID local, nu nume); (c) orice logică de tags care
   presupune tabele normalizate (`tag_values`, `product_tags`) — sursa e `products.tags
   text[]`.
2. Scrie migration-urile SQL ca fișiere separate, versionate. Ordinea: extensii
   (`moddatetime`, `unaccent`) → tenants → categories (+ funcție `normalize_name` +
   indexuri + triggere) → global_attributes (+ options) → category_attributes (+ options)
   → products (+ triggere, inclusiv imuabilitate `name_id`) → filter_idx (+ funcții
   rebuild + triggere).
3. **Generatorul de NameID** se implementează server-side (RPC de creare produs):
   dicționar de cuvinte EN lizibile, retry la coliziune cu sufix numeric sau combinație
   de două cuvinte. Clientul nu generează și nu trimite niciodată `name_id`.
4. **Funcția `normalize_name` din DB trebuie să producă exact același rezultat** ca
   `normalize()` din `src/lib/search.js` pentru orice input. Scrie un set de teste de
   paritate (diacritice românești ă/â/î/ș/ț + variantele cu sedilă ş/ţ, spații, case).
5. **Rebuild `filter_idx`:** începe cu varianta RPC explicit (mai ușor de depanat), cu
   plan de migrare la trigger. Indiferent de variantă, rebuild-ul e integral (`GROUP BY`),
   niciodată incremental.
6. **NU** crea tabelele de Tag Groups (§8) în acest pas și **NU** scrie/activa RLS (§9).
7. **NU** adăuga nicio coloană de preț/cost până la confirmarea deciziei (§11).
8. La generarea clientului, folosește `supabase gen types typescript`.

---

*v3 — rescriere completă: NameID înlocuiește `name` (coloană imuabilă, unică per tenant,
trigger de protecție); unicitate globală normalizată pe categorii (folderele libere);
`products.tags text[]` flat + Tag Groups ca metadata pur UI; registry `global_attributes`
cu legare prin FK din schema de categorie; flag `filterable`; tabel `filter_idx`
materializat pe trei scope-uri cu rebuild integral server-side; model pointer + delta
pentru Space în notele de extensibilitate; Preț/Cost rămâne deschis; jurnal complet în §13.*
