# oneSku — Document de arhitectură (context briefing)

> Acest document servește ca punct de pornire pentru o discuție nouă.
> Conține tot ce s-a stabilit până acum. Continuarea discuției va adăuga/corecta secțiunile marcate cu `[TBD]`.
> Trasabilitatea schimbărilor față de versiunea anterioară — în §12 („Jurnal de revizuire").

---

## 1. Ce este oneSku

Aplicație SaaS WMS + e-commerce targetând **business-uri românești mici** care vând prin canale informale (WhatsApp, Telegram, față în față). Utilizatorul principal este tenantul — proprietarul unui mic business care gestionează stocuri și vânzări.

---

## 2. Stack tehnic confirmat

| Layer | Tehnologie |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| State management | Zustand cu persistență Supabase |
| Iconografie | Lucide-react |
| Import/Export | SheetJS |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Deploy target | PWA (primary), browser web |

**Exclus explicit:** shadcn/ui, Next.js.

---

## 3. Navigare principală — meniu lateral (hamburger)

Meniul lateral conține secțiunile principale ale aplicației:

| Secțiune | Rol |
|---|---|
| **Account** | Setări cont tenant |
| **Catalog** | Gestiunea produselor, categoriilor, schemelor, tags |
| **StockHub** | Gestiunea spațiilor de stoc (fostele Spaces/Stockrooms) |
| **Storefront** | Vitrina publică (Space special cu link public) |
| **Dashboard** | Rapoarte, statistici |
| **Settings** | Configurări aplicație |

---

## 4. Ierarhia datelor (data model)

```
Tenant
└── Catalog
    ├── Atribute globale (registry cross-categorie, ex. Brand)
    ├── Tags (vocabular flat, cross-categorie; grupare vizuală opțională, pur UI)
    └── Categories (ierarhice, arbore de foldere + categorii-frunză)
        └── Category
            ├── Product Schema (atribute dinamice; locale sau legate de un atribut global)
            └── Products
                ├── NameID (identificator de sistem, auto-generat, imuabil)
                ├── Attributes (din schema categoriei, JSONB cheiat pe UUID)
                ├── Tags (text[] flat)
                └── Variants / SKUs
                    └── (definiție; stocul NU e aici — vezi StockHub)
StockHub
├── Space 1..N  (listă de POINTERI către produse din Catalog + delta locală:
│                stoc per produs, tag-uri locale; flag allow_negative_stock)
└── Storefront (Space special cu layer public)
    └── Public link (fără autentificare)
filter_idx (indexuri de filtrare materializate server-side:
            global / per-categorie / local-de-Space — vezi SPEC_LocalFilter_v3)
Cart / Tranzacții (motorul de mișcare a stocului: sursă → destinație)
Users / Roles  [TBD]
Orders         [TBD]
```

---

## 5. Modulul Catalog

### 5.1 Categorii

- Structură **ierarhică** (arbore de foldere și categorii-frunză), definită de tenant
- Tenantul creează, editează, grupează categorii
- Se poate intra într-o categorie → afișează lista de produse din acea categorie
- **Unicitate globală per tenant** pentru numele de categorie (pe nume normalizat: lowercase, trim, diacritice pliate). Motiv: tab-ul Flux din StockHub afișează categoriile în listă plată, fără context ierarhic — duplicatele ar fi indistinguibile. **Folderele sunt libere** (nu apar niciodată fără ierarhie)

### 5.2 Schema categoriei

Fiecare categorie are o **schemă dinamică de atribute** definită de tenant. Tipuri de atribute:

| Tip | Comportament |
|---|---|
| Text | Valoare liberă, unică per produs |
| Single choice list | Alegi o valoare dintr-o listă; poți adăuga valori noi în listă |

Fiecare atribut are un flag `filterable` (default: `single_choice` → true, `text` → false, override manual).

**Atribute globale:** un atribut poate fi marcat „global" — se leagă de un registry cross-categorie (ex. „Brand") și devine disponibil în orice categorie, cu un vocabular unic de opțiuni partajat. Doar `single_choice` în v1. Detalii: `SPEC_LocalFilter_v3.md` §6.2, `SPEC_DatabaseSchema_v3.md` §4–§5.

