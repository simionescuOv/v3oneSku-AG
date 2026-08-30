# oneSku — Parcursul Dezvoltării & Jurnal Tehnic (`dev-path.md`)

> **REGULĂ OBLIGATORIE PENTRU TOȚI AGENȚII DE COD / VIBECODING:**
> - `git commit` se rulează **EXCLUSIV la cererea expresă a utilizatorului** (ex: „salvează în git”, „fă commit”).
> - La fiecare sarcină măruntă/ajustare, agentul modifică codul și adaugă direct un nou bullet point în secțiunea de sus `### [Commit Pending]` din acest fișier (care funcționează ca draft viu/activ).
> - Când utilizatorul solicită `git commit`:
>   1. Află hash-ul scurt al commit-ului anterior rulând `git rev-parse --short HEAD`.
>   2. Completează hash-ul real pe antetul intrării precedente (ex: `### [Commit 46f21f1] — build: ...`).
>   3. Generează un nou `COMMIT_WORD`, îl actualizează în `src/pages/HomePage.jsx` și finalizează titlul intrării curente.
>   4. Include toate modificările în `git add .` și rulează `git commit` (format: `build: <build_word> | commit: <commit_word> - <mesaj>`).
>   5. Deschide o nouă secțiune `### [Commit Pending]` pentru viitoarele modificări.

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
5. **Import Produse din Fișiere CSV / XLSX (`src/components/catalog/ImportProductsSheet.jsx`, `src/lib/importers/productImporter.js`, `src/lib/attributeTypes.js`)**:
   - Funcționalitate de încărcare/populare categorie cu produse dintr-un fișier local CSV sau XLSX.
   - Registru modular și extensibil de tipuri de date (`src/lib/attributeTypes.js`) pentru atribute (`text`, `single_choice`), reutilizat unitar în `SchemaSheet.jsx` și la import.
   - Mapare automată și manuală a coloanelor: recunoaștere atribute existente, creare atribute noi, extragere automată de opțiuni distincte pentru liste, asociere cu câmpuri speciale de sistem (`Name ID`, `Preț de listă`, `Tags`) cu validare de unicitate.
   - Feedback vizual în timp real, bară de progres și raport final de import.
6. **AppShell & Navigare (`src/components/layout/AppShell.jsx`, `src/components/layout/BottomBar.jsx`)**:
   - Layout mobil optimizat cu `100dvh`.
   - Meniu lateral glisant (`SideMenu.jsx`).
   - `BottomBar` cu auto-hide la scroll în jos și afișare la scroll în sus.
   - Modul `aboveBottomBar` pentru bottom-sheet-uri pentru a menține bara de căutare accesibilă.
7. **Modulul de Filtrare Locală 2 Coloane & Control Date Locale (`src/components/catalog/FilterSheet.jsx`, `src/lib/filterEngine.js`, `src/components/catalog/SchemaSheet.jsx`)**:
   - Modul unificat de filtrare client-side cu 2 coloane stil eMAG (dimensiuni în stânga, valori cu checkbox-uri și contoare live faceted în dreapta).
   - Căutare contextuală per dimensiune executată direct din `BottomBar` (`aboveBottomBar`).
   - Persistență a stării de filtrare în Zustand (`useCatalogStore`), păstrând lista filtrată la navigarea dus-întors în fișa de produs.
   - Control granular al atributelor în Schema Categoriei: configurare `card_preview` (date pre-încărcate local pentru card/offline) și `filterable` (participare în Faceted Search).
   - Titlu dinamic adaptat (reflectă categoria selectată) și adaptare contextuală pe `CatalogPage` și `CategoryPage`.

---

## 3. Jurnalul Commit-urilor (Chronological Log)

Fiecare commit nou trebuie adăugat la începutul acestei liste:

### [Commit Pending]

### [Commit Pending] — build: clepsidra | commit: busuioc - amanare finalizare autocomplete feature
- **Arhitectură Search Context Stack**: S-a implementat stiva de contexte în `useAppStore` pentru a preveni suprapunerea căutărilor (ex: pagina de background să nu mai preia search-ul activ dintr-un BottomSheet). S-a extras logica de predicție în `useAutocompleteGhost.js` și s-a legat de atributele din `BaseFilterSheet.jsx`, curățând instant input-ul la închiderea ferestrei.
- **Ghost Text Autocomplete în BottomBar**: S-a integrat un sistem vizual inteligent de predicție în bara de căutare principală (`BottomBar.jsx`), complet funcțional pentru listele filtrate prin `useBottomSearch` și `usePicker`. Pe lângă modul clasic de completare, când potrivirea este parțială (în interiorul propoziției), textul fantomă este trunchiat la stânga inteligent (păstrând 5 caractere contextuale) și porțiunea potrivită este evidențiată cu albastru. S-a adăugat `autocompleteSuggestion` în `useAppStore.js` pentru managementul stării.

### [Commit 776817d] — build: meteor | commit: pendul - UX global search & Cart filter fix
  - **Bug Fix**: Resetare `searchQuery` global la deschiderea coșului (`CartPage.jsx`) pentru a preveni filtrarea accidentală a listei de produse adăugate anterior.
  - **UX Improv**: S-a eliminat resetarea automată a stării `globalNameIdSearch` la demontarea paginii de Catalog, permițând persistența modului de căutare atunci când utilizatorul navighează către fișa unui produs și se întoarce.
  - **Căutare Globală Produse (NameID) în Catalog**:
    - Extins `useAppStore` cu stare pentru `globalNameIdSearch`.
    - Adăugat buton de comutare dedicat în `BottomBar.jsx` cu iconiță `Package` (doar pe `pathname === '/catalog'`). La activare forțează deschiderea tastaturii.
    - Actualizat `CatalogPage.jsx` pentru a schimba afișajul la `ProductCard` (ce include funcționalitatea nativă de coș) la căutarea produselor și restricționat motorul de căutare exclusiv la valorile `nameId`.

