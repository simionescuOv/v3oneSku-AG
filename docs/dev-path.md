# oneSku — Parcursul Dezvoltării & Jurnal Tehnic (`dev-path.md`)

> **REGULĂ OBLIGATORIE PENTRU TOȚI AGENȚII DE COD / VIBECODING:**
> **ÎNAINTE de a rula comanda `git commit`**, actualizați OBLIGATORIU acest fișier și includeți-l în `git add` împreună cu restul fișierelor, astfel încât modificările de cod și înregistrarea din jurnal să fie salvate **ÎNTR-UN SINGUR COMMIT unitar** (fără commit-uri separate).
> 1. Adăugați o nouă intrare în secțiunea **„Jurnalul Commit-urilor (Chronological Log)”** de mai jos.
> 2. Notați:
>    - **Titlul exact al commit-ului din Git**
>    - **Data și Ramura**
>    - **Descrierea amplă în limbaj natural**: ce funcționalitate a fost adăugată/modificată, de ce s-a luat această decizie, ce fișiere/module au fost atinse și cum interacționează cu restul sistemului.
> 3. Actualizați sumarul secțiunii **„Starea Funcționalităților Actuale”** dacă s-au adăugat capacități noi.

---

## 1. Misiunea și Arhitectura Cheie a Aplicației

**oneSku** este o aplicație de gestiune de stoc și catalog dedicată magazinelor mici și mijlocii (sute/mii de SKU-uri), optimizată pentru operare ultra-rapidă de pe mobil (Mobile-First / PWA).

### Principii Fundamentale de Reținut:
1. **Local-First & Single-Fetch**:
   - Datele catalogului (categorii, atribute, produse, stocuri de bază) se aduc o singură dată la inițializare în memoria locală Zustand (`useCatalogStore`).
   - Navigarea între pagini, foldere, filtre și detalii de produs se execută **100% pe client (0 ms latență)**.
   - Cererile de rețea (Supabase) sunt strict rezervate mutațiilor explicite (adăugare/editare/ștergere).
2. **Bottom-Design (One-Hand UX)**:
   - Bara de căutare contextuală și meniul sunt ancorate în `BottomBar` (jos).
   - Modalele se deschid exclusiv ca `BottomSheet` (de jos în sus).
   - Filtrarea și căutarea în sheet-uri se fac prin bara unificată din `BottomBar`, fără a aglomera dialogurile cu câmpuri redundante de căutare.
3. **Data Model: Schemă Dinamică per Categorie & NameID**:
   - Fiecare categorie își definește atributele (tip text, single_choice, number etc.).
   - Produsele primesc un identificator compus unic (`name_id` / `NameID`) generat din valorile atributelor cheie.
   - Tags: vocabular flat la nivel de tenant, stocat în `products.tags text[]`, cu filtrare OR instantanee.

---

## 2. Starea Funcționalităților Actuale (Current Feature Set)

În prezent, aplicația include următoarele module complet sau parțial operaționale:

1. **Autentificare & Multi-Tenancy (`src/store/useAuthStore.js`, `src/pages/LoginPage.jsx`, `src/pages/AccountPage.jsx`)**:
   - Autentificare OAuth prin Google via Supabase Auth.
   - Suport multi-tenant bazat pe `tenant_members` și RLS (Row Level Security).
   - Pagina de cont (`/account`) afișează emailul, tenantul asociat, rolul (`admin`) și butonul de delogare.
2. **Catalog & Categorii (`src/pages/CatalogPage.jsx`, `src/pages/CategoryPage.jsx`)**:
   - Structură ierarhică de categorii și sub-foldere.
   - Încărcare completă a arborelui în `useCatalogStore`.
   - Modale de creare și editare categorii / foldere (`CategoryFormSheet.jsx`).
   - Schema categoriei (`SchemaSheet.jsx`): definirea atributelor specifice categoriei + secțiune informativă read-only „De sistem” (NameID și Tags).
3. **Produse & Formulare (`src/pages/ProductPage.jsx`, `src/components/catalog/ProductFormSheet.jsx`)**:
   - Creare și **editare** produse pe baza schemei categoriei printr-o **componentă unică unificată** (`ProductFormSheet.jsx`).
   - Câmp dedicat de Tags (chips cu ștergere rapidă).
   - Mecanismul **SWAP** la deschiderea picker-ului: formularul se ascunde vizual cât e deschis picker-ul și revine cu starea intactă, fără suprapunere haotică de modale.
   - Rută client-side dedicată pentru vizualizarea detaliată a produsului: `/catalog/product/:nameId`.
   - Meniu contextual accesibil din bara de jos (`BottomBar`) pe pagina produsului (icon dedicat `Package`), cu opțiune de editare a atributelor, tag-urilor și prețului.
4. **Picker Unificat (`src/components/catalog/PickerSheet.jsx`)**:
   - Picker generic cu suport pentru `multiSelect` (pentru Tags) și `single_choice` (pentru atribute din schemă).
   - Integrare directă cu filtrarea din `BottomBar`.
   - Creare rapidă de opțiuni noi din tastatură (+ Adaugă „query”).
5. **AppShell & Navigare (`src/components/layout/AppShell.jsx`, `src/components/layout/BottomBar.jsx`)**:
   - Layout mobil optimizat cu `100dvh`.
   - Meniu lateral glisant (`SideMenu.jsx`).
   - `BottomBar` cu auto-hide la scroll în jos și afișare la scroll în sus.
   - Modul `aboveBottomBar` pentru bottom-sheet-uri pentru a menține bara de căutare accesibilă.

