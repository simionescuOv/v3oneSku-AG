# oneSku — STATUS

> Actualizat de Claude Code după fiecare sesiune de lucru.

---

## Sesiunea 3 — Tags (SPEC_Tags v1 implementat)

### Ce s-a schimbat

- **`docs/specs/SPEC_Tags.md`** — spec-ul rezultat din planificare (Claude.ai), adăugat
  în repo. Zero migrații/RPC-uri noi — totul e UI + client.
- **`PickerSheet.jsx` (nou)** — picker generic în modul „cu căutare" (BottomBar filtrează,
  fără input propriu în sheet): multiSelect+confirmare explicită pentru tags,
  single-select cu confirmare la tap pentru `single_choice`, rând „+ Adaugă «query»" pe
  potrivire inexactă normalizată (`normalize()` canonic, prin `usePicker` mod inline).
- **`ProductFormSheet.jsx`** — câmp Tags (chips cu „×", placeholder, marcat „de sistem")
  după câmpurile din schemă, înainte de preț; selecția `single_choice` aliniată de la
  chips inline la același picker; **mecanismul SWAP** (SPEC_Tags §5): formularul se
  ascunde vizual cât e deschis picker-ul și revine cu starea intactă — fără stacking.
- **`SchemaSheet.jsx`** — secțiunea informativă read-only „De sistem" (NameID + Tags)
  deasupra listei de atribute.
- **`useCatalogStore.fetchTagVocabulary`** — vocabular derivat exclusiv din `filter_idx`
  global, bucket `tags` → `{value, count}`; tratează rândul lipsă și bucket-ul absent
  ca vocabular gol (confirmate pe Postgres efemer, vezi mai jos).

### Verificat end-to-end (Postgres 16 efemer, migrații de la zero + shim auth)

- Tenant proaspăt → rândul `filter_idx` global **lipsește complet**; după prima mutație
  de atribut există **fără** cheia `tags` — clientul tratează ambele cazuri (`maybeSingle`
  + `?? []`).
- `create_product(p_tags)` populează corect `products.tags`; rebuild-ul global include
  bucket-ul `tags`; contoarele derivate cresc la refolosirea unui tag (`vara:2, premium:1`);
  zero tag-uri = stare validă (`{}`).

---

## Triaj — cereri oprite pentru planificare (2026-07-05)

### Cerere: atributul special `tags` la configurarea schemei categoriei — ✅ REZOLVAT