### [Commit 3c5fd7b] — build: meteor | commit: vulcan - cod-bare atribut de sistem la add product
  - **Suport Cod de Bare (Barcode) la nivel de produs**: 
    - Migrație DB (`20260829191000_add_barcode_to_products.sql`) pentru adăugarea coloanei unice `barcode` în tabela `products` și actualizarea RPC-urilor (`create_product`, `create_products_bulk`).
    - Actualizare `useCatalogStore.js` pentru suport `barcode`.
    - UI: Câmp nou de tip numeric pentru cod de bare (EAN-13) în formularul `ProductFormSheet` cu generator integrat (via `src/lib/barcodeGenerator.js`) pentru EAN-13 valabil, inclusiv validarea unicității locale la generare.
    - Vizualizare cod de bare adăugată pe cardurile de produs (`ProductCard`, `SpaceProductCard`) și pagina de detaliu a produsului (`ProductPage`).

### [Commit faa4bc7] — build: meteor | commit: scripete - golire cos
- **Ramură**: `noiFeat`
- **Data**: 2026-08-29
- **Build Word Curent**: `meteor`
- **Descriere Detaliată**:
  - **Protecție Anti-Double-Click / Long-Press la Golire Coș**: În `CartPage.jsx`, s-a adăugat o barieră de tip cooldown de 600ms (`isActionCooldown` + `lastActionTimeRef`), `pointer-events-none` pe durata tranziției și atribute `key` unice (`btn-clear-cart` / `btn-restore-cart`) pentru a forța demontarea nodului DOM din React. Aceasta previne cazurile în care un click prelungit sau două click-uri rapide cu mouse-ul ar fi golit și recuperat imediat coșul în aceeași fracțiune de secundă.
  - **Golire și Recuperare Rapidă Coș (Trash & Undo)**: În `CartPage.jsx`, s-a adăugat o iconiță în dreapta antetului. Când coșul are produse, iconița este `Trash2` și la click golește instantaneu coșul (fără toast, produsele dispar din interfață), salvând un snapshot al stării locale. Imediat după golire, butonul se metamorfozează într-o iconiță de recuperare `RotateCcw` (`text-amber-400`); dacă este apăsat înainte de a părăsi ecranul de coș, restaurează integral produsele și contextul tranzacției prin acțiunea `restoreCart` adăugată în `useCartStore.js`. La părăsirea paginii de coș, snapshot-ul este distrus automat.

### [Commit c2937a5] — build: meteor | commit: termometru - Arhitectură Generic Filter System + div mTask
- **Ramură**: `noiFeat`
- **Data**: 2026-08-28
- **Build Word Curent**: `meteor`
- **Descriere Detaliată**:
  - **Identificare Spațiu în Header-ul Coșului**: În `CartPage.jsx`, titlul paginii a fost modificat din "Coș Tranzacție" în "Coș Tranzacție — [Nume Spațiu]" pentru a oferi vizibilitate clară asupra spațiului sursă din care se face tranzacția. S-a adăugat și trunchiere text (`truncate`) pentru a preveni stricarea layout-ului la nume prea lungi.
  - **Aliniere Meniu StockHub cu Catalog**: În `StockHubPage.jsx`, meniul contextual a fost curățat pentru a semăna exact cu cel din Catalog. Opțiunile "Adaugă Spațiu Nou" și "Adaugă Grup Nou" au fost șterse, deoarece spațiile noi se pot crea direct din bara de căutare (prin butonul +), iar grupurile noi direct în fluxul opțiunii "Organize". Opțiunea a fost redenumită din "Organizează spațiile" în "Organize".
  - **Alternare Comutator Stoc/Flux**: În `SpacePage.jsx`, opțiunile de meniu "Stoc" și "Flux" au fost comasate într-un singur buton cu rol de comutator (toggle). Astfel, când utilizatorul este în vizualizarea "stoc", i se afișează opțiunea de a comuta pe "Flux", și invers.
  - **Arhitectură Generic Filter System**: S-a refactorizat complet modulul de filtrare (`FilterSheet`) pentru a fi **context-aware** și decuplat (Inversion of Control).
  - S-a extras logica de UI generic într-o nouă componentă `BaseFilterSheet.jsx`, care primește configurația prin props (dimensiuni, contoare, selecții) și gestionează afișarea inclusiv căutarea din `BottomBar` (fără să cunoască catalogul).
  - Vechiul `FilterSheet.jsx` a devenit un **Adaptor Contextual** care citește datele din `useCatalogStore` și instanțiază `BaseFilterSheet`. Acesta primește un nou prop `baseProductIds`.
  - În `SpacePage.jsx` s-a calculat setul de produse aparținând strict spațiului (`spaceProductIds`) și s-a trimis către adaptorul de filtrare. Acum, la deschiderea filtrului într-un spațiu (ex: "Doi mag"), titlul arată numărul corect de produse (ex: 5 în loc de tot catalogul), iar categoriile care nu au produse în spațiul respectiv sunt dezactivate și mutate la finalul listei (cu contor 0). Această arhitectură permite pe viitor crearea unui `FluxFilterAdapter` pentru filtrarea tranzacțiilor, refolosind complet `BaseFilterSheet`.
  - **Remediere Loading UI Catalog/Categorie**: S-a adăugat verificarea stării de `loading` (din `useCatalogStore`) în `CatalogPage` și `CategoryPage` pentru a afișa un spinner de încărcare dacă lista de produse/categorii este goală din cauza latenței rețelei, în loc de un mesaj prematur de „Catalog gol”.
  - **Eliminare fetch inutil la navigare**: S-a șters `useEffect`-ul din `CatalogPage` care apela `cleanupTempFolders()` la montare. Acel apel declanșa și un `fetchCatalog()` complet la fiecare accesare a rutei `/catalog`, încălcând principiul de arhitectură Local-First (navigare fără fetch-uri de rețea). Funcția se execută oricum la pornirea aplicației (App mount).

