# AGENT INSTRUCTIONS

1. RESPONSE LANGUAGE: Always respond to the user in Romanian.
2. VERIFICATION MARKER: Start EVERY response with: "🟢 [GEMINI.MD ACTIV]".
3. READ-ONLY BY DEFAULT: Do not edit, create, or delete files without explicit confirmation.
4. CONFIRMATION PROTOCOL: If file edits are required, present a brief plan first and wait for approval (e.g., "Aprobat").
5. AUDIO TRANSCRIPTION PROTOCOL: Whenever the user sends a message via voice dictation / audio recording, start the response by displaying the exact audio transcription first.
6. LOCAL-FIRST ARCHITECTURE: The app operates Local-First for ultra-fast performance. Reads, page navigation, search, filtering, and detail views MUST operate 100% client-side from local Zustand memory (`useCatalogStore`). Never add network fetch/select calls on route navigation. Network calls are strictly reserved for user-triggered mutations (add/edit/delete).
9. DEV-PATH & COMMIT MESSAGE PROTOCOL: Titlul fiecărui `git commit` TREBUIE să conțină obligatoriu cuvântul de build curent (format: `build: <build_word> - <descriere>` sau `[<build_word>] <descriere>`). ÎNAINTE de a executa `git commit`, agentul are obligația să actualizeze `docs/dev-path.md` (inclusiv câmpul Build Word Curent) și să adauge fișierul la `git add`, astfel încât codul și jurnalul de dezvoltare să fie incluse ÎNTR-UN SINGUR COMMIT unificat.
10. BUILD WORD & PUSH PROTOCOL: `git push` se execută EXCLUSIV la cererea expresă a utilizatorului (nu se face push automat după commit). La fiecare push solicitat, generează un cuvânt complet aleator din limba română care să NU aibă nicio similitudine tematică sau categorie comună cu cuvintele anterioare (este INTERZISĂ repetarea aceleiași tematici, ex: pietre prețioase, culori; cuvintele consecutive trebuie să provină din domenii complet necorelate — ex: *busola*, *castor*, *pendul*, *vulcan*). Actualizează `BUILD_WORD` în `src/pages/HomePage.jsx` și comunică cuvântul în răspuns pentru validarea versiunii live pe Vercel. Toate commit-urile ulterioare vor folosi acest nou cuvânt în titlul commit-ului până la următorul push.
11. UI SELECTION PROTOCOL (PICKER v2): Whenever the user needs to select an item from a list (e.g. source, destination, category), NEVER use native HTML `<select>` dropdowns. Instead, ALWAYS use the standard Picker mechanism as described in `docs/specs/SPEC_Picker_v2.md`. The form UI should look like an input displaying the selected item; tapping it opens a dedicated bottom-sheet/dialog picker (integrating with `usePicker` and `BottomBar` search). After selection, the picker closes and the chosen item appears in the UI.

12. BUILD WORD ȘI COMMIT WORD PENTRU COMMIT-URI: 
- De fiecare dată când scrii un nou commit în `docs/dev-path.md`, generează un **cuvânt de commit** unic nou (ex: `vulcan`, `quasar`).
- Acel cuvânt trebuie inclus în titlul/descrierea commit-ului din Git (ex: `build: busola | commit: vulcan - descriere`).
- De asemenea, trebuie actualizat obligatoriu în constanta `COMMIT_WORD` din fișierul `src/pages/HomePage.jsx`.
- Constanta `BUILD_WORD` din `src/pages/HomePage.jsx` se schimbă DOAR la push, conform regulii 10. Astfel, utilizatorul vede mereu pe HomePage și versiunea de push (build) și versiunea ultimului commit.

13. PREFIXUL `plan-`: Dacă promptul utilizatorului începe cu cuvântul `plan-`, este INTERZIS să modifici absolut orice fișier (nicio linie de cod, nicio modificare). Discuția se află strict în stadiu de planificare și dezbatere. Doar vei citi fișierele și vei răspunde utilizatorului cu idei sau un plan teoretic.