---

## 3. Jurnalul Commit-urilor (Chronological Log)

Fiecare commit nou trebuie adăugat la începutul acestei liste:

### [Commit `988dcec`] — `editare produs`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Descriere Detaliată**:
  - **Componentă Unică Formular (`ProductFormSheet.jsx`)**: S-a extins componenta pentru a funcționa în mod dual (atât pentru adăugare cât și pentru editare de produs). Prepopulează atributele, tag-urile și prețul existent la primirea prop-ului `product`, adaptează titlul și butonul de salvare și previne resetarea eronată a picker-urilor prin separarea efectelor de inițializare a stării de sincronizarea `BottomBar`-ului.
  - **Persistență în Store (`useCatalogStore.js`)**: S-a adăugat metoda `updateProduct(productId, attributes, listPrice, tags)` care actualizează direct tabela `products` din Supabase (cu suport RLS și trigger-e automate de rebuild pentru `filter_idx`) și resincronizează datele din starea Zustand locală.
  - **Icon & Meniu Contextual Pagină Produs (`BottomBar.jsx` & `ProductPage.jsx`)**: În bara de navigare inferioară, pe ruta `/catalog/product/:nameId`, icon-ul s-a schimbat în `Package`. La apăsare, se deschide meniul contextual al produsului ce conține opțiunea „Editează produsul” (cu icon `Pencil`), conectată la dialogul de editare și notificări Toast.
  - **Specificație Formular Secvențial (`docs/specs/SPEC_FormSecventialProdus.md`)**: A fost creată specificația completă de arhitectură UX pentru viitoarea implementare a introducerii de date pas cu pas (Stepper / Wizard) unificat pentru ambele operațiuni.

---

### [Commit `427fc8d`] — `build: smarald - add dev-path documentation and mandatory agent logging protocol`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Descriere Detaliată**:
  - **Documentație de Parcurs (`docs/dev-path.md`)**: Creat registrul istoric și tehnic de dezvoltare pentru orientarea oricărui agent viitor de vibecoding/coding, descriind arhitectura, starea curentă a modulelor și jurnalul detaliat al commit-urilor.
  - **Protocol Obligatoriu de Jurnalizare**: S-a adăugat regula 7 în `GEMINI.MD` și secțiunea corespunzătoare în `CLAUDE.md`, obligând toți agenții să noteze la fiecare commit hash-ul, titlul exact și descrierea narativă extinsă a modificărilor.
  - **Build Word**: Actualizat la `smarald` pe ramura `functionalitati` pentru declanșarea primului preview deployment pe Vercel.

---

### [Commit `e089c70`] — `build: safir - local-first routing, product page and instructions update`
- **Ramură**: `main` (baza pentru ramura `functionalitati`)
- **Data**: 2026-08-16
- **Descriere Detaliată**:
  - **Rută Nouă de Produs (`ProductPage.jsx`)**: S-a creat pagina de vizualizare detaliată a unui produs (`/catalog/product/:nameId`), montată în `App.jsx`.
  - **Navigare Local-First**: În `CategoryPage.jsx`, tap-ul pe un card de produs (`ProductCard`) a fost conectat pentru a naviga direct către `/catalog/product/:nameId` folosind exclusiv starea locală din memorie (Zustand), respectând principiul Single-Fetch fără apeluri de rețea.
  - **Actualizare Instrucțiuni**: Au fost sincronizate regulile de arhitectură Local-First în `CLAUDE.md` și `GEMINI.MD` pentru a preveni interogările inutile către Supabase la schimbarea paginilor.
  - **Build Word**: Generat cuvântul `safir` pentru validarea deployment-ului pe Vercel.

---

### [Commit `9c0eafa`] — `aici incepe contiunare dev onesku cu AG - antigravity dupa ce agent a modificat ceva la supabase reparand auth si salvare in DB a datelor aduagate`
- **Data**: 2026-08-15
- **Descriere Detaliată**:
  - Punctul de tranziție către mediul de dezvoltare Google Antigravity (AG).
  - Verificarea și validarea politicilor RLS și a funcțiilor de salvare/creare produs în Supabase.

---

### [Commit `9444830`] & [`b285da1`] — `Fix picker Tags + BottomBar vizibil sub sheet-uri`
- **Descriere Detaliată**:
  - Rezolvarea problemei de suprapunere în care `PickerSheet` acoperea `BottomBar`-ul. S-a introdus proprietatea `aboveBottomBar` pe componenta `BottomSheet`.
  - Corectarea tratării erorilor în `useCatalogStore.fetchTagVocabulary` (adăugare `try/catch` pentru a preveni blocarea silențioasă a picker-ului la eșec de rețea).
  - Rafinarea afișării câmpurilor `single_choice` (text simplu cu buton de ștergere, diferențiat vizual de chips-urile multi-select de Tags).

---

### [Commit `7068469`] — `Implementează Tags la crearea produsului (SPEC_Tags v1)`
- **Descriere Detaliată**:
  - Implementarea completă a specificației `SPEC_Tags.md`.
  - Adăugarea câmpului de Tags în `ProductFormSheet.jsx` și crearea componentei `PickerSheet.jsx`.
  - Extinderea `useCatalogStore` pentru gestionarea vocabularului derivat de tags din `filter_idx`.

---

*(Notă pentru agent: Adaugă următorul commit deasupra acestei linii)*