### [Commit `4a5c929`] — `build: meteor | commit: labirint - fix diverse microTask despre navigare, cart si context menu`
- **Ramură**: `noiFeat`
- **Data**: 2026-08-28
- **Build Word Curent**: `meteor`
- **Descriere Detaliată**:
  - **Microtask**: Am deblocat ecranul `SpacePage` scoțând funcția `fetchAlerts()` din bariera `Promise.all`. Funcția de preluare a alertelor rulează acum asincron în fundal, ceea ce restabilește încărcarea instantanee (sub 200ms) a paginii, fără să mai aștepte zeci de secunde după query-ul bazei de date. Alertele se injectează în flux de îndată ce ajung pe rețea.
  - **Microtask**: Am actualizat `GEMINI.md` prin adăugarea regulii arhitecturale `ARCH_ProductNavigation`, care dictează obligativitatea transmiterii `sourceSpaceId` în state-ul rutei la orice navigare către `ProductPage` dintr-un context specific, pentru a garanta trasabilitatea corectă a sursei în coșul de tranzacții.
  - **Microtask**: Am corectat comportamentul prin care un produs accesat dintr-un Spațiu își pierdea sursa de origine când era adăugat în coș din pagina sa de detalii (`ProductPage`). S-a folosit mecanismul de `state` invizibil din React Router (`routerNavigate` cu `{ state: { sourceSpaceId } }` în `SpacePage`), iar `ProductPage` recuperează acest ID folosind `useLocation` și îl trimite la adăugarea în coș, prevenind asertarea falsă că produsul ar veni din Catalog.
  - **Microtask**: Am actualizat componenta `FluxFeed.jsx` pentru a centra vizual întregul flux de tranzacții pe mijlocul ecranului la rezoluții mari (`max-w-2xl mx-auto`), prevenind distanțarea inestetică a bulelor de chat la extremele ecranului, păstrând aspectul fluid de 100% lățime pe telefoane. De asemenea, s-au introdus alertele de stoc negativ (`stock_alerts`) în interiorul `FluxFeed`, afișându-se ca mini-carduri cronologice de avertisment (`AlertBlock`) intercalate în listă, forțând sortarea astfel încât alerta să apară întotdeauna imediat *sub* tranzacția care a provocat-o. `SpacePage.jsx` pasează acum `spaceAlerts` spre feed.
  - **Microtask**: Am modificat funcția `addItem` din `src/store/useCartStore.js` pentru a fixa bug-ul care bloca sursa tranzacției pe `Catalog` de îndată ce adăugai un produs. Acum sursa se blochează doar dacă produsul a fost adăugat direct din `StockHub`. De asemenea, s-a ajustat validarea pentru a permite adăugarea de produse din Catalog, chiar dacă utilizatorul a setat manual un alt Spațiu ca Sursă în coș.
  - **Microtask**: Am actualizat `GEMINI.md` pentru a impune strictețea absolută a modului de planificare ("DEFAULT LA PLANIFICARE") și am stabilit regula obligatorie ca permisiunea de a scrie cod să fie acordată exclusiv când prompt-ul începe cu cuvântul `exe`.
  - **Microtask**: S-a implementat interceptarea nativă a butonului/gestului sistem de „Înapoi” (Back) pe telefoanele mobile (Android) folosind tehnica de `window.history.pushState` în interiorul componentei unificate `BottomSheet.jsx`. Acum, gestul Back închide curat orice Sheet deschis fără să schimbe pagina curentă.
  - **Microtask**: Am decuplat `CartPage` din React Router. Coșul nu mai are URL (`/cart`), fiind randat condiționat ca o pagină virtuală deasupra `MainContent` controlată de Zustand (`cartOpen`). Aceasta previne poluarea istoricului browserului, menține funcționalitatea Picker-ului (prin lăsarea `BottomBar` la vedere) și permite butonului/gestului Back să închidă Coșul corect.
  - **Microtask**: S-a reparat bug-ul de React 18 Strict Mode care cauza închiderea imediată a coșului și sheet-urilor. Metoda de curățare din `useEffect` a fost eliminată; acum `window.history.back()` se apelează fie condus de evenimentele din UI (buton X/săgeată), fie strict legat de schimbările de stare ale prop-ului `open` (în `BottomSheet`), prevenind decuplarea de către rutele duble din Strict Mode.
  - **Microtask**: S-a introdus un contor global `window.__activeSheets` în `BottomSheet.jsx` și un mic delay (`setTimeout`) pentru a gestiona corect tranzițiile simultane (ex. închiderea meniului contextual + deschiderea filtrului). Aceasta previne anularea reciprocă a comenzilor de `back()` și `pushState()` și rezolvă bug-ul care cauza navigarea nedorită în istoric. De asemenea, `prevOpen` a fost inițializat cu `false` pentru a captura corect prima randare condiționată.
  - **Microtask**: Am extras o componentă unificată `ContextMenu.jsx` (bazată pe `BottomSheet`) pentru a standardiza vizual și funcțional toate meniurile contextuale din aplicație (Catalog, Category, Cart, Space, StockHub), cu suport pentru stări active, badge-uri și culori personalizate.
  - **Microtask**: S-a adăugat suport în `useAppStore.js` (`bottomBarOverrides`) și `BottomBar.jsx` pentru a suprascrie dinamic funcționalitatea butonului de meniu. Acum, când se deschide un `BottomSheet` cu `aboveBottomBar={true}` (ex: `FilterSheet`), butonul de meniu devine automat un \"X\" roșu care închide direct acel sheet, în loc să deschidă greșit meniul de context pe sub el.
  - **Microtask**: S-a rescris complet logica de history din `BottomSheet.jsx` — înlocuit contorul global partajat (`__activeSheets`) cu un **Sheet Stack Manager** (`window.__sheetStack`) de tip LIFO. Fiecare instanță de `BottomSheet` primește propria intrare `pushState` cu ID unic, iar un singur listener global de `popstate` face dispatch doar către sheet-ul din vârful stivei. Aceasta rezolvă bug-ul în care gestul Back, din sheet-uri imbricate sau secvențiale, naviga eronat în URL (ex: `SchemaSheet → „Atribut nou" → Back` trimitea pe pagina anterioară în loc de lista de atribute).
  - **Microtask**: Adăugat prop `onBackIntercept` pe `BottomSheet`. Dacă funcția returnează `true`, Back-ul gestionează navigarea internă (sub-view-uri) fără să închidă sheet-ul, re-pushând intrarea de history. Implementat în `SchemaSheet.jsx` (stack: list → add/edit → options) și `ImportProductsSheet.jsx` (wizard: upload → mapping → progress → result), inclusiv blocarea Back-ului în step-ul `progress` (import în curs).
  - **Microtask**: S-a remediat o eroare de reactie în buclă infinită (`Maximum update depth exceeded`) apărută la deschiderea picker-ului de destinație din `CartPage`. Problema apărea pentru că `onClose` din `CartPage` și `bottomBarMenu` erau instanțiate la fiecare randare și pasate ca dependențe în `useEffect`-ul din `BottomSheet.jsx` responsabil cu `pushBottomBarOverride`, cauzând un loop infinit de update-uri pe store-ul Zustand. S-a înlocuit cu utilizarea de refs pentru a rupe bucla.
  - **Microtask**: S-a remediat eroarea `Rules of Hooks` (număr diferit de apeluri hooks între randări) din `SchemaSheet` și `ImportProductsSheet`, mutând instanțierea cu `useCallback` a `handleBackIntercept` înaintea oricărui `return null` (`if (!open) return null`).
  - **Microtask**: Am întărit Regulile 2 și 4 din `GEMINI.md`. Acum regula impune declararea explicită a stării la începutul fiecărui mesaj (MOD: EXECUȚIE sau MOD: PLANIFICARE) pentru ancorarea contextului. De asemenea, s-a interzis explicit în textul regulii apelarea tool-urilor `replace_file_content`, `write_to_file` și `run_command` în absența keyword-ului `exe`.
  - **Microtask**: S-a reparat eroarea `Uncaught ReferenceError: FolderPlus is not defined` apărută la accesarea meniului contextual din `StockHubPage`, adăugând componenta lipsă în lista de importuri din `lucide-react`.

