# oneSku — Parcursul Dezvoltării & Jurnal Tehnic (`dev-path.md`)

> **REGULĂ OBLIGATORIE PENTRU TOȚI AGENȚII DE COD / VIBECODING:**
> **ÎNAINTE de a rula comanda `git commit`**, actualizați OBLIGATORIU acest fișier și includeți-l în `git add` împreună cu restul fișierelor, astfel încât modificările de cod și înregistrarea din jurnal să fie salvate **ÎNTR-UN SINGUR COMMIT unitar** (fără commit-uri separate). Titlul commit-ului Git TREBUIE să conțină obligatoriu cuvântul de build curent (format: `build: <build_word> - <mesaj>` sau `[<build_word>] <mesaj>`).
> 1. Adăugați o nouă intrare în secțiunea **„Jurnalul Commit-urilor (Chronological Log)”** de mai jos.
> 2. Notați:
>    - **Titlul exact al commit-ului din Git** (conținând cuvântul de build curent)
>    - **Data și Ramura**
>    - **Build Word Curent**: cuvântul de build activ în aplicație la momentul commit-ului (indică clar din ce ciclu/versiune de build face parte commit-ul, chiar dacă acesta nu se schimbă la fiecare commit).
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

### [Commit `build: aurora - conversie cart din overlay in pagina, integrare picker v2 standalone`] — `build: aurora - conversie cart din overlay in pagina, integrare picker v2 standalone`
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

### [Commit `build: aurora - stockhub UX aliniat cu catalogpage (empty state, creare space, meniu contextual)`] — `build: aurora - stockhub UX aliniat cu catalogpage (empty state, creare space, meniu contextual)`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-20
- **Build Word Curent**: `aurora`
- **Descriere Detaliată**:
  - Aliniere UX `StockHubPage` cu comportamentul consacrat din `CatalogPage` conform specificațiilor Picker v2 (`SPEC_Picker_v2.md`).
  - Adăugare suport pentru vizualizarea stării „Gol” cu instrucțiuni specifice de creare.
  - Implementarea logicii de căutare a spațiilor și crearea unuia nou din `BottomBar` via `usePicker` (mod `inline`) și noul action `createSpace` din store.
  - S-a introdus un meniu contextual dedicat `StockHub`, apelat prin iconița `Warehouse` din bara de navigare, conținând acțiunea placeholder „Organizează spațiile”.

---

### [Commit `build: aurora - cos de tranzactie functional si integrare stockhub cu date reale`] — `build: aurora - cos de tranzactie functional si integrare stockhub cu date reale`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-20
- **Build Word Curent**: `aurora`
- **Descriere Detaliată**:
  - **Migrație Bază de Date (`20260820180000_rpc_commit_cart.sql`)**: Creare tabel `stock_alerts`, creare view `spaces_summary` și implementare funcție atomică RPC `commit_cart` pentru procesarea transferurilor de stoc între catalog și spații.
  - **StockHub & Date Reale (`useStockStore.js`, `StockHubPage.jsx`)**: Integrare store cu Supabase. `StockHubPage` afișează acum date live, folosește un efect de încărcare skeleton și prezintă alerte expandabile inline pentru produse cu stoc negativ (opțiunea C de UX confirmată).
  - **Proces de Checkout Real (`CartOverlay.jsx`)**: Suprapunerea coșului preia dinamic sursa și destinația din `useStockStore`, procesează tranzacția async și afișează starea cu spinner și notificări clare prin toast.
  - **Integrare Adaugă în Coș (`ProductPage.jsx`, `App.jsx`)**: Adăugat buton „Adaugă în coș” în meniul contextual din pagina produsului. `App.jsx` declanșează preîncărcarea spațiilor (`fetchSpaces()`) la inițializarea utilizatorului.

---

### [Commit `build: aurora - modul filtrare locala 2 coloane, persistenta stare si control date schema`] — `build: aurora - modul filtrare locala 2 coloane, persistenta stare si control date schema`
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

