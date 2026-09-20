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

### [Commit Pending]

*(Notă pentru agent: Adaugă următorul commit deasupra acestei linii)*