### [Commit `Pending`] — `build: meteor | commit: orbita - actualizare build word pentru push`
- **Ramură**: `noiFeat`
- **Data**: 2026-08-25
- **Build Word Curent**: `meteor`
- **Descriere Detaliată**:
  - **Actualizare BUILD_WORD**: S-a generat cuvântul „meteor” conform protocolului de push, pentru marcarea și validarea noii versiuni pe Vercel.

### [Commit `a1d8e33`] — `build: fagure | commit: telescop - stockhub primele modificari`
- **Ramură**: `noiFeat`
- **Data**: 2026-08-25
- **Build Word Curent**: `fagure`
- **Descriere Detaliată**:
  - **Microtask**: *Ascunderea butonului plutitor de coș pe pagina `/cart`*.
    - S-a modificat `AppShell.jsx` pentru a ascunde global butonul plutitor de coș (Floating Action Button) atunci când utilizatorul se află pe ruta `/cart` (`location.pathname !== '/cart'`), deoarece pe această pagină butonul era redundant. S-a folosit hook-ul `useLocation` din `react-router-dom`.
  - **Microtask**: *Deschiderea implicită a meniului lateral pe HomePage*.
    - S-a modificat componenta `HomePage.jsx` adăugând un efect (`useEffect`) care apelează automat `openSideMenu` din `useAppStore` la montare. Astfel, când utilizatorul revine pe pagina Home din alte secțiuni (ex. Catalog), meniul principal este afișat automat, reducând numărul de acțiuni necesare pentru navigare (ex. spre StockHub).
  - **Microtask**: *Implementare Pagina unui Space (Stoc + Flux) și fix calcul tranzacții*.
    - S-a creat `SpacePage.jsx` cu navigare pe baza rutei `/stockhub/space/:spaceId`.
    - Integrare completă cu `BottomBar` pentru căutare și meniu contextual (tab-uri Stoc / Flux acționate din meniu).
    - S-au adăugat componentele vizuale `SpaceProductCard.jsx` (stoc proeminent, design adaptabil) și `FluxFeed.jsx` (feed tranzacții cu blocuri duale Intrare/Ieșire și headers zilnice sticky).
    - Componenta `FluxFeed` folosește o convenție pură UX: afișează strict **valoarea absolută** a cantității (fără negații duble "Ieșire: -1").
    - S-au adăugat query-uri noi în `useStockStore.js`: `fetchSpaceProducts` (date agregate din `space_products` + `products`) și `fetchSpaceTransactions` (inbound și outbound agregate pe zi).
    - **[BUGFIX]**: Corectat operatorul din migrația `20260820180000_rpc_commit_cart.sql` (linia de update sursă a provocat creșterea stocului în loc de scădere din cauza inserării inițiale negative). Corectura folosește `stock = stock - v_quantity`. Creat fișier de migrație aplicabil pe server `20260825192000_fix_rpc_commit_cart.sql`.
  - **Microtask**: *Impunere regulă de proveniență a produselor din coș în funcție de sursă*.
    - S-a modificat `useCartStore.js` adăugând `sourceLocked` pentru a lega strict coșul de spațiul (sau catalogul) de unde a fost adăugat primul produs, blocând adăugarea din surse externe.
    - S-a adaptat `CartPage.jsx` pentru a reflecta vizual starea de „BLOCAT” pe butonul de sursă.
    - S-a modificat `SpaceProductCard.jsx` și `SpacePage.jsx` pentru a pasa explicit `sourceId` la adăugarea în coș.

### [Commit `7bde136`] — `build: fagure | commit: far - grupare mobila pe categorii in cos + tree analitic modal`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-24
- **Build Word Curent**: `fagure`
- **Descriere Detaliată**:
  - **Arhitectură Mobile-First pentru Coș (`CartPage.jsx` & `useAppStore.js`)**:
    - **Vizualizare Principală (Operațională)**: S-a adăugat posibilitatea de a comuta între „Listă Simplă” și „Grupare pe Categorii” direct din meniul coșului (stare globală `cartGroupByCategory`). Gruparea se face brut (doar categorii, flat) pentru a menține ecranul neaglomerat, ideal pentru telefoane. Butoanele de cantitate și ștergere rămân pe deplin funcționale.
    - **Dialog Analitic „Tree” (BottomSheet)**: Structura ierarhică completă (Foldere -> Categorii -> Produse) a fost extrasă într-un modal Read-Only dedicat (85% ecran). Calculele costisitoare de ierarhie (`buildSearchTree`) sunt acum *lazy-evaluated* doar când acest modal este deschis, mărind performanța. Bara globală de căutare rămâne vizibilă și funcționează perfect ca filtru live.
    - **Meniu de Context Inteligent**: Dacă utilizatorul deschide meniul din BottomBar în timp ce se află în Tree și apasă o opțiune de acțiune operațională, modalul Tree se închide automat pentru o experiență fluidă și neîntreruptă.

