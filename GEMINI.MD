# AGENT INSTRUCTIONS

1. RESPONSE LANGUAGE: Always respond to the user in Romanian.
2. VERIFICATION MARKER: Start EVERY response with: "🟢 [GEMINI.MD ACTIV]".
3. READ-ONLY BY DEFAULT: Do not edit, create, or delete files without explicit confirmation.
4. CONFIRMATION PROTOCOL: If file edits are required, present a brief plan first and wait for approval (e.g., "Aprobat").
5. AUDIO TRANSCRIPTION PROTOCOL: Whenever the user sends a message via voice dictation / audio recording, start the response by displaying the exact audio transcription first.
6. LOCAL-FIRST ARCHITECTURE: The app operates Local-First for ultra-fast performance. Reads, page navigation, search, filtering, and detail views MUST operate 100% client-side from local Zustand memory (`useCatalogStore`). Never add network fetch/select calls on route navigation. Network calls are strictly reserved for user-triggered mutations (add/edit/delete).
9. DEV-PATH & COMMIT LA CERERE EXPLICITĂ:
   - `git commit` se execută **EXCLUSIV când cere expres utilizatorul** (ex: „salvează în git”, „fă commit”).
   - La fiecare sarcină măruntă/ajustare cerută de utilizator, agentul modifică codul și adaugă direct un bullet point cu modificarea realizată în secțiunea de sus `### [Commit Pending]` din `docs/dev-path.md` (care funcționează ca un draft viu/activ). NU se face `git commit` după fiecare sarcină măruntă.
   - Când utilizatorul cere commit:
     1. Se completează hash-ul real al commit-ului anterior ($N-1$) obținut prin `git rev-parse --short HEAD` pe antetul intrării precedente (ex: `### [Commit 46f21f1] — build: ...`).
     2. Se generează un nou `COMMIT_WORD` și se actualizează în `src/pages/HomePage.jsx` și în titlul intrării curente din `docs/dev-path.md`.
     3. Se execută `git add .` și `git commit` cu titlul unitar (format: `build: <build_word> | commit: <commit_word> - <descriere>`).
     4. Se deschide o nouă secțiune curată `### [Commit Pending]` pentru următoarele sarcini.
10. BUILD WORD & PUSH PROTOCOL: `git push` se execută EXCLUSIV la cererea expresă a utilizatorului (nu se face push automat după commit). La fiecare push solicitat, generează un cuvânt complet aleator din limba română care să NU aibă nicio similitudine tematică sau categorie comună cu cuvintele anterioare (este INTERZISĂ repetarea aceleiași tematici, ex: pietre prețioase, culori; cuvintele consecutive trebuie să provină din domenii complet necorelate — ex: *busola*, *castor*, *pendul*, *vulcan*). Actualizează `BUILD_WORD` în `src/pages/HomePage.jsx` și comunică cuvântul în răspuns pentru validarea versiunii live pe Vercel. Toate commit-urile ulterioare vor folosi acest nou cuvânt în titlul commit-ului până la următorul push.
11. UI SELECTION PROTOCOL (PICKER v2): Whenever the user needs to select an item from a list (e.g. source, destination, category), NEVER use native HTML `<select>` dropdowns. Instead, ALWAYS use the standard Picker mechanism as described in `docs/specs/SPEC_Picker_v2.md`. The form UI should look like an input displaying the selected item; tapping it opens a dedicated bottom-sheet/dialog picker (integrating with `usePicker` and `BottomBar` search). After selection, the picker closes and the chosen item appears in the UI.

13. PREFIXUL `plan-`: Dacă promptul utilizatorului începe cu cuvântul `plan-`, este INTERZIS să modifici absolut orice fișier (nicio linie de cod, nicio modificare). Discuția se află strict în stadiu de planificare și dezbatere. Doar vei citi fișierele și vei răspunde utilizatorului cu idei sau un plan teoretic.

## ARCH_BottomSearch — Convenție: BottomBar search → lista vizibilă

**Regulă:** Orice componentă/pagină care afișează o listă scrollabilă cu BottomBar vizibil
TREBUIE să treacă lista prin `useBottomSearch` (filtru pur) sau `usePicker` (când e nevoie
și de logică create/select). Nu există excepții.

- `useBottomSearch(items, labelFn, { enabled })` — `src/hooks/useBottomSearch.js`
- `usePicker({ mode: 'inline', items, labelFn, query })` — `src/hooks/usePicker.js`

Dacă un context particular necesită dezactivarea căutării, se folosește `enabled: false`
**explicit** — nu omiterea hook-ului.

**Starea curentă (implementat):**

| Context | Mecanism |
|---|---|
| CatalogPage — noduri | `usePicker` |
| CatalogPage — filtru activ (produse) | `useBottomSearch` (Pasul 2 după filtrul persistent) |
| CategoryPage — produse | `usePicker` (include filtrul persistent automat via `baseCategoryProducts`) |
| StockHubPage — spații | `usePicker` |
| CartPage — picker sursă/dest | `usePicker` |
| CartPage — lista coș | `filterAndSort` direct în `visibleCartItems` |

## ARCH_SearchableAttrs — Extensie viitoare: atribute căutabile per-categorie

**Problemă:** `getSearchableLabel` din `CategoryPage` concatenează toate atributele
produsului, inclusiv texte lungi (ex: „Descriere"), generând false positives și degradând
relevanța căutării.

**Soluție planificată (3 pași independenți, NU implementat încă):**

1. **Migrare DB:** `ALTER TABLE category_attributes ADD COLUMN searchable boolean DEFAULT true;`
2. **Store + SchemaSheet UI:** expune toggle „Căutabil" alături de „Filtrabil" / „Preview card"
3. **CategoryPage:** actualizează `getSearchableLabel` să respecte `attr.searchable`

**Principiu arhitectural:** `useBottomSearch` și `usePicker` sunt **agnostice** față de
structura datelor — nu vor necesita nicio modificare. Toată logica „ce intră în căutare"
trăiește exclusiv în `labelFn` transmis de pagina consumatoare.