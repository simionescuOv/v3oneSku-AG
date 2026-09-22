# oneSku — Parcursul Dezvoltării & Jurnal Tehnic (`dev-path.md`)

> **REGULĂ OBLIGATORIE PENTRU TOȚI AGENȚII DE COD / VIBECODING:**
> - `git commit` se rulează **EXCLUSIV la cererea expresă a utilizatorului** (ex: „salvează în git”, „fă commit”).
> - La fiecare sarcină măruntă/ajustare, agentul modifică codul și adaugă direct un nou bullet point în secțiunea de sus `### [Commit c0c914b] — build: tramvai | commit: ciocan - implementare arhiva, mod selectie, etc
- **Ramură**: rec-value
- **Data**: 2026-09-20
- **Descriere Detaliată**:
  - **Mod selecție și Arhivare**: Adăugat flux complet de selecție multiplă (cu casete de bifare) în `ListPage.jsx` și FAB contextual. Funcția de arhivare mută elementele local în `archivedItems`.
  - **Pagina Arhivă**: Creată pagina dedicată `ArchivePage.jsx` cu opțiune de restaurare, accesibilă din meniul 3-dot al cardului Items din Dashboard.
  - **UI / UX Fixes**: Ajustat alinierea numerică la dreapta. Ajustat comportamentul TagSuggestionsPanel și hook-ul useAutocompleteGhost pentru a filtra elementele deja selectate în modul multi-select din PickerSheet.
  - **Header listă**: Adăugat calcul total (suma tuturor valorilor) în antet, atât pentru lista principală, cât și pentru arhivă.

---

### [Commit 530fb49] — build: vulcan | commit: cactus - mutare optiuni selectie in meniu contextual bottombar
- **Ramură**: rec-value
- **Data**: 2026-09-20
- **Descriere Detaliată**:
  - **Meniu Contextual**: Am eliminat butonul fix de text "Selectează" care acoperea `BottomBar`-ul și l-am mutat într-un `BottomSheet` nativ.
  - **Arhitectură BottomBar**: Am introdus starea `bottomBarMenuOverride` în `useAppStore` pentru a permite paginilor să preia controlul asupra butonului ≡ (Menu) din dreapta jos.
  - La apăsarea pe meniul `BottomBar` în paginile `Items` și `Archive`, se deschide un meniu contextual dedicat cu opțiunile "Selectează" / "Anulează selecția" / "Selectează & recuperează".

---

### [Commit 7769a65] — build: castor | commit: busola - tags-grup în items (rec-value).
- **Ramură**: rec-value
- **Data**: 2026-09-22
- **Descriere Detaliată**:
  - **Implementare modul Tag Groups (v2.3)**:
    - **`useItemsStore.js`**: Adăugat state `tagGroups` (array de foldere) și `tagGroupMembers` (map many-to-many groupId → string[]) cu persistență automată în localStorage. Metode CRUD: `addTagGroup`, `renameTagGroup`, `deleteTagGroup`, `associateTagsToGroups`, `createGroupWithTags`, `removeTagFromGroup`, `setGroupMembers`, `getGroupsForTag`.
    - **`TagGroupsPicker.jsx`** (nou): Componentă izolată cu layout 2 coloane (Foldere stânga / Tag-uri dreapta). Suport dual-mode: `allowOrganize=false` (Read-Only — filtru vizual rapid, nicio mutație posibilă) și `allowOrganize=true` (modul complet — selecție multi-tag+folder, asociere many-to-many, creare folder nou). Căutare sincronizată prin BottomBar: la tastare, coloana stângă ascunde folderul „Toate" și afișează doar foldere cu rezultate relevante.
    - **`ListPage.jsx`**: Adăugat import `Tag` din lucide-react + `TagGroupsPicker`. Adăugat state `tagsSheetOpen`. Adăugat butonul „Tags" (cu iconiță Tag) în ContextMenu existent. Integrat `TagGroupsPicker` ca `BottomSheet aboveBottomBar` cu `allowOrganize=true`.
    - **`SideMenu.jsx`**: Făcut titlul „oneSku" buton interactiv care navighează la pagina principală `/`.

---

### [Commit 2acbc10] — build: pian | commit: fular - ux/layout fixes tag groups (rec-value)
- **Ramură**: rec-value
- **Data**: 2026-09-22
- **Descriere Detaliată**:
  - **UX / Layout Fixes pentru TagGroupsPicker**:
    - Remediat un bug de CSS Flexbox (`flex-1 min-h-0` aplicat) care bloca posibilitatea de a face scroll în liste.
    - Convertit afișarea în `ListPage` la full-screen deasupra BottomBar-ului pentru maximizarea spațiului (`h-[calc(100dvh-4rem)] max-h-none rounded-none`).
    - Mutată logica de selecție în meniul contextual din BottomBar (`pushBottomBarOverride`) conform convențiilor aplicației, cu un BottomSheet curat de acțiuni.
    - Integrate butoanele de "Salvează" / "Anulează" într-un footer fix în partea de jos a ferestrei (precum în `BaseFilterSheet`), eliberând complet header-ul.
    - Regula 7 (Artefacte cu referințe la prompt) a fost adăugată oficial în `GEMINI.md`.

---

### [Commit 41eebb4] — build: umbrelă | commit: oglindă - bug fixes TagGroupsPicker
- **Ramură**: rec-value
- **Data**: 2026-09-22
- **Descriere Detaliată**:
  - **Bug Fixes la TagGroupsPicker**:
    - **Meniu contextual**: Am fixat ordinea de aplicare a `pushBottomBarOverride` dintr-un `BottomSheet` imbricat (folosind `setTimeout`), restabilind iconița ≡ care era ascunsă de părinte.
    - **Căutare Tags**: Schimbat filtrarea tag-urilor din `.includes()` în `.startsWith()` pentru a respecta regula de căutare pe prefix.
    - **Autocomplete**: Instanțiat hook-ul `useAutocompleteGhost` în `TagGroupsPicker`, activând afișarea textului gri predictiv din `BottomBar` în timpul căutării.

---

### [Commit 41eebb4] — build: cireș | commit: rachetă - ux/ui improvements tag groups
- **Îmbunătățiri UX / UI TagGroupsPicker**:
  - **Iconiță BottomBar**: Trimisă instanța componentei `AlignLeft` în loc de string, restabilind vizibilitatea iconiței Meniu.
  - **Folder Nou**: Mutat butonul "+ Folder nou" în partea de sus a listei din stânga (sub header), apărând dinamic când există tag-uri selectate, pentru a nu mai fi ascuns sub footer.
  - **Curățare Header**: Ștearsă linia de text albastru inutilă cu "3 tag-uri selectate" pentru a maximiza spațiul.
  - **Tag-uri Pinned**: În coloana din dreapta, elementele bifate sunt grupate acum în partea de sus a listei, separate vizual de celelalte, uniformizând comportamentul cu cel de la filtre.

---

### [Commit Pending]

*(Notă pentru agent: Adaugă următorul commit deasupra acestei linii)*