### [Commit `411674b`] — `build: fagure | commit: valiza - arhitectura cautare unificata BottomBar + fix CatalogPage filtru activ`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-24
- **Build Word Curent**: `fagure`
- **Descriere Detaliată**:
  - **[NOU] Hook `useBottomSearch` (`src/hooks/useBottomSearch.js`)**:
    - Introdus ca **contract arhitectural** (ARCH_BottomSearch): orice pagină/componentă care afișează o listă scrollabilă cu BottomBar vizibil TREBUIE să treacă lista prin `useBottomSearch` sau `usePicker`.
    - Filtru pur și transparent: dacă `searchQuery` e gol returnează referința originală (zero re-render); dacă nu, aplică `filterAndSort` (motorul canonic din `lib/search`).
    - Parametru `enabled` pentru dezactivare explicită în contexte care nu necesită căutare.
    - Documentat cu extension point `ARCH_SearchableAttrs` pentru funcționalitatea viitoare de atribute căutabile per-categorie.
  - **[FIX] Bug `CatalogPage.jsx` — căutarea nu funcționa pe lista „Rezultate filtrare"**:
    - Cauza: `filteredProducts` (useMemo) filtra doar după `filteredProductIds.has(p.id)`, ignorând complet `searchQuery`.
    - Rezolvare: separarea în 2 pași — (1) filtrul persistent din `FilterSheet` → `filteredProducts`; (2) căutarea live din BottomBar → `visibleFilteredProducts` via `useBottomSearch`.
    - `labelFn` caută în `nameId + numeCătegorie + tags` (intenționat fără valorile de atribute — în context global Catalog nu există schemă per-categorie).
    - Mesaj empty state diferențiat: „Niciun produs nu corespunde filtrelor selectate" vs. „Niciun produs nu corespunde căutării".
  - **[UX] Placeholder contextual `CatalogPage.jsx`**:
    - Când filtrul e activ, placeholder-ul BottomBar devine `'Caută în rezultate...'` (anterior static indiferent de context).
  - **[DOC] `GEMINI.MD` — secțiuni arhitecturale noi**:
    - `ARCH_BottomSearch`: convenția + tabelul stării curente per context.
    - `ARCH_SearchableAttrs`: planul în 3 pași pentru funcționalitatea viitoare „atribute căutabile per-categorie" — documentat, NU implementat.

### [Commit `671105b`] — `build: fagure | commit: pian - actualizare build word pentru push`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-24
- **Build Word Curent**: `fagure`
- **Descriere Detaliată**:
  - **Actualizare BUILD_WORD**: S-a generat cuvântul „fagure” conform protocolului de push, pentru marcarea și validarea noii versiuni pe Vercel.

### [Commit `168cd7f`] — `build: busola | commit: clepsidra - 6 microtasks`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-24
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Tranziție la Workflow cu Commit-uri la Cerere & Draft Live în `dev-path.md`**:
    - *Cerință*: Reducerea frecvenței de commit-uri pentru a permite rezolvarea rapidă a sarcinilor mărunte cu verificare în browser, fără commit automat la fiecare pas și fără fișiere auxiliare temporare.
    - *Rezolvare*: S-a stabilit ca `dev-path.md` să fie spațiul unic de jurnalizare continuă (secțiunea `[Commit Pending]` acumulează direct fiecare micro-sarcină), iar `git commit` se execută strict la solicitarea expresă a utilizatorului („salvează în git” / „fă commit”). Regulile au fost consemnate în `GEMINI.MD` (Regula 9), `CLAUDE.md` și `docs/dev-path.md`.
  - **Îmbunătățire Vizibilitate Element Activ (Verde în loc de Galben)**:
    - S-a modificat culoarea de evidențiere a elementului activ (folder, categorie, produs etc.) din galben (`text-amber-400`) în verde (`text-green-400`).
    - Schimbarea a fost aplicată atât pe ultimul element din breadcrumb (calea din antet), cât și în arborele de navigare (folosit în modul Unfold), pentru o diferențiere vizuală mult mai clară față de restul elementelor alb-gri.
  - **Insignă Cantitate Coș pe Cardul Produsului (`ProductCard.jsx`)**:
    - S-a implementat afișarea unei insigne (badge) roșii direct pe butonul de coș al fiecărui produs, care arată câte unități din acel produs sunt deja în coș.
    - Optimizare de performanță: S-a folosit un selector fin de stare (Zustand) care returnează doar cantitatea produsului curent, astfel încât doar cardul afectat se va re-randa la modificarea coșului, evitând penalizările de performanță pe liste lungi.
  - **Îmbunătățire a Mecanismului de Căutare (`search.js`)**:
    - S-a modificat funcția de despărțire a textului în cuvinte-cheie (`split`). Acum, liniuța (`-`) este considerată un separator de cuvânt, la fel ca spațiul (`split(/[\s-]+/)`).
    - Acest lucru permite găsirea cu ușurință a elementelor compuse, cum ar fi un produs denumit „name-id”, căutând doar „id” (sau „name”).
  - **Meniu Contextual și Mod de Ștergere pentru Coș (`CartPage.jsx`, `BottomBar.jsx`)**:
    - S-a configurat butonul de meniu din bara de jos (BottomBar) să deschidă un meniu contextual dedicat paginii Coș atunci când este apăsat pe această pagină, în loc de meniul lateral al sistemului.
    - Butoanele de ștergere a elementelor din coș au fost ascunse implicit pentru a preveni ștergerile accidentale și pentru a curăța interfața.
    - S-a adăugat opțiunea „Șterge elemente...” în meniul contextual, care activează un mod de ștergere (`deleteMode`). Când acesta este activ, butoanele roșii de ștergere sunt afișate lângă fiecare produs din listă.
  - **Rezolvare Suprapunere Butoane Flotante (FAB)**:
    - Butoanele de acțiune `+` (Adăugare element) din paginile principale (`CatalogPage`, `CategoryPage`, `StockHubPage`) au fost ajustate pentru a preveni suprapunerea peste butonul global de Coș în momentul căutării.
    - S-a implementat stivuirea verticală (Vertical Stacking): butonul `+` ascultă dinamic starea coșului și, dacă există elemente în el, se ridică automat pe ecran (la `9rem` de la bază) pentru a face loc vizual butonului de Coș aflat dedesubt.
