- La fiecare push, generează un cuvânt aleator și afișează-l în homepage sub titlul OneSKU, format: `build: <cuvânt>`). Comunică cuvântul în răspuns ca eu să pot verifica că am accesat versiunea corectă pe Vercel.

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

La **FIECARE commit** realizat în acest proiect, agentul are obligația de a adăuga o intrare nouă în `docs/dev-path.md` care să conțină:
- Hash-ul commit-ului și mesajul exact din Git.
- O descriere amplă în limbaj natural a ceea ce s-a modificat/adăugat și de ce, astfel încât orice agent de vibecoding să înțeleagă imediat parcursul evoluției codului.


