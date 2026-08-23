- `git push` se realizează **EXCLUSIV când cere utilizatorul** (nu automat după fiecare commit). La fiecare push solicitat, generează un cuvânt complet aleator din limba română care să **NU aibă nicio similitudine tematică sau categorie comună cu cuvintele anterioare** (se interzice repetarea aceleiași tematici, ex: pietre prețioase, culori; cuvintele consecutive trebuie să provină din domenii complet distincte — ex: *busola*, *castor*, *pendul*, *vulcan*). Afișează-l în homepage sub titlul OneSKU (`build: <cuvânt>`) și comunică cuvântul în răspuns pentru verificarea versiunii pe Vercel.

## Regulă de triaj — când NU implementezi direct

Înainte de a implementa orice cerere nouă de funcționalitate (nu fix de bug, nu stilizare,
nu conectare de logică deja specificată), verifică dacă se încadrează la oricare din
semnalele de mai jos. Dacă DA la oricare, oprește-te — nu implementa.

**Semnale de oprire:**

1. Cererea ar necesita un tabel nou, o coloană cu sens nou, sau schimbă o relație de date
   existentă (ex: cum se leagă produsele de categorii, cum se propagă un atribut).
2. Cererea nu e complet determinată de spec-urile existente din `/SPEC_*.md` sau
   `ARCHITECTURE.md` — ai fi nevoit să alegi tu între variante nespecificate.
3. Cererea ar încălca sau ar cere excepție de la un anti-pattern fixat (long-press,
   search propriu în bottom-sheet, `position: fixed` în AppShell, `translateY` pe
   BottomBar legat de tastatură, unicitate per-sibling în loc de globală etc.).
4. O implementare greșită aici ar necesita rescriere în mai mult de un fișier/modul ca
   să fie corectată (nu e izolat, reversibil ieftin).

**Ce faci dacă oricare e adevărat:**

- **NU** implementezi.
- Actualizezi `STATUS.md` cu:
  - ce a cerut userul (intenția exactă, pe scurt)
  - de ce te-ai oprit (care semnal din lista de mai sus s-a declanșat)
  - stadiul actual al codului relevant pentru cererea respectivă (ce există deja,
    ce fișiere/module ar fi atinse)
- Răspunzi userului: „Pentru pasul ăsta e indicat să planifici cu agentul de
  planificare (Claude.ai). Am scris stadiul actual în STATUS.md."

**Ce faci dacă niciun semnal nu se declanșează:**

- Implementezi direct, ca de obicei (fix, stilizare, conectare la logică deja
  specificată, refactoring intern fără schimbare de comportament vizibil).

## Regulă de Arhitectură — Local-First & Solicitare Minimă a Rețelei

1. **Model Single-Fetch**: Aplicația este concepută pentru viteză extremă și volum redus/moderat de date (sute/mii de produse per tenant). Catalogul (categorii, atribute, opțiuni, produse) se descarcă o singură dată la inițializare/login în cache-ul local din memorie (`useCatalogStore`).
2. **Citiri 100% Client-Side**: Navigarea între pagini (inclusiv detaliile de produs `ProductPage`, paginile de categorie `CategoryPage` și folderele), căutările, filtrările și breadcrumb-urile se execută **EXCLUSIV din memoria locală (Zustand)**. Este **INTERZISĂ** adăugarea de interogări de rețea (fetch/select către Supabase) la schimbarea rutelor sau deschiderea detaliilor.
3. **Acces Rețea Exclusiv pe Mutații**: Rețeaua/Supabase este contactată DOAR la acțiuni explicite de salvare/editare/ștergere inițiate de utilizator (ex: `create_product`, `soft_delete_category`), urmate de actualizarea curată a stării locale.

## Regulă de Documentare a Dezvoltării — `docs/dev-path.md`

**ÎNAINTE de fiecare commit** realizat în acest proiect, agentul are obligația de a include cuvântul de build curent în titlul commit-ului Git (format: `build: <build_word> - <mesaj>` sau `[<build_word>] <mesaj>`), de a actualiza fișierul `docs/dev-path.md` și de a-l include în staging (`git add`) împreună cu fișierele modificate. În felul acesta, modificarea de cod și actualizarea jurnalului sunt salvate **într-un singur commit unitar** (nu sunt necesare două commit-uri separate).

**Mecanismul în cascadă N-1 pentru Hash-urile de Commit:**
1. Află hash-ul scurt al commit-ului anterior ($N-1$) prin `git rev-parse --short HEAD`.
2. Completează hash-ul real pe antetul intrării precedente (ex: `### [Commit 46f21f1] — build: ...`).
3. Adaugă noua intrare în capul listei marcată `### [Commit Pending] — build: ...`.

Intrarea va conține:
- Titlul exact al commit-ului din Git (cu prefixul de build) și data/ramura.
- **Build Word Curent**: cuvântul de build activ în aplicație la momentul commit-ului (astfel încât să fie clar din ce ciclu de build face parte fiecare commit).
- O descriere amplă în limbaj natural a ceea ce s-a modificat/adăugat, de ce și cum interacționează cu restul sistemului.