### [Commit `4e8a81e`] — `build: busola | commit: orizont - actualizare protocol dev-path cu mecanism in cascada N-1 pentru hash-uri`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-23
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Mecanism în Cascadă N-1 pentru Hash-uri**: S-a adoptat protocolul prin care fiecare commit nou completează retroactiv hash-ul Git exact al commit-ului precedent (`git rev-parse --short HEAD`), lăsând doar commit-ul în curs marcat `Pending`.
  - **Sincronizare Istoric (Backfill)**: Toate intrările istorice din `docs/dev-path.md` au fost actualizate cu hash-urile lor reale din `git log`.
  - **Actualizare Instrucțiuni**: Regulile au fost consemnate unitar în `docs/dev-path.md`, `GEMINI.MD` (Regula 9) și `CLAUDE.md`.
  - **Actualizare Commit Word**: `COMMIT_WORD` setat la `orizont` în `HomePage.jsx`.

### [Commit `46f21f1`] — `build: busola - fix cart search, bottomsheet display and update button text`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-23
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Reparare filtrare produse în Cart**: `CartPage` aplică acum corect `filterAndSort` (folosind `searchQuery` din store) peste `items` atunci când nu este deschis picker-ul de Sursă/Destinație.
  - **Vizibilitate BottomBar la selecție**: S-a adăugat proprietatea `aboveBottomBar={true}` pe `BottomSheet` în `CartPage` pentru ca bara de căutare să nu mai fie acoperită.
  - **Modificare text buton checkout**: Butonul de confirmare arată acum totalul produselor („Confirmă tranzacția cu X bucăți”), bazat pe numărul de unități (`totalItems`).

### [Commit `3e4137b`] — `build: aurora - organizare stockhub pe foldere, breadcrumbs si extragere ierarhie reutilizabila`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-20
- **Build Word Curent**: `aurora`
- **Descriere Detaliată**:
  - Am adăugat suport complet pentru foldere în `StockHub`.
  - Migrare SQL (`20260820191500_stockhub_hierarchy.sql`) care adaugă `type`, `parent_id` și `position` pe tabela `spaces` (cu verificări stricte de consistență în DB).
  - Extras componentele `FullTree` și `SearchGroup` din `CatalogPage` în componenta partajată `HierarchyTree.jsx` (rezolvând principiul DRY).
  - Reparat bug-ul de UI (linia 139) astfel încât click-ul pe o categorie (sau spațiu) în modul `Unfold` declanșează navigarea normală (în loc de un no-op).
  - Modificat `StockHubPage` să integreze vizualizarea de Foldere, Navigarea (breadcrumbs cu ArrowLeft) și logica completă de Organizare (Mutare, Grupare).
  - Adaptat store-ul `useStockStore.js` pentru a gestiona metodele de calcul hibride pentru navigație (`getChildren`, `getBreadcrumb`) și update-uri de mutare (`moveNodes`, `groupNodes`).

---

### [Commit `01b8da9`] — `build: aurora - conversie cart din overlay in pagina, integrare picker v2 standalone`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-20
- **Build Word Curent**: `aurora`
- **Descriere Detaliată**:
  - S-a eliminat componenta de overlay `CartOverlay` și a fost transformată într-o rută normală (pagină) accesibilă la `/cart` (`CartPage`).
  - Navigarea către `/cart` se face din FAB-ul global, refolosind layout-ul `AppShell` (deci BottomBar-ul global rămâne vizibil).
  - Au fost șterse elementele native HTML `<select>` pentru Sursă și Destinație, fiind înlocuite cu un mecanism de selecție `Picker v2`.
  - La apăsarea Sursă/Destinație se deschide un `BottomSheet` deasupra formularului, iar căutarea este legată automat (prin mod `inline` din `usePicker`) de `BottomBar`-ul global.
  - S-au eliminat variabilele globale `isOpen` și funcțiile `openCart`/`closeCart` din `useCartStore`.

---

### [Commit `5c41ec4`] — `build: aurora - stockhub UX aliniat cu catalogpage (empty state, creare space, meniu contextual)`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-20
- **Build Word Curent**: `aurora`
- **Descriere Detaliată**:
  - Aliniere UX `StockHubPage` cu comportamentul consacrat din `CatalogPage` conform specificațiilor Picker v2 (`SPEC_Picker_v2.md`).
  - Adăugare suport pentru vizualizarea stării „Gol” cu instrucțiuni specifice de creare.
  - Implementarea logicii de căutare a spațiilor și crearea unuia nou din `BottomBar` via `usePicker` (mod `inline`) și noul action `createSpace` din store.
  - S-a introdus un meniu contextual dedicat `StockHub`, apelat prin iconița `Warehouse` din bara de navigare, conținând acțiunea placeholder „Organizează spațiile”.

---

### [Commit `fc288b9`] — `build: aurora - cos de tranzactie functional si integrare stockhub cu date reale`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-20
- **Build Word Curent**: `aurora`
- **Descriere Detaliată**:
  - **Migrație Bază de Date (`20260820180000_rpc_commit_cart.sql`)**: Creare tabel `stock_alerts`, creare view `spaces_summary` și implementare funcție atomică RPC `commit_cart` pentru procesarea transferurilor de stoc între catalog și spații.
  - **StockHub & Date Reale (`useStockStore.js`, `StockHubPage.jsx`)**: Integrare store cu Supabase. `StockHubPage` afișează acum date live, folosește un efect de încărcare skeleton și prezintă alerte expandabile inline pentru produse cu stoc negativ (opțiunea C de UX confirmată).
  - **Proces de Checkout Real (`CartOverlay.jsx`)**: Suprapunerea coșului preia dinamic sursa și destinația din `useStockStore`, procesează tranzacția async și afișează starea cu spinner și notificări clare prin toast.
  - **Integrare Adaugă în Coș (`ProductPage.jsx`, `App.jsx`)**: Adăugat buton „Adaugă în coș” în meniul contextual din pagina produsului. `App.jsx` declanșează preîncărcarea spațiilor (`fetchSpaces()`) la inițializarea utilizatorului.

---