> **Notă:** `Multiple choice list` nu există ca tip de atribut — funcționalitatea e acoperită de Tags (§5.4).
> **Notă:** `Tags` NU este un field type în schema categoriei. Este un sistem separat, global, descris la §5.4.

### 5.3 Produse

- Lista de produse per categorie
- **NameID** — identificatorul uman al produsului: generat automat de sistem, pronunțabil și memorabil (stil nume de deploy Netlify), **imuabil** și needitabil. Joacă rolul de UUID lizibil; nu există câmp „nume" editabil de user. Mecanica (generator, unicitate, înlocuirea `products.name`, relația cu atributele definite de user) → `SPEC_LocalFilter_v3.md` §5.1 și `SPEC_DatabaseSchema_v3.md` §6.1
- Fiecare produs are atributele definite în schema categoriei
- Adăugare produs-cu-produs SAU import din Excel (schema se poate genera din structura tabelului)
- Filtrare produse prin modulul unificat de filtrare (OR în cadrul unui atribut, AND între atribute) — vezi §5.5
- Produsele pot avea **Variante/SKU** (concept first-class)

### 5.4 Tags — vocabular flat, cross-categorie

**Conceptul cheie:** Tags nu sunt un atribut din schema categoriei. Sunt un vocabular la nivel de catalog, aplicabil pe orice produs din orice categorie.

**Structura de date:** `products.tags text[]` — listă plată pe produs, sursă unică pentru date și filtrare. Fără structură de grupuri la nivel de date.

**Comportament la adăugare tag pe produs:**
- Selectezi din tag-urile existente cu **prefix search** (anti-duplicare)
- Sau creezi un tag nou → devine disponibil în tot catalogul
- Per produs: **multi-select** (oricâte tag-uri)

**Rol funcțional:**
- Filtrare **cross-category** — filtrezi tot catalogul după un tag, indiferent de categoria produsului
- Logică filtrare: **OR flat** peste toate tag-urile bifate — gruparea vizuală NU introduce AND între grupuri

**Grupare vizuală (Tag Groups) — strat pur UI, opțional, amânabil:**
- Metadata de configurare separată, consumată exclusiv de UI pentru organizarea listei de tag-uri în bottom sheet (răsfoire pe grupuri, ajutor de regăsire pentru tag-uri folosite rar)
- Fără nicio legătură cu `products.tags`, cu `filter_idx` sau cu logica de filtrare
- Căutarea prin tastare rămâne flată, indiferent de grupare
- Detalii: `SPEC_LocalFilter_v3.md` §5.2.5

### 5.5 Filtrare — modul unificat

