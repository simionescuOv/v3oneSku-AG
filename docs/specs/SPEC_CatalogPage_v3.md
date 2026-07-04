# oneSku — SPEC Catalog Page v3

> **v3** — rescriere completă a `SPEC_CatalogPage_v2.md`. Integrează deciziile sesiunii de
> reconciliere: mode-switch-ul ierarhie ↔ filtrare, modulul unificat de filtrare cu rândul
> „Categorie", și implicațiile NameID / unicitate globală. Trasabilitatea — în §10
> („Jurnal de revizuire v2 → v3").
>
> Dependențe: `SPEC_Picker_v2.md` (hook-ul `usePicker` și regulile BottomBar),
> `SPEC_LocalFilter_v3.md` (modulul de filtrare), `SPEC_DatabaseSchema_v3.md` (unicitate
> globală categorii), `SPEC_CatalogRPC.md` (operațiile server-side).

---

## 0. Rolul paginii — două moduri pe aceeași rută

Pagina Catalog are **două moduri distincte**, comutabile, pe aceeași rută:

| Mod | Rol | Ecran |
|---|---|---|
| **Ierarhie** (implicit) | **Navigare/administrare** — crearea, organizarea, regăsirea și accesarea categoriilor și folderelor | Arbore de foldere, navigare pe nivele |
| **Filtrare** | **Interogarea produselor** pe tot catalogul | Listă flat de produse + modulul unificat de filtrare (bottom sheet 2 coloane) |

Definiția fundamentală rămâne: Catalogul e o pagină de **administrare** (gestiune), nu de
consultare. Modul de filtrare nu contrazice asta — e un mod **separat**, nu o consultare
suprapusă peste ierarhie. Cele două moduri nu se amestecă niciodată: în modul ierarhie nu
se filtrează produse; în modul filtrare nu apare arborele.

**Contrast cu StockHub:** Space-urile nu au modul ierarhie — intri direct în lista flat +
același modul de filtrare (vezi ARCHITECTURE §6.4, SPEC_LocalFilter_v3 §10–§11).

---

## 1. Modul Ierarhie (implicit)

### 1.1 Structura arborelui

| Tip nod | Rol | Poate avea copii | Poate avea produse |
|---|---|---|---|
| `folder` | Organizare ierarhică, N nivele de adâncime | Da (foldere sau categorii) | Nu |
| `category` | Frunză — conține produsele | Nu (e mereu frunză) | Da |

- **Navigare:** tap pe folder → intri în folder (afișezi copiii). Tap pe categorie →
  navighezi în pagina categoriei (produse, schema de atribute).
- **Back:** buton săgeată stânga în TopBar sau gesture de back → urcă un nivel.
- **Breadcrumb:** afișat în TopBar, arată calea curentă (ex: `Catalog > Electronice > Telefoane`).

### 1.2 Unicitate nume — globală per tenant

Numele de **categorie** e unic în tot catalogul (nu doar între frați), pe nume normalizat
(lowercase + trim + diacritice pliate — aceeași funcție `normalize` din `src/lib/search.js`
și `normalize_name` din DB). **Folderele sunt libere.**

- La creare (rândul „+ Adaugă" / FAB): stratul UX `prefix-first` previne majoritatea
  duplicatelor, dar autoritatea finală e indexul din DB — la eroare de unicitate, toast
  „Categoria există deja".
- Vezi `SPEC_DatabaseSchema_v3.md` §3.1.

### 1.3 Layout — listă verticală

Listă verticală cu rânduri (`divide-y`), nu grid de carduri. (Grid-ul rămâne o
posibilitate de UI, nu o constrângere arhitecturală.)

Fiecare rând (`NodeCard`) afișează:
- Icon: `Folder` / `FolderOpen` pentru foldere, `Tag` pentru categorii.
- Nume.
- Tap → navighează (intri în folder sau în categorie).
- **Nu există** icon de meniu, buton de opțiuni, sau alt handler pe card în afară de
  `onClick`. **Nu există long-press.**

### 1.4 Empty state

Când catalogul e gol:
- Text explicativ care instruiește utilizatorul să scrie în bara de căutare pentru a
  adăuga prima categorie.
- Fără buton CTA vizibil.

### 1.5 Căutare — alimentată de `usePicker`, exclusiv NAVIGARE

**Căutarea din bottom-bar în modul ierarhie e exclusiv pentru regăsirea și accesarea unei
categorii/folder (navigare). Nu filtrează niciodată produse.** Filtrarea produselor e
treaba modului de filtrare (§2).

#### 1.5.1 Configurație

```
usePicker({
  items: categorii + foldere din nivelul curent (sau tot arborele dacă search e activ),
  labelFn: (node) => node.name,
  multiSelect: false,
  allowCreate: true
})
```

#### 1.5.2 Comportament

- La tastare în BottomBar, hook-ul filtrează **toate** nodurile (nu doar nivelul curent) —
  căutarea e **globală** în arbore.
- Rezultatele sunt regrupate ierarhic (`buildSearchTree`): fiecare rezultat e afișat sub
  folderul-ancestor, ca utilizatorul să înțeleagă contextul.
  - Folder ancestor care **nu** e el însuși rezultat → header static (necliccabil).
  - Folder care **e** rezultat → rând apăsabil (tap navighează în el).
- La `allowCreate + zero rezultate`:
  - Rând inline „+ Adaugă «query»" în listă.
  - FAB button deasupra BottomBar-ului.
  - Ambele creează categorie nouă cu numele din query, în folderul curent
    (`currentFolderId`).
  - La coliziune de nume (unicitate globală, §1.2) → toast „Categoria există deja".

#### 1.5.3 Ce caută

- **Categorii** (`node_type = 'category'`) și **foldere** (`node_type = 'folder'`),
  simultan — query `"î"` găsește folderul „Îmbrăcăminte".

---

## 2. Modul Filtrare

### 2.1 Comutare

- Butonul **Filtrează** (din meniul contextual al paginii, §3) comută interfața din
  ierarhie în modul de filtrare.
- La comutare, poziția curentă în arbore e **irelevantă**: filtrarea operează pe **tot
  catalogul**, indiferent unde era utilizatorul în ierarhie la momentul apăsării.
- Revenirea la ierarhie: buton dedicat / back — detaliu de UI la implementare, cu regula
  că cele două moduri nu se amestecă vizual.

### 2.2 Conținut

- Ecranul modului = **listă flat de produse** (rezultatele filtrării; inițial nefiltrat,
  tot catalogul) + acces la **bottom sheet-ul de filtrare 2 coloane** (stil eMAG).
- Specificația completă a modulului (structura celor 2 coloane, scope global/restrâns,
  contoare faceted, confirmare la „Arată produsele") e în `SPEC_LocalFilter_v3.md` §10.1
  și §10.2 — nu se duplică aici. Reperele:
  - **Primul rând din coloana stângă = „Categorie"** (single-select, fără pre-bifare,
    listă plată de categorii, căutabilă prin bottom-bar).
  - Fără categorie bifată → scope global: atribute globale + Tags.
  - Cu categorie bifată → se deblochează atributele locale ale acelei categorii.
  - Filtrul se aplică doar la confirmare.
- Cardurile de produs afișează **NameID** ca etichetă umană implicită (+ atribute
  suplimentare alese liber de agent cât timp cardul e placeholder —
  SPEC_LocalFilter_v3 §12.6).

### 2.3 Simetria cu Space

Modulul e **identic** cu cel din Space (aceleași componente, parametrizare minimă).
Singura diferență: în Catalog se ajunge la el prin mode-switch din ierarhie; în Space e
ecranul implicit. Vezi SPEC_LocalFilter_v3 §11.

---

## 3. Meniul contextual (buton din BottomBar)

### 3.1 Declanșare

- Butonul din dreapta BottomBar-ului, cu icon `BookOpen` (specific paginii Catalog).
- Tap → deschide bottom-sheet **fără căutare** (BottomBar se ascunde — e un meniu simplu
  cu opțiuni, nu o listă de filtrat).
- **NU există long-press** și **NU există meniu per-element** pe carduri.

### 3.2 Conținut

```
┌──────────────────────────────┐
│ 🔍 Filtrează                 │  ← comută în modul Filtrare (§2)
│                              │
│ ▸ Config                     │  ← acordeon, tap expandează/colapsează
│   ├── 🔲 Grupare             │  ← stub (toast „în curând")
│   └── 📂 Mutare              │  ← stub (toast „în curând")
│                              │
│ 📖 Unfold / 📕 Fold          │  ← toggle tree view
└──────────────────────────────┘
```

### 3.3 Opțiuni planificate (de conectat la UI)

Logica e implementată în `useCatalogStore` dar neconectată la interfață:

| Opțiune | Logică în store | UI status |
|---|---|---|
| **Filtrează** | — (mode-switch, §2) | De construit odată cu modulul de filtrare |
| **Grupare** | `groupNodes(nodeIds, folderName)` | Stub — necesită: mod selecție, action-bar, picker denumire. Doar la rădăcină, min 2 elemente negrupate |
| **Mutare** | `moveNodes(nodeIds, destinationId)` + `getValidMoveDestinations(nodeId)` (anti-ciclu) | Stub — necesită: mod selecție, picker destinație (standalone, `multiSelect=false`, `allowCreate=false`) |
| **Ștergere categorie** | `deleteCategory(id)` → soft-delete (`deleted_at`) | Neconectat — va fi accesat din pagina categoriei, nu din meniul Catalog |
| **Ștergere folder** | `deleteFolder(id)` → promovează conținut la părinte, apoi șterge | Neconectat — confirmare necesară înainte de execuție |

### 3.4 Unfold / Fold

- Toggle între vizualizarea normală (navigare pe foldere) și o vizualizare **tree complet**
  (toate nodurile, recursiv, indentat, de la rădăcină). Aparține modului ierarhie.
- Stare: `useCatalogStore.treeExpanded` + `toggleTreeExpanded()`.
- Când e activ:
  - Pagina randează `FullTree` — ignoră breadcrumb-ul și navigarea pe foldere.
  - Rândurile din tree sunt **doar vizuale** (fără tap) — scopul e orientarea rapidă,
    nu navigarea.
- Icon comutator: `UnfoldVertical` (activare) / `FoldVertical` (dezactivare).

---

## 4. Operații organizatorice — specificații de comportament

Toate aparțin **modului ierarhie**.

### 4.1 Grupare

- **Disponibilă doar la nivel de rădăcină** (nu în interiorul unui folder).
- **Minim 2 elemente negrupate** trebuie să existe pentru a activa opțiunea.
- Flux:
  1. Utilizatorul activează „Grupare" din meniu.
  2. Pagina intră în **mod selecție**: cardurile devin selectabile (checkbox/highlight).
  3. Utilizatorul selectează ≥2 elemente.
  4. Action-bar apare cu buton „Grupează".
  5. La confirmare → picker denumire (input simplu pentru numele folderului nou).
  6. Se creează folderul, elementele selectate devin copiii lui.

### 4.2 Mutare

- **Orice element** poate fi mutat (categorie sau folder întreg).
- Flux:
  1. Utilizatorul activează „Mutare" din meniu.
  2. Mod selecție → selectează elementul de mutat.
  3. Se deschide **picker standalone** (`multiSelect=false`, `allowCreate=false`)
     cu lista de foldere valide ca destinații.
  4. **Anti-ciclu:** un nod nu poate fi mutat în el însuși sau într-un descendent al
     lui. Picker-ul primește doar destinațiile valide.
  5. La confirmare → `parent_id` al nodului se actualizează.
- Server-side, anti-ciclul e enforțat prin RPC (`SPEC_CatalogRPC.md` §1).

### 4.3 Ștergere categorie (soft-delete + recuperare temporară)

- Categoriile trec prin **soft-delete** (`deleted_at = now()`); dispar din listele active.
- **Recuperare:** pe o perioadă scurtă, categoria poate fi restaurată. La restaurare,
  `parent_id → null` (revine la rădăcină, nu la locația originală).
- Numele categoriei șterse **iese din spațiul de unicitate** (indexul global filtrează
  `deleted_at is null`) — un nume identic poate fi recreat cât categoria e în Trash.
  **Comportament confirmat la coliziune de restaurare:** restaurarea se **blochează** și
  se cere redenumirea categoriei restaurate, cu toast explicativ — „Există deja o
  categorie «X» — alege alt nume pentru cea restaurată" — nu un generic „nume duplicat".
- **Mecanismul de acces la Trash și durata de retenție** — de definit la implementare.
  Scopul e protecție contra ștergerii accidentale, nu un sistem elaborat de arhivare.

### 4.4 Ștergere folder (hard-delete + promovare)

- Folderele **nu** au soft-delete — se șterg imediat.
- La ștergere:
  - **Folder cu conținut:** prompt de confirmare → copiii se **promovează la părintele
    folderului**, apoi folderul se șterge.
  - **Folder gol:** prompt „Păstrezi sau ștergi?" → ștergere directă.
- Server-side, `ON DELETE RESTRICT` pe `parent_id` garantează că promovarea a rulat
  înainte de DELETE (`SPEC_DatabaseSchema_v3.md` §0.3, `SPEC_CatalogRPC.md` §2).

---

## 5. Fișiere relevante (referință rapidă)

| Fișier | Rol |
|---|---|
| `src/pages/CatalogPage.jsx` | Pagina — moduri, căutare, meniu, FAB, tree view |
| `src/lib/search.js` | `normalize`, `scoreMatch`, `filterAndSort` (algoritm canonic; `normalize` = paritate cu `normalize_name` din DB) |
| `src/hooks/usePicker.js` | Hook generic — de conectat la CatalogPage |
| `src/components/shell/BottomBar.jsx` | Search input + buton icon dinamic |
| `src/components/shell/AppShell.jsx` | Layout fix, `visualViewport` |
| `src/hooks/useViewportHeight.js` | Hook pt. dimensionare AppShell la tastatură |
| `src/components/catalog/BottomSheet.jsx` | Primitivă bottom-sheet (backdrop + panel) |
| `src/components/catalog/NodeCard.jsx` | Rând folder/categorie, doar `onClick` |
| `src/store/useCatalogStore.js` | Zustand: CRUD, tree ops, trash — implementate |
| `src/lib/navItems.js` | Mapping icon/acțiune per pagină pentru BottomBar |

Modulul de filtrare (componenta de listă produse + bottom sheet 2 coloane) e componentă
**nouă, partajată** cu Space — de construit conform SPEC_LocalFilter_v3, nu specifică
acestei pagini.

---

## 6. Anti-pattern-uri

| Anti-pattern | Status |
|---|---|
| Long-press pe card pentru meniu contextual | **INTERZIS DEFINITIV** |
| Bottom-sheet cu **propriul** input de căutare separat | **INTERZIS** — căutarea trece mereu prin BottomBar |
| Folosirea căutării din modul ierarhie pentru filtrarea produselor | **INTERZIS** — arborele e navigare; filtrarea produselor trece exclusiv prin modulul de filtrare |
| Amestecarea vizuală a celor două moduri (filtre peste ierarhie, arbore în ecranul de filtrare) | **INTERZIS** — mode-switch complet, nu suprapunere |
| `translateY` pe BottomBar legat de tastatură | **INTERZIS** — singurul `translateY` e hide/show la scroll |
| `position: fixed` pe FAB/toast/sheet în interiorul AppShell | **INTERZIS** — folosește `absolute` |
| Grid 2 coloane ca decizie arhitecturală | **DESCHIS** — codul are listă; grid-ul e posibilitate de UI |

---

## 7. Instrucțiuni pentru agentul Claude Code

1. **Conectează `usePicker` la `CatalogPage`**: înlocuiește logica ad-hoc de căutare
   (`searchableNodes`, `searchMatches`, `handleCreateFromSearch`) cu o instanțiere de
   `usePicker`. Comportamentul vizibil rămâne identic — refactoring intern.
2. **Mode-switch-ul (§2)** se construiește odată cu modulul de filtrare din
   SPEC_LocalFilter_v3 — componenta de filtrare e **partajată** cu Space; nu construi o
   variantă specifică Catalogului. Intrarea: opțiunea „Filtrează" din meniul contextual.
3. **Operațiile organizatorice** (Grupare, Mutare, Ștergere) — logica e în store. Când
   conectezi la UI, respectă fluxurile din §4. **Nu inventa mecanisme de interacțiune noi.**
4. **La migrarea pe Supabase:** logica de tree din `useCatalogStore` se mută în RPC-uri
   server-side (`SPEC_CatalogRPC.md`). Store-ul devine client simplu. Atenție: unicitatea
   numelor de categorie devine **globală per tenant** — mesajul de eroare la duplicat nu
   mai depinde de folderul curent.
5. **Nu readăuga long-press** — sub nicio formă, pe nicio componentă.
6. **Trash-ul e simplu:** soft-delete + recuperare. La coliziune de restaurare (§4.3):
   blochează restaurarea și cere redenumire, cu toastul explicativ specificat acolo. Nu
   construi un sistem elaborat.

---

## 8. Jurnal de revizuire (v2 → v3)

8.1. **§0 rescris — două moduri pe aceeași rută.** v2 definea pagina exclusiv ca ierarhie
de administrare. v3 adaugă mode-switch-ul: ierarhie (implicit, navigare/administrare) ↔
filtrare (listă flat + modul unificat pe tot catalogul). Definiția „administrare, nu
consultare" rămâne validă — filtrarea e mod separat, nu consultare suprapusă.
(HANDOFF §3.3, SPEC_LocalFilter_v3 §10.2.)

8.2. **§2 adăugat — modul Filtrare.** Rândul „Categorie" single-select și în Catalog
(simetric cu Space), scope pe tot catalogul indiferent de poziția în arbore, referință la
SPEC_LocalFilter_v3 fără duplicarea specificației. Opțiunea „Filtrează" adăugată în meniul
contextual (§3.2–3.3).

8.3. **§1.5 clarificat — căutarea din ierarhie e exclusiv navigare.** Formulare explicită
(nou anti-pattern în §6): căutarea în arbore regăsește/accesează categorii, nu filtrează
produse. (SPEC_LocalFilter_v3 §10.2.2.)

8.4. **§1.2 adăugat — unicitate globală per tenant** pe nume normalizat (înlocuiește
unicitatea per-sibling implicată de v2), folderele libere; consecința pentru §4.3
(coliziune posibilă la restaurare din Trash) semnalată. (SPEC_DatabaseSchema_v3 §3.1.)

8.5. **NameID pe cardurile de produs** din modul filtrare (§2.2), conform
SPEC_LocalFilter_v3 §5.1.7 și §12.6.

8.6. **Anti-pattern-uri extinse (§6):** două rânduri noi — căutarea de navigare folosită
la filtrare; amestecarea vizuală a modurilor.

8.7. **Neschimbate din v2:** structura arborelui și navigarea (§1.1), layout listă
verticală (§1.3), empty state (§1.4), mecanica `usePicker` și regruparea ierarhică a
rezultatelor (§1.5), meniul contextual fără long-press (§3), Unfold/Fold (§3.4),
fluxurile Grupare/Mutare/Ștergere (§4), interdicțiile de long-press / search în sheet /
`position: fixed` / `translateY` (§6), simplitatea Trash-ului.

---

*v3 — rescriere completă: mode-switch ierarhie ↔ filtrare pe aceeași rută; modulul
unificat de filtrare cu rândul „Categorie" (referință la SPEC_LocalFilter_v3, componentă
partajată cu Space); căutarea din arbore = exclusiv navigare (anti-pattern nou); unicitate
globală normalizată a numelor de categorie cu nota de coliziune la restaurare; NameID pe
carduri; jurnal complet în §8.*