### [Commit `01c398e`] — `build: aurora - modul filtrare locala 2 coloane, persistenta stare si control date schema`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-18
- **Build Word Curent**: `aurora`
- **Descriere Detaliată**:
  - **Modul de Filtrare 2 Coloane stil eMAG (`FilterSheet.jsx`)**: Coloana stângă afișează dimensiunile (Categorie, Tags, Atribute de categorie), iar coloana dreaptă afișează valorile cu checkbox-uri și contoare live faceted `(N)` calculate pe baza indexurilor inversate `filter_idx` din Postgres.
  - **Căutare Unificată din BottomBar**: S-a integrat căutarea din `BottomBar` pentru filtrarea opțiunilor din coloana dreaptă, dialogul stând deasupra barei de jos (`aboveBottomBar={true}`).
  - **Persistență Stare Filtre în Store (`useCatalogStore.js`)**: S-a rezolvat pierderea listei filtrate la revenirea din fișa produsului. Starea filtrelor și produsele filtrate sunt păstrate în Zustand până la resetarea explicită de către utilizator.
  - **Schema Categoriei & Control Date (`SchemaSheet.jsx` & Migrație SQL `20260818210000_category_attributes_card_preview.sql`)**: Utilizatorul poate seta pentru fiecare atribut dacă se pre-încarcă local pe card (`cardPreview`) și dacă e filtrabil (`filterable`).
  - **Actualizare Build Word (`HomePage.jsx`)**: Setat la `aurora` pentru validarea deploy-ului în Vercel.

---

### [Commit `8ef256f`] — `build: castor - update build word for vercel deployment and push`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `castor`
- **Descriere Detaliată**:
  - **Generare Nou Build Word (`HomePage.jsx`)**: S-a actualizat cuvântul de build la `castor` (domeniu distinct: zoologie/faună) conform protocolului de `git push` pentru validarea versiunii deployed pe Vercel.
  - **Pregătire și Execuție Push**: Toate funcționalitățile de import produse CSV/XLSX, registrul de tipuri de date, optimizarea bulk de înaltă performanță și migrarea RPC asociată sunt transmise către remote.

---

### [Commit `e3fe608`] — `build: busola - optimizare bulk import produse pentru viteza instantanee`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Eliminare Cascade de Cereri de Rețea (Single Network Call)**: A fost rezolvată problema duratei mari de execuție (de la sute de secunde la 1-2 secunde). S-a eliminat apelul recursiv de `fetchCatalog()` executat după fiecare produs individual din buclă.
  - **Migrare & RPC Atomic Bulk (`supabase/migrations/20260817205000_rpc_bulk_import_products.sql`)**: S-a creat funcția RPC `create_products_bulk(p_category_id, p_products)` care procesează și inserează un întreg lot de produse într-o singură tranzacție Postgres, populând atomar atributele, tag-urile, prețul și generând NameID-uri garantat unice.
  - **Metodă Store Optimizată (`useCatalogStore.js` -> `addProductsBulk`)**: Adăugată metoda de inserare în masă cu fallback automat pe loturi (batch) și refetch unic garantat la finalul întregului import.
  - **Pregătire Date în Memorie (`productImporter.js`)**: Toate produsele din fișier sunt mapate și validate sincron în memorie înainte de trimiterea într-un singur payload către baza de date.

---

### [Commit `4ea1bfd`] — `build: busola - import date user - implementare functionalitate`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Opțiune „Încarcă produse” în Meniul Contextual al Categoriei (`CategoryPage.jsx`)**: S-a adăugat opțiunea de import cu iconiță dedicată `Upload` în meniul contextual (`catalogMenuOpen`), deschizând sheet-ul de import.
  - **Registru Centralizat și Extensibil de Tipuri de Date (`src/lib/attributeTypes.js`)**: S-au decuplat definițiile tipurilor de date (`text`, `single_choice`) într-un modul unic extensibil pentru viitoare tipuri (number, boolean, date, etc.). `SchemaSheet.jsx` a fost refactorizat să consume dinamic acest registru.
  - **Parsare Fișiere CSV / XLSX Client-Side (`src/lib/excel.js`)**: Funcția `parseFileForImport` extrage anteturile și matricea de rânduri cu suport complet pentru caractere speciale, diacritice și celule goale.
  - **Motor de Validare și Import Produse (`src/lib/importers/productImporter.js`)**: Gestionează întreg ciclul de viață al importului: auto-detecția tipurilor sugerate, validarea unicității `Name ID` (intra-fișier și față de catalogul DB/local), crearea automată a atributelor lipsă, popularea opțiunilor unice de listă (`single_choice`), generarea de NameID-uri unice pentru rânduri fără identificator explicit și persistența produselor.
  - **Interfață Utilizator Multi-Step (`src/components/catalog/ImportProductsSheet.jsx`)**: Sheet modern cu pași ghidați: Încărcare fișier $\rightarrow$ Configurare destinație/tip coloană $\rightarrow$ Bară de progres animată $\rightarrow$ Raport de final cu număr de produse create, atribute/opțiuni adăugate și listă detaliată a rândurilor omise/erori.

---

### [Commit `c181282`] — `build: busola - sort category products newest first`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Sortare Produse Nou Adăugate la Începutul Listei**: Produsele din pagina categoriei sunt acum sortate descrescător după data adăugării (`created_at DESC`), astfel încât ultimele produse create apar direct în capul listei.
  - **Mapare & Query**: S-a mapat câmpul `createdAt` în `mapProduct` din `useCatalogStore.js`, s-a adăugat ordonarea descrescătoare la `fetchCatalog` și s-a aplicat sortarea în `CategoryPage.jsx` și `getProductsByCategory`.

---

### [Commit `40d89ad`] — `build: busola - fix nameid and form state reset on picker swap`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Păstrare Stare Formular la Deschiderea Picker-ului**: S-a remediat comportamentul prin care deschiderea unui picker de atribut (swap) reseta starea din `ProductFormSheet` și schimba `Name ID` din cauza modificării parametrului de căutare din `BottomBar`.
  - **Inițializare Ancorată pe Tranziția `open`**: Resetarea și inițializarea formularului se declanșează strict la deschiderea/închiderea reală a sheet-ului (`open === true && !prevOpenRef.current`), menținând Name ID-ul și toate atributele completate intacte pe durata întregii sesiuni de completare.

---