> Rezolvat prin planificare: `docs/specs/SPEC_Tags.md` (v1) a fixat deciziile
> (secțiune read-only „De sistem" în SchemaSheet, picker cu BottomBar, regula SWAP)
> și a fost implementat în Sesiunea 3 (mai sus). Textul de mai jos rămâne ca istoric.

**Ce a cerut userul:** implementarea atributului special `tags` în configurarea
schemei categoriei (SchemaSheet).

**De ce m-am oprit (regula de triaj din CLAUDE.md):**
- **Semnalul 2** — cererea nu e determinată de spec-uri, ba chiar le contrazice
  parțial: `ARCHITECTURE.md` §5.2 spune explicit *„`Tags` NU este un field type
  în schema categoriei. Este un sistem separat, global (§5.4)."* Tags e un
  „atribut predefinit prezent pe orice produs" (`SPEC_LocalFilter_v3.md` §5.2).
  Cum ar apărea în SchemaSheet (rând special read-only? doar în formularul de
  produs? deloc în schemă?) nu e specificat nicăieri — ar însemna să aleg eu
  între variante nespecificate.
- **Semnalul 3** — risc de coliziune cu anti-pattern fixat: spec-ul cere la
  adăugarea unui tag **prefix search anti-duplicare** (ARCHITECTURE §5.4), dar
  interzice **search propriu în bottom-sheet** (SPEC_CatalogPage_v3 §6,
  SPEC_Picker_v2 §6 — căutarea curge doar prin BottomBar). ProductFormSheet /
  SchemaSheet sunt bottom-sheet-uri; fluxul corect de selecție tags
  (ListPick + BottomBar) cere o decizie de design UX nespecificată încă.

**Stadiul actual al codului relevant:**
- DB complet pregătit, nu necesită tabele/coloane noi: `products.tags text[]`
  cu index GIN (`20260704120500_products.sql`), `filter_idx` global indexează
  deja bucket-ul `'tags'` (`20260704120700_filter_idx_functions.sql`),
  `space_products.local_tags text[]` există pentru tag-urile locale de Space.
- RPC: `create_product` acceptă deja `p_tags`
  (`20260705120300_rpc_session_tenant.sql`); **nu există** niciun RPC de
  update produs / update tags — editarea tag-urilor pe un produs existent ar
  cere un RPC nou.
- Client: `useCatalogStore` mapează `tags` (`mapProduct`) și `addProduct`
  acceptă parametrul `tags`, dar **niciun UI** nu afișează sau editează
  tag-urile — zero referințe în `ProductFormSheet.jsx`, `SchemaSheet.jsx`,
  `CategoryPage.jsx`, `ProductCard.jsx`.
- Fișiere care ar fi atinse de implementare: `src/components/catalog/
  ProductFormSheet.jsx`, `SchemaSheet.jsx`, `src/pages/CategoryPage.jsx`,
  `src/store/useCatalogStore.js`, plus o migrație nouă cu RPC de update.

---

## Sesiunea 2 — Migrare Supabase (Catalog ca sursă de adevăr)

### Ce s-a schimbat

- **Schema DB completă** în `supabase/migrations/` (15 fișiere, ordonate): tenants,
  categories (+ `normalize_name` + unicitate globală normalizată + reguli de arbore +
  `is_temp`), global_attributes (+ options), category_attributes (+ options + `filterable`
  + validare tip global), products (+ `name_id` imuabil + `tags` + `attributes` jsonb +
  `list_price`), `filter_idx` (+ funcții rebuild global/categorie/spațiu + trigger-e),
  RPC-uri de Catalog (create_category, move_node, delete_folder, soft_delete_category,
  restore_from_trash, group_nodes, get_valid_move_targets, mutare cross-folder), generator
  NameID, create_product, RPC-uri de schemă (create_category_attribute,
  add_category_attribute_option), tabele de bază StockHub (spaces, space_products,
  transactions, transaction_items) + `add_product_to_space`, seed tenant.
- **Toate migrațiile au fost validate local** pe un Postgres 16 efemer (aplicare completă
  de la zero + teste funcționale ale fiecărui RPC + teste de paritate `normalize_name` ↔
  `normalize()` din `src/lib/search.js` — vezi `supabase/tests/normalize_name_parity.sql`).
  Nu au fost aplicate pe niciun proiect Supabase real (fără credențiale disponibile în acest
  mediu) — vezi „Pași de setup” mai jos.
- **`src/lib/supabaseClient.js`** — client Supabase citind `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` din env (`.env.example` documentează variabilele).
- **`useCatalogStore.js` refactorizat**: Supabase e sursa de adevăr, Zustand e cache local.
  `fetchCatalog()` populează cache-ul; citirile derivate (`getChildren`, `getBreadcrumb`,
  `getAncestorFolders`, `getValidMoveDestinations`) rămân sincrone peste cache; toate
  mutațiile trec prin `supabase.rpc(...)` și reîmprospătează cache-ul după succes.
- **`src/mock/products.js` șters** — nu mai există mock de Catalog. `src/mock/spaces.js`
  rămâne (StockHub e explicit în afara scope-ului acestei sesiuni).
- **NameID**: `ProductFormSheet` nu mai are câmp de nume — produsul se creează cu atribute +
  preț opțional, iar `name_id`-ul (generat server-side) apare pe card imediat după salvare.
  `ProductCard` / `CategoryPage` afișează `product.nameId`.
- **`nameExistsGlobally`** relaxat: verifică doar `node_type = 'category'` — folderele sunt
  libere (verificare optimistă client-side; autoritatea reală e indexul unic din DB).

### Decizii/devieri semnalate (nu blocante, dar de revizuit)

1. **Rebuild `filter_idx` prin trigger** (nu RPC explicit) — ales conform recomandării
   utilizatorului. Trigger-ele nu diferențiază "a fost atins un atribut filterable?" înainte
   de rebuild — rebuild-ul rulează la orice mutație de produs/atribut din categoria
   afectată (+ global). Corectitudine garantată (rebuild integral, idempotent), cost de
   compute puțin mai mare decât strict necesar — acceptabil la scara vizată.
2. **`groupNodes`** nu mai reface logica „reutilizează folderul rădăcină existent cu același
   nume” din store-ul vechi (era necesară în v2, unde folderele aveau unicitate; în v3
   folderele sunt libere, deci două foldere cu același nume sunt o stare validă, nu o
   eroare de evitat).
3. **`promote_temp_folder`** (SPEC_MutareCrossFolder) prinde `unique_violation`, dar
   folderele nu au nicio constrângere de unicitate în v3 (doar categoriile) — codul de
   eroare există ca plasă de siguranță, dar practic nu se va declanșa niciodată cât timp
   folderele rămân libere. Comportament neschimbat față de intenția v3 (folderele sunt
   libere), doar semnalat aici pentru transparență.
4. **`moveNodes`** (mutare mai multor noduri) rămâne o buclă client-side de apeluri
   `move_node` secvențiale, nu o singură tranzacție DB — la scara actuală (mutare într-un
   folder temporar nou-creat), anti-ciclul nu poate eșua la mijlocul buclei, deci riscul de
   stare parțială e practic nul. Dacă apare un caz de utilizare cu mutare multiplă spre o
   destinație arbitrară (nu temp folder), ar merita un RPC `move_nodes` atomic.

### Pași de setup (de făcut de utilizator)

1. Creează un proiect Supabase nou.
2. Rulează migrațiile din `supabase/migrations/` în ordine (SQL Editor sau
   `supabase db push` cu Supabase CLI conectat la proiect).
3. Copiază `.env.example` → `.env.local`, completează `VITE_SUPABASE_URL` și
   `VITE_SUPABASE_ANON_KEY` din Settings → API.
4. `npm install && npm run dev` — Catalogul ar trebui să pornească gol (fără categorii),
   gata de prima categorie/produs create prin UI.
5. Opțional: rulează `supabase/tests/normalize_name_parity.sql` pe proiectul tău pentru
   a confirma paritatea de normalizare.

---

## Sesiunea 1 — Schelă inițială

### Structura de foldere

```
src/
├── mock/
│   ├── spaces.js        # 3 spaces mock (Depozit Central, Showroom, Consignație)
│   └── products.js      # 3 categorii + 4 produse mock
├── store/
│   ├── useAppStore.js   # UI state: side menu open/closed
│   ├── useCatalogStore.js  # Categorii + produse (sursă: mock → Supabase)
│   └── useStockStore.js    # Spaces (sursă: mock → Supabase)
├── components/
│   ├── shell/
│   │   ├── AppShell.jsx     # Layout root: TopBar + MainContent + BottomBar
│   │   ├── TopBar.jsx       # Header fixat sus, afișează titlul paginii curente
│   │   ├── MainContent.jsx  # Zona scrollabilă, emite scroll events, randează <Outlet />
│   │   └── BottomBar.jsx    # Search bar + buton hamburger, hide/show la scroll
│   └── nav/
│       └── SideMenu.jsx     # Meniu lateral overlay cu cele 6 secțiuni
└── pages/
    ├── AccountPage.jsx
    ├── CatalogPage.jsx      # Listă statică: categorii + produse din mock
    ├── StockHubPage.jsx     # Listă statică: spaces din mock
    ├── StorefrontPage.jsx
    ├── DashboardPage.jsx
    └── SettingsPage.jsx
```

### Rute active

| URL           | Pagină          |
|---------------|-----------------|
| `/`           | redirect → `/catalog` |
| `/account`    | AccountPage     |
| `/catalog`    | CatalogPage     |
| `/stockhub`   | StockHubPage    |
| `/storefront` | StorefrontPage  |
| `/dashboard`  | DashboardPage   |
| `/settings`   | SettingsPage    |

### Mock data

- **`src/mock/spaces.js`** — 3 spaces cu `name`, `allow_negative_stock`, `product_count`, `total_units`
- **`src/mock/products.js`** — 3 categorii + 4 produse cu `name`, `category_name`, `price`, `sku_count`
- Consumate prin store-uri Zustand (`useCatalogStore`, `useStockStore`)
- La conectarea Supabase: se înlocuiește doar inițializarea din store — componentele rămân intacte

### Comportamente implementate

- **Dark theme** — `class="dark"` pe `<html>`, Tailwind dark mode via `'class'`
- **AppShell 100dvh** — layout stabil pe mobile (100dvh cu fallback 100svh)
- **BottomBar hide/show** — scroll down ascunde bara, scroll up o readuce; scroll events pe `MainContent`, NU pe `window`
- **SideMenu** — overlay cu backdrop, navigare prin `useNavigate`, item activ evidențiat
- **TopBar** — titlul se schimbă dinamic cu pagina curentă

---

## Urmează (neimplementat)

### Catalog
- [ ] Flux creare/editare categorii
- [ ] Grupare categorii în foldere (arbore ierarhic)
- [x] Schema categoriei (atribute dinamice: text / single_choice + opțiuni)
- [x] Adăugare produs (individual) — formular generat din schemă, `list_price` opțional
- [ ] Import produse din xlsx (SheetJS)
- [ ] Filtrare produse (OR per atribut, AND între atribute)
- [x] Tags la crearea produsului (picker SWAP, vocabular derivat din `filter_idx` global) — SPEC_Tags v1
- [ ] Tag Groups (grupare vizuală, pur UI) — amânat (SPEC_LocalFilter_v3 §5.2.5)

### Pagina categoriei (Faza 1 MVP) — implementat
- Rută `/catalog/category/:categoryId` → `CategoryPage` (tap pe categorie deschide pagina)
- Listă produse + căutare contextuală (usePicker), header cu breadcrumb + rezumat
- Schema de atribute (`SchemaSheet`): listă atribute, adăugare atribut, gestionare opțiuni
- Adăugare produs (`ProductFormSheet`): câmpuri generate din schemă + preț de listă opțional
- Ștergere categorie (din meniul contextual al paginii, soft-delete reutilizat din store)
- `BottomBar` generalizat la „familia /catalog" pentru meniul contextual

### StockHub
- [ ] Pagina unui Space (tab Stoc + tab Flux)
- [ ] Dialogul de filtrare (model eMAG, categorie ca filtru)
- [ ] Tab Flux — feed WhatsApp-style al tranzacțiilor

### Storefront
- [ ] Layer de prezentare (override-uri publice)
- [ ] Link public fără autentificare

### Tranzacții / Cart
- [ ] Coșul ca motor de mișcare stoc
- [ ] Clonare automată la prima apariție produs în Space

### Infrastructură
- [x] Schema DB + RPC-uri + `filter_idx` scrise ca migrații versionate (`supabase/migrations/`)
- [x] `useCatalogStore` refactorizat: Supabase sursă de adevăr, Zustand cache local
- [ ] Proiect Supabase real creat + migrații aplicate (de făcut de utilizator, vezi „Pași de setup”)
- [ ] Auth — încă pe tenant fix hardcodat (`00000000-...0001`)
- [ ] PWA manifest + service worker
- [ ] Users / Roles (TBD în arhitectură)