Filtrarea produselor folosește **același modul** în Catalog și în Space (bottom sheet 2 coloane stil eMAG, rând „Categorie" single-select ca prim atribut, scope global/restrâns după bifarea categoriei, contoare faceted). Filtrarea e 100% client-side, pe indexuri inversate (`filter_idx`) materializate server-side. Specificația completă: `SPEC_LocalFilter_v3.md`.

---

## 6. StockHub

StockHub este modulul de gestiune a spațiilor de stoc. Conține unul sau mai multe **Spaces** — fiecare Space reprezentând un loc fizic sau logic unde există stoc.

### 6.1 Catalog vs. Space — separarea fundamentală

- **Catalog** — sursa unică de adevăr a produselor. **NU conține stoc.** E doar definiția produselor.
- **Space** — segment al Catalogului care **deține stocul efectiv** (câte bucăți și unde).

> Catalogul descrie *ce* produse există; Spaces spun *câte* bucăți sunt și unde. **Stocul există exclusiv în Spaces.**

### 6.2 Modelul de date al Space-ului: pointer + delta

Un Space este un **mini-catalog dinamic** — un segment din Catalog, materializat ca **listă de pointeri** către produse, populat exclusiv prin tranzacții.

**Produsul în Space NU e o clonă.** Este:
- **Pointerul** către produsul din Catalog (`product_id` / UUID), plus
- **Delta locală** — atributele proprii acelui Space: stocul și tag-urile locale de Space

**Consecințe:**
- Toate atributele definite în Catalog (NameID, tags de catalog, brand, atribute per-categorie) se citesc **live prin pointer** — se văd mereu în forma lor curentă. Nu există copie care să se desincronizeze
- Tag-urile locale adăugate într-un Space rămân în delta locală a acelui Space — nu se propagă înapoi în Catalog
- Apartenența la categorie (din Catalog) e folosită ca **dimensiune de filtrare** în Space, NU ca nivel de navigare (§6.4)

**Populare exclusiv prin tranzacții:**
- O locație nu conține inițial nicio informație
- Un produs „intră" într-un Space doar când o tranzacție îl aduce acolo (locația a fost Sursă sau Destinație)
- La prima sosire a unui produs într-un Space, se **inserează pointerul** cu cantitatea din coș drept stoc inițial — nu se copiază niciun atribut
- Conținutul unui Space e rezultatul istoricului de tranzacții care l-au alimentat

Coșul (Cart) poate fi inițiat din contextul fiecărei categorii, atât în Catalog cât și într-un Space.

### 6.3 Cele două tab-uri ale unui Space: Stoc și Flux

Pagina unui Space are un toggle între două vizualizări:

- **Stoc** — **listă plată de produse, sortată după relevanță** (ca un magazin online), NU grupată pe foldere de categorii. Categoria apare doar ca metadata pe card. Header cu rezumat („6 produse · 8 unități"). Search contextual. Filtrarea (inclusiv pe categorie) se face din modulul de filtrare (§6.4)
- **Flux** — istoricul tranzacțiilor locației (§6.5). Badge cu numărul de tranzacții relevante

### 6.4 Modelul de navigare în StockHub — categoria ca filtru, nu ca folder

**Decizie de arhitectură importantă.** Ierarhia de categorii tip foldere se **construiește și se gestionează în Catalog**. În StockHub, această ierarhie **nu apare ca navigare cu foldere**.

**Comportament la intrarea într-un Space:**
- Vezi direct produsele din Space, sortate după relevanță
- Pentru a îngusta pe categorie (sau alte criterii), deschizi modulul de filtrare

**Modulul de filtrare (identic cu cel din Catalog — vezi §5.5):**
- Bottom sheet 2 coloane stil eMAG: stânga = atribute (primul rând = „Categorie", single-select), dreapta = valorile atributului selectat, cu contoare
- **Filtrarea pe categorie e listă plată** — categoriile prezente în Space, fără arbore
- `stoc` apare ca rând de filtrare mereu vizibil (comportament de atribut global în UI; datele vin din indexul local de Space)

**Distincția arbore vs. filtrare (valabilă și în Catalog):**
- **Arborele de foldere** e instrument de **navigare/administrare** — regăsirea și accesarea unei categorii (căutabil din bottom-bar în Catalog). Nu participă niciodată la filtrarea produselor
- **Filtrarea** e mereu **listă plată** de categorii, pe tot scope-ul (tot catalogul, respectiv tot Space-ul)

**Rațiunea deciziei:**
- Se evită navigarea cu foldere imbricate de două ori: foldere-de-spaces → space → iar foldere-de-categorii
- Când spaces devin multe, tenantul va organiza și spaces-urile pe foldere (la landing-ul StockHub). Folderele rămân instrument de *organizare*, nu de *navigare în produse*

> **Contrast Catalog vs. StockHub:**
> - **Catalog** — ecran implicit de ierarhie (navigare/administrare: intri într-o categorie ca să-i editezi schema și produsele) + mod de filtrare pe tot catalogul, comutabil prin butonul Filtrează
> - **StockHub** — produse-first: intri într-un Space, vezi lista flat, filtrezi prin același modul

### 6.5 Tab Flux — istoricul tranzacțiilor (registru per locație)

Tab-ul „Flux" e registrul complet al mișcărilor de marfă care au implicat locația. Servește la trasabilitate și monitorizarea intrărilor/ieșirilor.

**Identificarea produselor în Flux:**
- Legătura stabilă a unei linii către produs = **UUID-ul intern** (imuabil, invizibil)
- Eticheta umană afișată = **NameID**. Fiind imuabil, eticheta din istoric coincide întotdeauna cu cea curentă — nu există snapshot de etichetă în linia de tranzacție
- Categoriile apar în listă plată, fără context ierarhic — de aici cerința de unicitate globală a numelor de categorie (§5.1)

**Interfață în stil chat (WhatsApp-style):**
Feed vertical de blocuri agregate, organizate după direcția mișcării:

| Direcție | Aliniere | Marcaj vizual |
|---|---|---|
| **Inbound** (Destinație / Intrări) | aliniat **STÂNGA** | linie verticală **VERDE** în **dreapta** textului |
| **Outbound** (Sursă / Ieșiri) | aliniat **DREAPTA** | linie verticală **ROȘIE** în **stânga** textului |

Fiecare bloc afișează: tipul (INTRARE/IEȘIRE), originea/destinația (ex: „din exterior" = Catalog, „← depoo" = altă locație), data/ora, lista de produse cu cantitatea cu semn (+/−), și un sumar (ex: „+5 bucăți · 4 articole"). Listele lungi se truncează („+1 produs ...").

**Logica de agregare:**
- **Base dataset (`trnz-data`):** array de tranzacții filtrat pentru locația curentă
- **View by > Daily:** produse grupate prin `product_id`, cantitate = `SUM(quantities)` per bloc/interval
- **Dual-Block System:** dacă într-un interval locația a fost și Sursă și Destinație, se generează **două blocuri distincte**
- **Netting Mode (toggle „Balanță"):** scade ieșirile din intrări → afișează un singur bloc de „Rulaj Net"

**UX:**
- **Sticky header:** data/intervalul rămâne fixat sus la scroll
- **Sumar configurabil** la finalul fiecărui bloc: Total cantitate, Valoare totală, Media ponderată a prețului, nr. SKU-uri unice
- **Constrângeri meniu filtre:**
  - `Interval` (orizont de timp) ≥ `View by` (granularitate)
  - Tip: `Source` (Outbound) / `Destination` (Inbound) — minim unul activ
- **Atribute afișate:** Categorie, Preț Mediu Ponderat, Cost, Unități de măsură

### 6.6 Modelul de stoc

**Stoc independent per Space.** Fiecare Space deține propriul stoc per produs/variantă (în delta locală a pointerului). Nu există un „stoc global" stocat separat — orice agregare globală e suma Space-urilor. Mișcările între Space-uri sunt transferuri (scădere la sursă, adunare la destinație).

### 6.7 Stoc negativ — flag de comportament, nu de permisiune

Fiecare Space are un flag `allow_negative_stock`, setat **o singură dată la crearea spațiului**.

**Punct cheie:** flag-ul NU controlează ce e permis tehnic. **Nicio tranzacție nu este blocată vreodată, în niciun spațiu.** Realitatea fizică are prioritate față de cea înregistrată.

Flag-ul controlează doar dacă stocul negativ e o **stare așteptată** sau o **anomalie de semnalat**:

| Flag | Comportament |
|---|---|
| `allow_negative_stock = false` (spațiu normal) | Negativul e permis tehnic, dar **evidențiat ca anomalie** |
| `allow_negative_stock = true` | Negativul e starea normală a spațiului. Nu se semnalează nimic. |

### 6.8 Principiul anomaliilor: prevenit, nu blocat

Stările anormale sunt tratate uniform:

1. **Permise** — tranzacția trece întotdeauna
2. **Prevenite** — utilizatorul e avertizat înainte/în timpul operațiunii că rezultatul va fi anormal
3. **Evidențiate** — anomalia apare ca **notificare care așteaptă rezolvare**, într-un loc dedicat

> Sistemul nu împiedică operațiunea reală — îi dă utilizatorului contextul și un fir de urmărit. *(Mecanica concretă a notificărilor se detaliază separat.)*

### 6.9 Storefront — Space special

- Moștenește comportamentul unui Space (deține stoc propriu)
- Are în plus un **layer de prezentare**: override-uri de afișare (denumiri publice, descrieri, imagini), câmpuri vizibile publicului
- **Link public** accesibil fără autentificare
- Detalii despre layer-ul de prezentare → `[TBD]`

---

## 7. Tranzacții — Coșul ca motor de mișcare a stocului

Stocul se mișcă **exclusiv prin tranzacții generate din coșul de comandă (Cart)**. Coșul e un instrument universal de transfer, indiferent dacă sursa e Catalogul sau un Space.

### 7.1 Structura unei tranzacții

- **Sursă (Source)** — de unde pleacă marfa
- **Destinație (Destination)** — unde ajunge marfa

La procesare: cantitățile din coș se **scad din sursă** și se **adaugă în destinație**.

### 7.2 Reguli pe tipuri

| Sursă | Comportament |
|---|---|
| **Catalog** | Catalogul nu are stoc → e doar un punct de „alegere produse". Acțiunea generează o tranzacție de **aprovizionare** către un Space destinație. |
| **Space** | **Transfer** de stoc dintr-un Space în altul: scădere din sursă, creștere în destinație. |

**Destinația = doar Space.** Catalogul este **exclus** ca destinație.

### 7.3 Prima apariție a unui produs într-un Space

Un produs adăugat în coș poate să nu existe încă în Space-ul sursă sau destinație selectat. Sistemul tratează asta automat și **simetric**:

- **Produs existent în locație** (pointer prezent) → se modifică doar stocul din delta locală
- **Produs inexistent în locație** → se **inserează pointerul** către produsul din Catalog, cu cantitatea din coș drept stoc inițial. Nu se copiază niciun atribut — totul se citește live prin pointer (§6.2)

Se aplică la ambele capete: dacă pointerul lipsește din Space-ul sursă, e inserat și acolo (cu stocul rezultat, posibil negativ), nu doar la destinație.

### 7.4 Rezumatul fluxului

```
Catalog (definiții, fără stoc)
   │  alegere produse → Cart
   ▼
Cart (sursă + destinație + cantități)
   │  procesare tranzacție (niciodată blocată)
   ▼
Sursă: scădere stoc              Destinație (doar Space): adunare stoc
(inserare pointer dacă lipsește) (inserare pointer dacă lipsește)
   │
   ▼
Sold anormal? → permis, dar semnalat ca notificare de rezolvat
   │
   ▼
Rebuild filter_idx local de Space (lista de pointeri s-a schimbat)
```

---

## 8. UX / Layout

### 8.1 Principii generale

- **Mobile-first**, PWA ca target principal
- **Dark theme by default**
- CSS: `100dvh` / `100svh` pentru stabilitate layout

### 8.2 AppShell

```
┌─────────────────────────┐
│         TopBar          │  ← fixat sus
├─────────────────────────┤
│                         │
│      MainContent        │  ← scrollabil
│                         │
├─────────────────────────┤
│  [Search Bar] [Menu]    │  ← BottomBar fixat jos
└─────────────────────────┘
```

- `BottomBar`: ascundere la scroll în jos, reapariție la scroll în sus (CSS transform pe containerul `MainContent`, nu pe `window`)

### 8.3 Filosofia Bottom-design

Toate elementele interactive majore sunt plasate în **jumătatea inferioară a ecranului** — optimizat pentru utilizare cu o singură mână.

**Bara de căutare (Search Bar):**
- Contextuală — focusul se schimbă automat pe elementele paginii curente
- Ancorată deasupra tastaturii virtuale când aceasta e activă
- Input configurat să blocheze bara de Autofill Android:

```jsx
<input
  type="search"
  name="search"
  id="search"
  autoComplete="off"
  enterKeyHint="search"
  data-lpignore="true"
  data-1p-ignore="true"
/>
```

**Meniu contextual (lângă Search Bar, în dreapta):**
- Iconița și opțiunile se schimbă dinamic în funcție de pagina curentă
- Apăsarea deschide un meniu lateral (stânga sau dreapta, context-dependent)

### 8.4 Bottom-sheet (Dialog)

Orice dialog/modal se deschide ca **bottom-sheet**:
- Pornește de deasupra BottomBar-ului
- Se extinde până la 90% din înălțimea ecranului
- **Cu căutare activă:** bara de search din BottomBar filtrează datele din interiorul bottom-sheet-ului
- **Fără căutare:** bara de search se ascunde automat pe durata afișării bottom-sheet-ului
- Bottom-sheet-urile **nu conțin niciodată** propriul input de căutare

### 8.5 Convenție de comunicare la dictare (NU specificație)

> Această secțiune **nu descrie arhitectura**. Sunt termeni scurți pe care Bibicu îi folosește în conversație (prin dictare vocală în română).

| Termen folosit | Se referă la |
|---|---|
| „căutare" | Search bar din BottomBar |
| „meniu" | Meniul lateral activat la apăsarea iconului |
| „dialog" | Bottom-sheet |

---

## 9. Users / Roles

`[TBD]`

---

## 10. Orders

`[TBD]` — Notă deschisă: rezervarea stocului la plasarea comenzii vs la confirmarea de admin.

---

## 11. Workflow de dezvoltare

| Instrument | Rol |
|---|---|
| Claude.ai (chat nou per funcționalitate) | Planificare, arhitectură, validare vizuală în artifacts |
| Claude Code CLI | Implementare în proiect, montare componente |
| `ARCHITECTURE.md` | Document persistent, actualizat după fiecare funcționalitate |
| `STATUS.md` | Actualizat de Claude Code după fiecare sesiune |

**Fluxul per funcționalitate:**
1. Descriere funcționalitate în Claude.ai
2. Construire + validare artifact (iterații până e corect)
3. Scriere `SPEC_NumeComponenta.md`
4. Trimitere în Claude Code: SPEC + fișiere `.jsx/.js` din artifact + context proiect
5. Claude Code montează în proiect
6. Actualizare `STATUS.md` + `ARCHITECTURE.md`

---

## 12. Jurnal de revizuire

12.1. **§5.4 rescris — Tags flat + Tag Groups pur UI.** Modelul anterior (Tag Vocabulary structurat: Tag Groups → Tag Values, cu logică „OR în grup, AND între grupuri") înlocuit: date = `products.tags text[]` flat, filtrare = OR flat, gruparea = metadata de configurare consumată exclusiv de UI, opțională și amânabilă. (Decizia din SPEC_LocalFilter_v3 §5.2.)

12.2. **§6.2 și §7.3 rescrise — pointer + delta, nu clonă.** Eliminat integral limbajul de „clonare a produsului în schema Space-ului". Produsul în Space = pointer către Catalog + delta locală (stoc, tag-uri locale); atributele de Catalog se citesc live. „Prima apariție" = inserare pointer, nu copiere. (SPEC_LocalFilter_v3 §7.)

12.3. **§6.4 clarificat — arbore = navigare, filtrare = listă plată.** „Dialogul de filtrare model eMAG" cu arbore de categorii căutabil înlocuit cu modulul unificat de filtrare: rând „Categorie" single-select cu listă plată; arborele de foldere rămâne exclusiv instrument de navigare/administrare (în Catalog). Contrastul Catalog vs. StockHub actualizat cu mode-switch-ul din Catalog. (SPEC_LocalFilter_v3 §10–§11.)

12.4. **§5.5 adăugat — modulul unificat de filtrare** ca referință scurtă către SPEC_LocalFilter_v3 (indexuri materializate, client-side, faceted counts).

12.5. **NameID introdus** (§4, §5.3, §6.5) la nivel **conceptual**: identificator de sistem auto-generat, imuabil; etichetă umană în Flux fără snapshot. Mecanica (generator, retry, unicitate per tenant, eliminarea `products.name`) trăiește exclusiv în SPEC_LocalFilter_v3 §5.1 și SPEC_DatabaseSchema_v3 §6.1 — arhitectura referențiază, spec-urile detaliază.

12.6. **§5.1 — unicitate globală a numelor de categorie** (per tenant, normalizat, doar categorii; folderele libere), cu motivația Flux. (HANDOFF §2, deciziile 16–18.)

12.7. **§5.2 — flag `filterable` și atributele globale** menționate în schema categoriei, cu trimitere la spec-uri.

12.8. **§4 actualizat** — ierarhia datelor reflectă: atribute globale, tags flat, NameID, Space ca pointeri + delta, `filter_idx`.

12.9. **Neschimbate:** stack (§2), navigare principală (§3), tab-urile Stoc/Flux și interfața chat-style a Fluxului (§6.3, §6.5), modelul de stoc și anomalii (§6.6–6.8), Storefront `[TBD]` (§6.9), reguli tranzacții sursă/destinație (§7.1–7.2), UX/Layout (§8), Users/Roles și Orders `[TBD]`, workflow (§11).

---

*Ultima actualizare: reconciliere arhitecturală — Tags flat cu grupare pur UI, model pointer + delta pentru Space, arbore = navigare / filtrare = listă plată, NameID, unicitate globală categorii, modul unificat de filtrare. Rămân deschise: §6.9 layer prezentare Storefront, §9 Users/Roles, §10 Orders, decizia Preț/Cost (SPEC_DatabaseSchema_v3 §11).*