### [Commit `5395a74`] — `build: busola - switch nameid generator to client-side local-first`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Trecere la Generare Client-Side (100% Local-First)**: S-a creat utilitarul `src/lib/nameIdGenerator.js` cu dicționar de cuvinte și algoritm de selecție aleatorie garantat unic față de lista locală de produse din Zustand (`useCatalogStore`).
  - **Rezolvare Eroare 404 & 0 ms Latență**: La apăsarea butonului de zaruri din formularul de adăugare produs (`ProductFormSheet`), generarea se execută instantaneu sincron pe client, fără niciun apel HTTP/RPC, eliminând dependența de rețea și erorile 404.
  - **Validare Disponibilitate în Formular**: Formularul verifică unicitatea locală a oricărui Name ID introdus manual înainte de trimiterea spre salvare.

---

### [Commit `76422fb`] — `build: busola - nameid acum poate fi setat de user`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Setare Name ID de către utilizator la crearea produsului**: La deschiderea formularului de adăugare produs (`ProductFormSheet`), Name ID este afișat ca prim câmp și este inițializat automat cu termenul tastat de utilizator în bara de căutare din `BottomBar` (`initialNameId`).
  - **Buton de generare aleatorie la cerere**: Lângă câmpul Name ID s-a adăugat un buton dedicat (`Dices` / „Aleatoriu”) care apelează generatorul existent `generate_name_id()` din baza de date via RPC, permițând utilizatorului să genereze instantaneu un identificator aleatoriu dacă dorește.
  - **Eliminarea antetului de dialog**: S-a eliminat titlul `<h2>` din partea de sus a formularului `ProductFormSheet`, primul element vizibil fiind direct câmpul `Name ID`.
  - **Imuabilitate la editare**: La editarea unui produs existent (`isEdit: true`), câmpul `Name ID` rămâne primul în formular, dar în stare complet blocată / read-only (`imuabil`), neputând fi modificat după salvarea inițială.
  - **Actualizare RPC & Store**: S-a creat migrarea `20260817180500_rpc_name_id_enhancements.sql` care expune `generate_name_id()` ca RPC de sesiune și actualizează `create_product` pentru a accepta parametrul opțional `p_name_id`. În `useCatalogStore.js` s-au conectat metodele `generateRandomNameId` și `addProduct` cu suport pentru `nameId`.

---

### [Commit `b8ffa1b`] — `build: busola - enforce build word in git commit message title`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Includere Build Word în Mesajul Git Commit**: S-a stabilit obligativitatea ca mesajul/titlul oricărui commit din Git să conțină direct cuvântul de build curent (format: `build: <build_word> - <mesaj>` sau `[<build_word>] <mesaj>`), astfel încât versiunea de build să fie vizibilă direct în interfața GitHub la nivelul fiecărui commit. Regula a fost salvată în `GEMINI.MD`, `CLAUDE.md` și `docs/dev-path.md`.

---

### [Commit `fa2768e`] — `docs: add current build word to dev-path logging instructions`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Identificator Build per Commit**: S-a adăugat obligativitatea de a include câmpul `Build Word Curent` în fiecare înregistrare din `docs/dev-path.md`, `GEMINI.MD` și `CLAUDE.md`, pentru a identifica precis cărui ciclu de build îi aparține fiecare commit (chiar dacă cuvântul nu se schimbă la fiecare commit individual).

---

### [Commit `cbaad8b`] — `docs: update build-word and push protocol guidelines`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Protocol Push la Cerere**: `git push` se va executa doar când este cerut expres de utilizator (nu automat după fiecare commit).
  - **Rafinare Protocol Build Word**: Cuvintele de build se vor genera la momentul comenzii de push, fiind interzisă repetarea aceleiași tematici (ex: pietre prețioase). Cuvintele consecutive vor proveni din domenii complet nelegate (obiecte, animale, fenomene, instrumente).
  - **Actualizare Instrucțiuni**: Reguli actualizate în `GEMINI.MD`, `CLAUDE.md` și `HomePage.jsx` (`busola`).

---

### [Commit `407c127`] — `docs: enforce pre-commit dev-path update protocol in single commit`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Build Word Curent**: `smarald`
- **Descriere Detaliată**:
  - **Protocol Unificat de Commit**: S-au actualizat fișierele `GEMINI.MD`, `CLAUDE.md` și `docs/dev-path.md` pentru a impune actualizarea jurnalului `dev-path.md` pre-commit, astfel încât modificările de cod și înregistrarea de documentație să fie incluse într-un singur commit unitar.

---

### [Commit `988dcec`] — `editare produs`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Build Word Curent**: `smarald`
- **Descriere Detaliată**:
  - **Componentă Unică Formular (`ProductFormSheet.jsx`)**: S-a extins componenta pentru a funcționa în mod dual (atât pentru adăugare cât și pentru editare de produs). Prepopulează atributele, tag-urile și prețul existent la primirea prop-ului `product`, adaptează titlul și butonul de salvare și previne resetarea eronată a picker-urilor prin separarea efectelor de inițializare a stării de sincronizarea `BottomBar`-ului.
  - **Persistență în Store (`useCatalogStore.js`)**: S-a adăugat metoda `updateProduct(productId, attributes, listPrice, tags)` care actualizează direct tabela `products` din Supabase (cu suport RLS și trigger-e automate de rebuild pentru `filter_idx`) și resincronizează datele din starea Zustand locală.
  - **Icon & Meniu Contextual Pagină Produs (`BottomBar.jsx` & `ProductPage.jsx`)**: În bara de navigare inferioară, pe ruta `/catalog/product/:nameId`, icon-ul s-a schimbat în `Package`. La apăsare, se deschide meniul contextual al produsului ce conține opțiunea „Editează produsul” (cu icon `Pencil`), conectată la dialogul de editare și notificări Toast.
  - **Specificație Formular Secvențial (`docs/specs/SPEC_FormSecventialProdus.md`)**: A fost creată specificația completă de arhitectură UX pentru viitoarea implementare a introducerii de date pas cu pas (Stepper / Wizard) unificat pentru ambele operațiuni.

---

### [Commit `427fc8d`] — `build: smarald - add dev-path documentation and mandatory agent logging protocol`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-16
- **Build Word Curent**: `smarald`
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