### [Commit `build: castor - update build word for vercel deployment and push`] — `build: castor - update build word for vercel deployment and push`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `castor`
- **Descriere Detaliată**:
  - **Generare Nou Build Word (`HomePage.jsx`)**: S-a actualizat cuvântul de build la `castor` (domeniu distinct: zoologie/faună) conform protocolului de `git push` pentru validarea versiunii deployed pe Vercel.
  - **Pregătire și Execuție Push**: Toate funcționalitățile de import produse CSV/XLSX, registrul de tipuri de date, optimizarea bulk de înaltă performanță și migrarea RPC asociată sunt transmise către remote.

---

### [Commit `build: busola - optimizare bulk import produse pentru viteza instantanee`] — `build: busola - optimizare bulk import produse pentru viteza instantanee`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Eliminare Cascade de Cereri de Rețea (Single Network Call)**: A fost rezolvată problema duratei mari de execuție (de la sute de secunde la 1-2 secunde). S-a eliminat apelul recursiv de `fetchCatalog()` executat după fiecare produs individual din buclă.
  - **Migrare & RPC Atomic Bulk (`supabase/migrations/20260817205000_rpc_bulk_import_products.sql`)**: S-a creat funcția RPC `create_products_bulk(p_category_id, p_products)` care procesează și inserează un întreg lot de produse într-o singură tranzacție Postgres, populând atomar atributele, tag-urile, prețul și generând NameID-uri garantat unice.
  - **Metodă Store Optimizată (`useCatalogStore.js` -> `addProductsBulk`)**: Adăugată metoda de inserare în masă cu fallback automat pe loturi (batch) și refetch unic garantat la finalul întregului import.
  - **Pregătire Date în Memorie (`productImporter.js`)**: Toate produsele din fișier sunt mapate și validate sincron în memorie înainte de trimiterea într-un singur payload către baza de date.

---

### [Commit `build: busola - import date user - implementare functionalitate`] — `build: busola - import date user - implementare functionalitate`
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

### [Commit `build: busola - sort category products newest first`] — `build: busola - sort category products newest first`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Sortare Produse Nou Adăugate la Începutul Listei**: Produsele din pagina categoriei sunt acum sortate descrescător după data adăugării (`created_at DESC`), astfel încât ultimele produse create apar direct în capul listei.
  - **Mapare & Query**: S-a mapat câmpul `createdAt` în `mapProduct` din `useCatalogStore.js`, s-a adăugat ordonarea descrescătoare la `fetchCatalog` și s-a aplicat sortarea în `CategoryPage.jsx` și `getProductsByCategory`.

---

### [Commit `build: busola - fix nameid and form state reset on picker swap`] — `build: busola - fix nameid and form state reset on picker swap`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Păstrare Stare Formular la Deschiderea Picker-ului**: S-a remediat comportamentul prin care deschiderea unui picker de atribut (swap) reseta starea din `ProductFormSheet` și schimba `Name ID` din cauza modificării parametrului de căutare din `BottomBar`.
  - **Inițializare Ancorată pe Tranziția `open`**: Resetarea și inițializarea formularului se declanșează strict la deschiderea/închiderea reală a sheet-ului (`open === true && !prevOpenRef.current`), menținând Name ID-ul și toate atributele completate intacte pe durata întregii sesiuni de completare.

---

### [Commit `build: busola - switch nameid generator to client-side local-first`] — `build: busola - switch nameid generator to client-side local-first`
- **Ramură**: `functionalitati`
- **Data**: 2026-08-17
- **Build Word Curent**: `busola`
- **Descriere Detaliată**:
  - **Trecere la Generare Client-Side (100% Local-First)**: S-a creat utilitarul `src/lib/nameIdGenerator.js` cu dicționar de cuvinte și algoritm de selecție aleatorie garantat unic față de lista locală de produse din Zustand (`useCatalogStore`).
  - **Rezolvare Eroare 404 & 0 ms Latență**: La apăsarea butonului de zaruri din formularul de adăugare produs (`ProductFormSheet`), generarea se execută instantaneu sincron pe client, fără niciun apel HTTP/RPC, eliminând dependența de rețea și erorile 404.
  - **Validare Disponibilitate în Formular**: Formularul verifică unicitatea locală a oricărui Name ID introdus manual înainte de trimiterea spre salvare.

---

### [Commit `build: busola - nameid acum poate fi setat de user`] — `build: busola - nameid acum poate fi setat de user`
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

### [Commit `build: busola - enforce build word in git commit message title`] — `build: busola - enforce build word in git commit message title`
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
