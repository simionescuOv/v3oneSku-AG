# oneSku — Parcursul Dezvoltãrii & Jurnal Tehnic (`dev-path.md`)

> **REGULÃ OBLIGATORIE PENTRU TO?I AGEN?II DE COD / VIBECODING:**
> - `git commit` se ruleazã **EXCLUSIV la cererea expresã a utilizatorului** (ex: „salveazã în git”, „fã commit”).

### [Commit 21941cc] - build: copac | commit: minge - iconita skip pentru salvare incompleta
- Inlocuit iconita 'MoreHorizontal' (...) cu 'FastForward' la butonul de salvare portocaliu (draft/incomplet) pentru a reflecta mai bine intentia utilizatorului de a da skip detaliilor curente.

---

### [Commit Pending]
- 

---

### [Commit 21941cc] - build: metrou | commit: castravete - Adaugare modul Import/Export in Dashboard
- Adãugat modul de Import / Export pentru items ?i tags în `DashboardPage.jsx`.
- Adãugatã metoda `importBackup` în `useItemsStore` pentru preluarea datelor dintr-un backup JSON.

---

### [Commit bd22e8c] - build: vapor | commit: scaun - remove tags cancel button
- Eliminat butonul x (cancel) de pe tag-urile din Items, astfel incat modificarea lor se face doar prin dialogul dedicat.

---

### [Commit 5b23ff1] - build: corabie | commit: pat - adaugare butoane MultiTag in ItemFormSheet
- Adaugat buton MultiTag manager pe linia etichetei Tags.
- Adaugat buton de aplicare MultiTag (PickerSheet cu single-select) in dreapta inputului de tags.

---

### [Commit 1a7f105] - build: palarie | commit: foc - modificare afisare tags in linie cu contor
- Schimbat afisarea individuala a tag-urilor pe mai multe linii intr-o singura linie simpla, cu afisare tip contor 'x taguri'.

---

### [Commit 322cb6f] - build: abanos | commit: harpa - redesign card Items cu data sticky WhatsApp-style
- Reconfigurat layout card: suma (stanga), descriere pe 2 randuri (centru), ora izolata (dreapta sus).
- Sters afisarea tag-urilor direct din lista pentru curatenie vizuala.
- Implementat separator date sticky top, care face fade-out cand utilizatorul nu mai face scroll, exact ca in chats-urile WhatsApp.

---

### [Commit f1cfbac] - build: vulcan | commit: lac - fixare sticky date dual
- S-a separat badge-ul de date in doua elemente diferite: unul inline static care separa vizual grupurile (pe un fundal albastru inchis), si unul plutitor (sticky) care se suprapune fix peste cel static si devine vizibil doar la scroll.

---

### [Commit 6859aa9] - build: ciocan | commit: caiet - blurare tastatura la selectia de tag-uri in lista
- Adaugat document.activeElement?.blur() in functia handleTagSelect din ListPage pentru a forta ascunderea tastaturii cand utilizatorul alege un tag (prin tap sau autocomplete).

---

### [Commit 34fac80] - build: biscuit | commit: lemn - stare incomplet items
- Adaugat buton portocaliu cu puncte de suspensie si buton discheta in formularul items pentru marcarea rapida ca nefinalizat / salvare instanta.
- Valorile elementelor incomplete sunt afisate cu portocaliu strident in lista si detalii.

---

### [Commit 7f2f4d4] - build: balon | commit: creion - fast save logic formular items
- Schimbat comportamentul butonului portocaliu din simplu toggle intr-un buton de save fast (salveaza ca incomplet si inchide).
- Butonul de langa el (si cel de jos) salveaza elementul ca finalizat si inchid.

---

### [Commit 9deb146] - build: foarfece | commit: lampa - fix salvare isIncomplete in useItemsStore
- Am reparat bug-ul prin care starea de isIncomplete era aruncata (discarded) la nivelul stocarii (Zustand store). Acum campul este salvat corect in DB-ul local, ceea ce activeaza corect culoarea portocalie pe carduri si pastreaza memoria starii pentru formular.

---

### [Commit b832cda] - build: cascada | commit: strugure - ui active tags in pickersheet
- Adaugat modul vizual (pills) pentru tag-uri active in header-ul de la PickerSheet.
- Permite eliminarea rapida a tag-urilor bifate direct din panoul superior, fara a le mai cauta in lista.
- Modificat design-ul butonului de Salvare pentru cazul selec?iei de tag-uri (albastru inchis, icon Save, text Tags).

---

### [Commit 2c33e65] - build: plasa | commit: cravata - active tags collapsible in pickersheet
- Transformare panou tag-uri active din PickerSheet in modul extensibil/colapsibil cu toggle button (Chevron).
- Setat max-height cu overflow-y-auto pentru a permite scroll-ul cand sunt selectate foarte multe etichete fara a bloca restul continutului.

---

### [Commit 098e33b] - build: baterie | commit: covor - smart header active tags
- Unificat titlul formularului PickerSheet cu numaratorul de tag-uri active intr-un singur buton header.
- Numarul de tag-uri active este acum mult mai vizibil (font mai mare, bold, alb puternic).
- Daca nu sunt tag-uri selectate, se afiseaza doar titlul simplu.

---

### [Commit 85f6f5c] - build: cleste | commit: ghiozdan - auto scroll taguri active
- Limitare inaltime modul tag-uri active la max 110px (~3 randuri).
- Implementat logica de auto-scroll (smooth) la ultimul rand adaugat folosind useRef, astfel incat vizibilitatea sa ramana perfecta indiferent de numarul tag-urilor.

---

### [Commit 53d4199] - build: pahar | commit: sertar - floating scroll footer tags picker
- Transformare layout intern PickerSheet in flex-1 min-h-0 pentru a nu mai impinge footer-ul in afara ecranului la rezolutii mici/zoom.
- Footer-ul (Anuleaza / Salveaza) pozitionat absolut la baza Bottom Sheet-ului (lipit cu background semitransparent).
- Adaugat comportament WhatsApp: footer-ul se ascunde fluid in timpul derularii listei de optiuni, eliberand ecranul, si reapare automat cand scroll-ul se opreste.

---

### [Commit 68db3ae] - build: banca | commit: telefon - slim footer in pickersheet
- Micsorat inaltimea butoanelor din footer (de la h-11 la h-9) si padding-ul containerului (de la py-3 la py-2).
- Redusa dimensiunea iconitei Save (de la 18px la 16px) pentru a se potrivi cu noile butoane compacte (70% din marimea initiala).

---

### [Commit 13391ca] - build: strugure | commit: fereastra - bottombar secondary action save
- Arhitectura hibrida: eliminat complet footer-ul absolut plutitor din PickerSheet (acoperind ecranul).
- Butoanele de Salvare/Anulare au fost mutate ca ultimul element in lista, derulandu-se firesc (fara a bloca spatiul vizual).
- Creat mecanismul 'bottomBarSecondaryAction' in useAppStore pentru a injecta un buton de fast-save (Discheta albastra) direct in BottomBar, langa X.
- Ingustat usor butonul de 'Menu Override' (X) din dreapta in BottomBar (de la w-10 la w-8) pentru a optimiza spatiul pentru noul buton de Salvare.

---

### [Commit dc342e5] - build: soare | commit: castel - click direct pe editare item incomplet
- Cand un element din lista globala este incomplet (isIncomplete = true, text portocaliu), un click pe el deschide direct formularul de editare (ItemFormSheet), sarind peste modul de vizionare (ItemDetailSheet).
- Elementele finalizate raman cu comportamentul curent (deschid intai ItemDetailSheet).

---

### [Commit 21941cc] - build: copac | commit: minge - iconita skip pentru salvare incompleta
- Inlocuit iconita 'MoreHorizontal' (...) cu 'FastForward' la butonul de salvare portocaliu (draft/incomplet) pentru a reflecta mai bine intentia utilizatorului de a da skip detaliilor curente.

---

### [Commit Pending]
- 

---

### [Commit 21941cc] - build: metrou | commit: castravete - Adaugare modul Import/Export in Dashboard
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
_(gol — urmãtoarea sarcinã va adãuga un bullet point aici)_

---
### [Commit dd7078d] — build: ciocan | commit: fluviu - Aplicare agresiva tip search pe toate inputurile pentru blocare Autofill Chromium
- **Ramura**: rec-value
- **Data**: 2026-09-28
- **Descriere Detaliata**:
  - `src/utils/formProps.js` - modificat `autoComplete` la o valoare invalida (`nope-do-not-autofill`) in loc de `off` (care este ignorat de Chromium pe Android), si adaugat `role="presentation"` pentru a prabusi euristica de sugerare carduri si parole.
  - `src/index.css` - adaugata regula CSS globala `::-webkit-search-cancel-button { display: none; }` pentru a ascunde iconita nativa "X" din interiorul inputurilor de tip search.
  - `src/components/items/ItemFormSheet.jsx`, `src/components/catalog/ProductFormSheet.jsx`, `src/components/catalog/GroupNameSheet.jsx`, `src/components/catalog/SubgroupSheet.jsx`, `src/components/catalog/SchemaSheet.jsx`, `src/components/items/TagGroupsPicker.jsx`, `src/components/shell/ScannerOverlay.jsx` - convertite toate inputurile cu clasa anti-autofill din `type="text"` si `type="number"` in `type="search"`, pastrand suportul numeric via `inputMode="numeric"`, ocolind total declansatoarele autofill de Chromium.
  - `src/pages/HomePage.jsx` - actualizat `BUILD_WORD` la `ciocan` si `COMMIT_WORD` la `fluviu`.

---

### [Commit 21941cc] - build: copac | commit: minge - iconita skip pentru salvare incompleta
- Inlocuit iconita 'MoreHorizontal' (...) cu 'FastForward' la butonul de salvare portocaliu (draft/incomplet) pentru a reflecta mai bine intentia utilizatorului de a da skip detaliilor curente.

---

### [Commit Pending]
- 

---

### [Commit 21941cc] - build: metrou | commit: castravete - Adaugare modul Import/Export in Dashboard
- Adãugat modul de Import / Export pentru items ?i tags în `DashboardPage.jsx`.
- Adãugatã metoda `importBackup` în `useItemsStore` pentru preluarea datelor dintr-un backup JSON.

---

### [Commit bd22e8c] - build: vapor | commit: scaun - remove tags cancel button
- Eliminat butonul x (cancel) de pe tag-urile din Items, astfel incat modificarea lor se face doar prin dialogul dedicat.

---

### [Commit 5b23ff1] - build: corabie | commit: pat - adaugare butoane MultiTag in ItemFormSheet
- Adaugat buton MultiTag manager pe linia etichetei Tags.
- Adaugat buton de aplicare MultiTag (PickerSheet cu single-select) in dreapta inputului de tags.

---

### [Commit 1a7f105] - build: palarie | commit: foc - modificare afisare tags in linie cu contor
- Schimbat afisarea individuala a tag-urilor pe mai multe linii intr-o singura linie simpla, cu afisare tip contor 'x taguri'.

---

### [Commit 322cb6f] - build: abanos | commit: harpa - redesign card Items cu data sticky WhatsApp-style
- Reconfigurat layout card: suma (stanga), descriere pe 2 randuri (centru), ora izolata (dreapta sus).
- Sters afisarea tag-urilor direct din lista pentru curatenie vizuala.
- Implementat separator date sticky top, care face fade-out cand utilizatorul nu mai face scroll, exact ca in chats-urile WhatsApp.

---

### [Commit f1cfbac] - build: vulcan | commit: lac - fixare sticky date dual
- S-a separat badge-ul de date in doua elemente diferite: unul inline static care separa vizual grupurile (pe un fundal albastru inchis), si unul plutitor (sticky) care se suprapune fix peste cel static si devine vizibil doar la scroll.

---

### [Commit 6859aa9] - build: ciocan | commit: caiet - blurare tastatura la selectia de tag-uri in lista
- Adaugat document.activeElement?.blur() in functia handleTagSelect din ListPage pentru a forta ascunderea tastaturii cand utilizatorul alege un tag (prin tap sau autocomplete).

---

### [Commit 34fac80] - build: biscuit | commit: lemn - stare incomplet items
- Adaugat buton portocaliu cu puncte de suspensie si buton discheta in formularul items pentru marcarea rapida ca nefinalizat / salvare instanta.
- Valorile elementelor incomplete sunt afisate cu portocaliu strident in lista si detalii.

---

### [Commit 7f2f4d4] - build: balon | commit: creion - fast save logic formular items
- Schimbat comportamentul butonului portocaliu din simplu toggle intr-un buton de save fast (salveaza ca incomplet si inchide).
- Butonul de langa el (si cel de jos) salveaza elementul ca finalizat si inchid.

---

### [Commit 9deb146] - build: foarfece | commit: lampa - fix salvare isIncomplete in useItemsStore
- Am reparat bug-ul prin care starea de isIncomplete era aruncata (discarded) la nivelul stocarii (Zustand store). Acum campul este salvat corect in DB-ul local, ceea ce activeaza corect culoarea portocalie pe carduri si pastreaza memoria starii pentru formular.

---

### [Commit b832cda] - build: cascada | commit: strugure - ui active tags in pickersheet
- Adaugat modul vizual (pills) pentru tag-uri active in header-ul de la PickerSheet.
- Permite eliminarea rapida a tag-urilor bifate direct din panoul superior, fara a le mai cauta in lista.
- Modificat design-ul butonului de Salvare pentru cazul selec?iei de tag-uri (albastru inchis, icon Save, text Tags).

---

### [Commit 2c33e65] - build: plasa | commit: cravata - active tags collapsible in pickersheet
- Transformare panou tag-uri active din PickerSheet in modul extensibil/colapsibil cu toggle button (Chevron).
- Setat max-height cu overflow-y-auto pentru a permite scroll-ul cand sunt selectate foarte multe etichete fara a bloca restul continutului.

---

### [Commit 098e33b] - build: baterie | commit: covor - smart header active tags
- Unificat titlul formularului PickerSheet cu numaratorul de tag-uri active intr-un singur buton header.
- Numarul de tag-uri active este acum mult mai vizibil (font mai mare, bold, alb puternic).
- Daca nu sunt tag-uri selectate, se afiseaza doar titlul simplu.

---

### [Commit 85f6f5c] - build: cleste | commit: ghiozdan - auto scroll taguri active
- Limitare inaltime modul tag-uri active la max 110px (~3 randuri).
- Implementat logica de auto-scroll (smooth) la ultimul rand adaugat folosind useRef, astfel incat vizibilitatea sa ramana perfecta indiferent de numarul tag-urilor.

---

### [Commit 53d4199] - build: pahar | commit: sertar - floating scroll footer tags picker
- Transformare layout intern PickerSheet in flex-1 min-h-0 pentru a nu mai impinge footer-ul in afara ecranului la rezolutii mici/zoom.
- Footer-ul (Anuleaza / Salveaza) pozitionat absolut la baza Bottom Sheet-ului (lipit cu background semitransparent).
- Adaugat comportament WhatsApp: footer-ul se ascunde fluid in timpul derularii listei de optiuni, eliberand ecranul, si reapare automat cand scroll-ul se opreste.

---

### [Commit 68db3ae] - build: banca | commit: telefon - slim footer in pickersheet
- Micsorat inaltimea butoanelor din footer (de la h-11 la h-9) si padding-ul containerului (de la py-3 la py-2).
- Redusa dimensiunea iconitei Save (de la 18px la 16px) pentru a se potrivi cu noile butoane compacte (70% din marimea initiala).

---

### [Commit 13391ca] - build: strugure | commit: fereastra - bottombar secondary action save
- Arhitectura hibrida: eliminat complet footer-ul absolut plutitor din PickerSheet (acoperind ecranul).
- Butoanele de Salvare/Anulare au fost mutate ca ultimul element in lista, derulandu-se firesc (fara a bloca spatiul vizual).
- Creat mecanismul 'bottomBarSecondaryAction' in useAppStore pentru a injecta un buton de fast-save (Discheta albastra) direct in BottomBar, langa X.
- Ingustat usor butonul de 'Menu Override' (X) din dreapta in BottomBar (de la w-10 la w-8) pentru a optimiza spatiul pentru noul buton de Salvare.

---

### [Commit dc342e5] - build: soare | commit: castel - click direct pe editare item incomplet
- Cand un element din lista globala este incomplet (isIncomplete = true, text portocaliu), un click pe el deschide direct formularul de editare (ItemFormSheet), sarind peste modul de vizionare (ItemDetailSheet).
- Elementele finalizate raman cu comportamentul curent (deschid intai ItemDetailSheet).

---

### [Commit 21941cc] - build: copac | commit: minge - iconita skip pentru salvare incompleta
- Inlocuit iconita 'MoreHorizontal' (...) cu 'FastForward' la butonul de salvare portocaliu (draft/incomplet) pentru a reflecta mai bine intentia utilizatorului de a da skip detaliilor curente.

---

### [Commit Pending]
- 

---

### [Commit 21941cc] - build: metrou | commit: castravete - Adaugare modul Import/Export in Dashboard
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
-  — build: migdala | commit: clopot - Corectare antete Vercel si rescrieri SPA pentru activare instalare PWA WebAPK
- **Ramura**: rec-value
- **Data**: 2026-09-27
- **Descriere Detaliata**:
  - `vercel.json` - corectat regula de rescriere SPA la `/((?!.*\\.[a-zA-Z0-9]+$).*)` pentru a preveni rescrierea fi?ierelor statice cãtre `index.html`. Adãugate antete HTTP explicite pentru `/manifest.json`, `/(.*)\\.webmanifest` (`application/manifest+json`) ?i `/sw.js` (`application/javascript`, `Service-Worker-Allowed: /`, `no-cache`).
  - `public/manifest.json` - adãugatã copie directã `manifest.json` pentru compatibilitate 100% cu motoarele Chromium de pe Android.
  - `index.html` - actualizat link-ul de manifest principal la `/manifest.json`.
  - `src/main.jsx` - eliminat blocajul cauzat de ascultãtorul evenimentului `load`, înregistrând Service Worker-ul imediat ce DOM-ul este gata.
  - `src/pages/HomePage.jsx` - actualizat `BUILD_WORD` la `migdala` ?i `COMMIT_WORD` la `clopot`.

---

### [Commit 4935739] — build: ceainic | commit: umbrela - Configurare PWA Standalone complet (manifest, pictograme, service worker)
- **Ramura**: rec-value
- **Data**: 2026-09-27
- **Descriere Detaliata**:
  - `public/manifest.webmanifest` - configurat manifestul oficial Web App cu `display: "standalone"`, `display_override: ["standalone", "minimal-ui"]`, orientare portret, temã `#09090b` ?i definirea setului de iconi?e (192, 512, maskable, SVG).
  - `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` - create pictogramele de brand oneSku optimizate pentru instalabilitate nativã WebAPK pe Android ?i ecran de pornire iOS.
  - `public/sw.js` - creat Service Worker-ul cu lifecycle skipWaiting/claim ?i passthrough fetch handler pentru compatibilitate maximã cu arhitectura Local-First ?i validarea cerin?elor de instalabilitate PWA Chromium.
  - `index.html` - adãugate tag-urile `<link rel="manifest">`, iconi?ele, apple-touch-icon ?i meta tag-urile de aplica?ie autonomã (`mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`).
  - `src/main.jsx` - înregistrare automatã a Service Worker-ului pe protocol HTTPS ?i localhost.
  - `src/pages/HomePage.jsx` - actualizat `BUILD_WORD` la `ceainic` ?i `COMMIT_WORD` la `umbrela`.

---

### [Commit 1972f28] — build: busola | commit: morcov - Dezactivare bara sugestii autofill si euristic mobile pe toate inputurile
- **Ramura**: rec-value
- **Data**: 2026-09-27
- **Descriere Detaliata**:
  - `src/utils/formProps.js` - creat utilitarul `NO_AUTOFILL_PROPS` cu `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}`, `data-lpignore="true"` si `data-form-type="other"`.
  - `src/components/shell/BottomBar.jsx` - adaugat `NO_AUTOFILL_PROPS` pe inputul universal de cautare, pastrand referintele DOM si ignorarea 1Password.
  - `src/components/catalog/ProductFormSheet.jsx` - aplicat `NO_AUTOFILL_PROPS` si nume tehnice neutre (`sku-nid`, `sku-attr-*`, `sku-price-val`); inlocuit critic `type="tel"` cu `type="text" inputMode="numeric"` pe barcode (`sku-ean`) pentru a elimina promptul Android de numere de telefon din contacte.
  - `src/components/items/ItemFormSheet.jsx` - adaugat `NO_AUTOFILL_PROPS` si denumiri tehnice neutre pe campurile de valoare (`flux-item-val`), descriere (`flux-item-desc`) si moment (`flux-item-moment`).
  - `src/components/items/TagGroupsPicker.jsx` - adaugat `NO_AUTOFILL_PROPS` si atribute neutre pe titlu MultiTag (`multitag-title`) si folder nou (`tag-folder-title`).
  - `src/pages/CartPage.jsx` - adaugat `NO_AUTOFILL_PROPS` si atribut neutru pe inputul numeric de cantitate (`cart-qty-*`).
  - `src/components/catalog/GroupNameSheet.jsx` & `src/components/catalog/SubgroupSheet.jsx` - adaugat `NO_AUTOFILL_PROPS` si denumiri neutre (`group-folder-title`, `subgroup-folder-title`).
  - `src/components/catalog/SchemaSheet.jsx` - adaugat `NO_AUTOFILL_PROPS` si denumiri neutre pe campurile de creare atribut (`schema-attr-new`), editare (`schema-attr-edit`) si valoare optiune (`schema-opt-val`).
  - `src/components/shell/ScannerOverlay.jsx` - adaugat `NO_AUTOFILL_PROPS` si atribut neutru pe inputul manual de barcode (`scanner-manual-code`).
  - `src/pages/HomePage.jsx` - actualizat `BUILD_WORD` la `busola` si `COMMIT_WORD` la `morcov`.

---

### [Commit 069440b] — build: harpa | commit: trofeu - Repozitionare buton creare folder in footer intre Anuleaza si Salveaza
- **Ramura**: rec-value
- **Data**: 2026-09-26
- **Descriere Detaliata**:
  - `src/components/items/TagGroupsPicker.jsx` - eliminat butonul plutitor (rotund albastru cu Plus) din coloana stanga de foldere care bloca interactiunea cu elementele din lista.
  - Repozitionat butonul de creare folder direct in footer-ul fix de actiuni (`organizeMode === 'add'`), asezat compact si aliniat intre butonul de „Anuleaza” si „Salveaza asocierile”.

---

### [Commit 073c0fe] — build: vulcan | commit: salcam - MultiTag: Auto-expand Pinned la cautare si Badge luminos pt count
- **Ramura**: rec-value
- **Data**: 2026-09-26
- **Descriere Detaliata**:
  - Implementat mecanism local derivat (`searchOverride`) in `MultiTagSheet.jsx` care forteaza deschiderea folderului de 'Fixate' cat timp exista text in bara de cautare. La stergerea cautarii, containerul revine instant la starea salvata global in Store.
  - Modificat stilizarea count-ului de taguri per multitag: cifra este acum font-bold si text-white pentru un contrast excelent.

---

### [Commit fe49cfc] ? build: abanos | commit: papadie - Corectare vizibilitate Taguri Selectate in Editare MultiTag
- **Ramura**: rec-value
- **Data**: 2026-09-26
- **Descriere Detaliata**:
  - **TagGroupsPicker**: Corectat bug-ul care ascundea containerul de taguri selectate (pinned header) in \selectionMode\ (modul folosit de MultiTag). \n  - Actualizat calculul pentru \pinnedTags\ pentru a returna mereu TOATE tagurile bifate din intregul \ocabulary\ (global), in loc sa fie limitate la folderul activ. Astfel utilizatorul are o viziune de ansamblu perfecta a intregii sale selectii, chiar si atunci cand schimba folderele.

---

### [Commit 8ec16fb] ? build: elefant | commit: chibrit - MultiTag: editare nume, sistem Pinning cu sectiune persistenta si navigare lista back
- **Ramura**: rec-value
- **Data**: 2026-09-26
- **Descriere Detaliata**:
  - `src/store/useItemsStore.js` - inlocuit sistemul vechi (usageCount) cu sistem de Pinning (`isPinned`). Modificata functia de sortare pentru a returna cronologic invers. Adaugata persistenta `multiTagsPinnedExpanded` pentru folderele fixate.
  - `src/components/items/TagGroupsPicker.jsx` - header-ul suporta un camp input editabil daca `editableTitle=true`. Functia de onConfirm returneaza array de taguri plus noul nume.
  - `src/components/items/MultiTagSheet.jsx` - redesenat layout-ul listei pentru a acomoda sectiunea expandabila (Foldere Pinned) cu salvare de state, adaugat buton de Pin pe rand. Eliminat extinderea inline in favoarea navigarii catre modul Edit la click pe un multitag. Corectat behavior-ul de onConfirm pentru a reveni mereu la step LIST.

---

### [Commit db04471] ? build: macara | commit: radar - implementare MultiTag v1 (manager)
- **Ramura**: rec-value
- **Data**: 2026-09-26
- **Descriere Detaliata**:
  - `src/store/useItemsStore.js` - slice nou `multiTags[]` cu actiuni `addMultiTag`, `deleteMultiTag`, `incrementMultiTagUsage`, selector `getMultiTagsSorted` (frecventa DESC + newest-first).
  - `src/components/items/TagGroupsPicker.jsx` - prop nou `selectionMode`: checkboxes direct + footer Inapoi/Salveaza(N).
  - `src/components/items/MultiTagSheet.jsx` - componenta noua: step LIST (BottomSearch + lista + expand/vizualizare + delete confirmare + CTA); step PICK_TAGS (SWAP cu TagGroupsPicker selectionMode).
  - `src/pages/DashboardPage.jsx` - card separat MULTITAG (purple) + MultiTagSheet.
  - `src/pages/HomePage.jsx` - BUILD_WORD: macara, COMMIT_WORD: radar.

---
> - La fiecare sarcinã mãruntã/ajustare, agentul modificã codul ?i adaugã direct un nou bullet point în sec?iunea de sus `### [Commit c0c914b] — build: tramvai | commit: ciocan - implementare arhiva, mod selectie, etc
- **Ramurã**: rec-value
- **Data**: 2026-09-20
- **Descriere Detaliatã**:
  - **Mod selec?ie ?i Arhivare**: Adãugat flux complet de selec?ie multiplã (cu casete de bifare) în `ListPage.jsx` ?i FAB contextual. Func?ia de arhivare mutã elementele local în `archivedItems`.
  - **Pagina Arhivã**: Creatã pagina dedicatã `ArchivePage.jsx` cu op?iune de restaurare, accesibilã din meniul 3-dot al cardului Items din Dashboard.
  - **UI / UX Fixes**: Ajustat alinierea numericã la dreapta. Ajustat comportamentul TagSuggestionsPanel ?i hook-ul useAutocompleteGhost pentru a filtra elementele deja selectate în modul multi-select din PickerSheet.
  - **Header listã**: Adãugat calcul total (suma tuturor valorilor) în antet, atât pentru lista principalã, cât ?i pentru arhivã.

---

### [Commit 530fb49] — build: vulcan | commit: cactus - mutare optiuni selectie in meniu contextual bottombar
- **Ramurã**: rec-value
- **Data**: 2026-09-20
- **Descriere Detaliatã**:
  - **Meniu Contextual**: Am eliminat butonul fix de text "Selecteazã" care acoperea `BottomBar`-ul ?i l-am mutat într-un `BottomSheet` nativ.
  - **Arhitecturã BottomBar**: Am introdus starea `bottomBarMenuOverride` în `useAppStore` pentru a permite paginilor sã preia controlul asupra butonului ? (Menu) din dreapta jos.
  - La apãsarea pe meniul `BottomBar` în paginile `Items` ?i `Archive`, se deschide un meniu contextual dedicat cu op?iunile "Selecteazã" / "Anuleazã selec?ia" / "Selecteazã & recupereazã".

---

### [Commit 7769a65] — build: castor | commit: busola - tags-grup în items (rec-value).
- **Ramurã**: rec-value
- **Data**: 2026-09-22
- **Descriere Detaliatã**:
  - **Implementare modul Tag Groups (v2.3)**:
    - **`useItemsStore.js`**: Adãugat state `tagGroups` (array de foldere) ?i `tagGroupMembers` (map many-to-many groupId › string[]) cu persisten?ã automatã în localStorage. Metode CRUD: `addTagGroup`, `renameTagGroup`, `deleteTagGroup`, `associateTagsToGroups`, `createGroupWithTags`, `removeTagFromGroup`, `setGroupMembers`, `getGroupsForTag`.
    - **`TagGroupsPicker.jsx`** (nou): Componentã izolatã cu layout 2 coloane (Foldere stânga / Tag-uri dreapta). Suport dual-mode: `allowOrganize=false` (Read-Only — filtru vizual rapid, nicio muta?ie posibilã) ?i `allowOrganize=true` (modul complet — selec?ie multi-tag+folder, asociere many-to-many, creare folder nou). Cãutare sincronizatã prin BottomBar: la tastare, coloana stângã ascunde folderul „Toate" ?i afi?eazã doar foldere cu rezultate relevante.
    - **`ListPage.jsx`**: Adãugat import `Tag` din lucide-react + `TagGroupsPicker`. Adãugat state `tagsSheetOpen`. Adãugat butonul „Tags" (cu iconi?ã Tag) în ContextMenu existent. Integrat `TagGroupsPicker` ca `BottomSheet aboveBottomBar` cu `allowOrganize=true`.
    - **`SideMenu.jsx`**: Fãcut titlul „oneSku" buton interactiv care navigheazã la pagina principalã `/`.

---

### [Commit 2acbc10] — build: pian | commit: fular - ux/layout fixes tag groups (rec-value)
- **Ramurã**: rec-value
- **Data**: 2026-09-22
- **Descriere Detaliatã**:
  - **UX / Layout Fixes pentru TagGroupsPicker**:
    - Remediat un bug de CSS Flexbox (`flex-1 min-h-0` aplicat) care bloca posibilitatea de a face scroll în liste.
    - Convertit afi?area în `ListPage` la full-screen deasupra BottomBar-ului pentru maximizarea spa?iului (`h-[calc(100dvh-4rem)] max-h-none rounded-none`).
    - Mutatã logica de selec?ie în meniul contextual din BottomBar (`pushBottomBarOverride`) conform conven?iilor aplica?iei, cu un BottomSheet curat de ac?iuni.
    - Integrate butoanele de "Salveazã" / "Anuleazã" într-un footer fix în partea de jos a ferestrei (precum în `BaseFilterSheet`), eliberând complet header-ul.
    - Regula 7 (Artefacte cu referin?e la prompt) a fost adãugatã oficial în `GEMINI.md`.

---

### [Commit 41eebb4] — build: umbrelã | commit: oglindã - bug fixes TagGroupsPicker
- **Ramurã**: rec-value
- **Data**: 2026-09-22
- **Descriere Detaliatã**:
  - **Bug Fixes la TagGroupsPicker**:
    - **Meniu contextual**: Am fixat ordinea de aplicare a `pushBottomBarOverride` dintr-un `BottomSheet` imbricat (folosind `setTimeout`), restabilind iconi?a ? care era ascunsã de pãrinte.
    - **Cãutare Tags**: Schimbat filtrarea tag-urilor din `.includes()` în `.startsWith()` pentru a respecta regula de cãutare pe prefix.
    - **Autocomplete**: Instan?iat hook-ul `useAutocompleteGhost` în `TagGroupsPicker`, activând afi?area textului gri predictiv din `BottomBar` în timpul cãutãrii.

---

### [Commit 41eebb4] — build: cire? | commit: rachetã - ux/ui improvements tag groups
- **Îmbunãtã?iri UX / UI TagGroupsPicker**:
  - **Iconi?ã BottomBar**: Trimisã instan?a componentei `AlignLeft` în loc de string, restabilind vizibilitatea iconi?ei Meniu.
  - **Folder Nou**: Mutat butonul "+ Folder nou" în partea de sus a listei din stânga (sub header), apãrând dinamic când existã tag-uri selectate, pentru a nu mai fi ascuns sub footer.
  - **Curã?are Header**: ?tearsã linia de text albastru inutilã cu "3 tag-uri selectate" pentru a maximiza spa?iul.
  - **Tag-uri Pinned**: În coloana din dreapta, elementele bifate sunt grupate acum în partea de sus a listei, separate vizual de celelalte, uniformizând comportamentul cu cel de la filtre.

---

### [Commit 7036f71] — build: ocean | commit: baterie - faithful UX refactor tag groups picker
- **Ramurã**: rec-value
- **Data**: 2026-09-22
- **Descriere Detaliatã**:
  - **Refactorizare fidelã UX TagGroupsPicker**:
    - **Filtre Active (Tag-uri fixate)**: Rescris containerul din coloana dreaptã pentru a replica fidel vizualul ?i comportamentul de acordeon (`isPinnedCollapsed`) din componenta `BaseFilterSheet`, incluzând butonul de debifare rapidã (`RotateCcw`).
    - **FAB & Modal Folder**: ?ters complet input-ul inline de creare folder. Adãugat un FAB (Floating Action Button) deasupra listei din stânga. La click, se deschide un modal (Dialog) izolat, pe ecran complet (`z-[100]`), clar, cu butoane dedicate Anuleazã/Salveazã.

---

### [Commit f911f3d] — build: cernealã | commit: aripã - fix TagGroupsPicker active tags behavior
- **Ramurã**: rec-value
- **Data**: 2026-09-23
- **Descriere Detaliatã**:
  - **TagGroupsPicker Active Filters Fix**: ?tearsã condi?ia de filtrare care ascundea tag-urile din lista principalã atunci când acestea erau bifate. Acum, elementele bifate urcã în panoul de tag-uri fixate din partea de sus, dar rãmân vizibile (?i marcate ca bifate) ?i în pozi?ia lor originalã din listã, men?inând astfel un comportament identic (1:1) cu cel al `BaseFilterSheet` pentru consisten?ã de UX.
  - **Documenta?ie UI Componente**: Creat fi?ierul `docs/componente.md` care centralizeazã ?i explicã comportamentul vizual ?i interactiv al tuturor componentelor React (Shell, Catalog, StockHub, etc.) din aplica?ie.
  - **Actualizare reguli AGENT (GEMINI.md)**: Adãugat Regula 8 (`MOD REMOTE ON / OFF PROTOCOL`).

---

### [Commit telescop] — build: telescop | commit: bilet - implementare mod scoate in tag groups picker
- **Ramurã**: rec-value
- **Data**: 2026-09-23
- **Descriere Detaliatã**:
  - **Meniu de Organizare**: Înlocuit butonul simplu „Selecteazã” cu meniul complet „Organizare” având op?iunile „Adaugã” ?i „Scoate”.
  - **Modul Scoate**: Implementatã o func?ionalitate intuitivã de eliminare a tag-urilor. Când modul „Scoate” este activat, navigarea prin foldere din coloana stângã rãmâne exact ca în varianta Read-Only, dar în coloana dreaptã tag-urile primesc checkbox-uri ro?ii. Utilizatorul navigheazã într-un folder, bifeazã tag-urile pe care vrea sã le elimine ?i apasã „Aplicã eliminarea”. Acestea sunt ?terse imediat din folderul respectiv, fãrã a fi ?terse din vocabularul „Toate” sau din alte foldere.
  - Adãugatã metoda eficientã `removeTagsFromGroup` în `useItemsStore.js`.

---

### [Commit 21941cc] - build: copac | commit: minge - iconita skip pentru salvare incompleta
- Inlocuit iconita 'MoreHorizontal' (...) cu 'FastForward' la butonul de salvare portocaliu (draft/incomplet) pentru a reflecta mai bine intentia utilizatorului de a da skip detaliilor curente.

---

### [Commit Pending]
- 

---

### [Commit 21941cc] - build: metrou | commit: castravete - Adaugare modul Import/Export in Dashboard
- Adãugat modul de Import / Export pentru items ?i tags în `DashboardPage.jsx`.
- Adãugatã metoda `importBackup` în `useItemsStore` pentru preluarea datelor dintr-un backup JSON.

---

### [Commit bd22e8c] - build: vapor | commit: scaun - remove tags cancel button
- Eliminat butonul x (cancel) de pe tag-urile din Items, astfel incat modificarea lor se face doar prin dialogul dedicat.

---

---

### [Commit 5b23ff1] - build: corabie | commit: pat - adaugare butoane MultiTag in ItemFormSheet
- Adaugat buton MultiTag manager pe linia etichetei Tags.
- Adaugat buton de aplicare MultiTag (PickerSheet cu single-select) in dreapta inputului de tags.

---

### [Commit 1a7f105] - build: palarie | commit: foc - modificare afisare tags in linie cu contor
- Schimbat afisarea individuala a tag-urilor pe mai multe linii intr-o singura linie simpla, cu afisare tip contor 'x taguri'.

---

### [Commit 322cb6f] - build: abanos | commit: harpa - redesign card Items cu data sticky WhatsApp-style
- Reconfigurat layout card: suma (stanga), descriere pe 2 randuri (centru), ora izolata (dreapta sus).
- Sters afisarea tag-urilor direct din lista pentru curatenie vizuala.
- Implementat separator date sticky top, care face fade-out cand utilizatorul nu mai face scroll, exact ca in chats-urile WhatsApp.

---

### [Commit f1cfbac] - build: vulcan | commit: lac - fixare sticky date dual
- S-a separat badge-ul de date in doua elemente diferite: unul inline static care separa vizual grupurile (pe un fundal albastru inchis), si unul plutitor (sticky) care se suprapune fix peste cel static si devine vizibil doar la scroll.

---

### [Commit 6859aa9] - build: ciocan | commit: caiet - blurare tastatura la selectia de tag-uri in lista
- Adaugat document.activeElement?.blur() in functia handleTagSelect din ListPage pentru a forta ascunderea tastaturii cand utilizatorul alege un tag (prin tap sau autocomplete).

---

### [Commit 34fac80] - build: biscuit | commit: lemn - stare incomplet items
- Adaugat buton portocaliu cu puncte de suspensie si buton discheta in formularul items pentru marcarea rapida ca nefinalizat / salvare instanta.
- Valorile elementelor incomplete sunt afisate cu portocaliu strident in lista si detalii.

---

### [Commit 7f2f4d4] - build: balon | commit: creion - fast save logic formular items
- Schimbat comportamentul butonului portocaliu din simplu toggle intr-un buton de save fast (salveaza ca incomplet si inchide).
- Butonul de langa el (si cel de jos) salveaza elementul ca finalizat si inchid.

---

### [Commit 9deb146] - build: foarfece | commit: lampa - fix salvare isIncomplete in useItemsStore
- Am reparat bug-ul prin care starea de isIncomplete era aruncata (discarded) la nivelul stocarii (Zustand store). Acum campul este salvat corect in DB-ul local, ceea ce activeaza corect culoarea portocalie pe carduri si pastreaza memoria starii pentru formular.

---

### [Commit b832cda] - build: cascada | commit: strugure - ui active tags in pickersheet
- Adaugat modul vizual (pills) pentru tag-uri active in header-ul de la PickerSheet.
- Permite eliminarea rapida a tag-urilor bifate direct din panoul superior, fara a le mai cauta in lista.
- Modificat design-ul butonului de Salvare pentru cazul selec?iei de tag-uri (albastru inchis, icon Save, text Tags).

---

### [Commit 2c33e65] - build: plasa | commit: cravata - active tags collapsible in pickersheet
- Transformare panou tag-uri active din PickerSheet in modul extensibil/colapsibil cu toggle button (Chevron).
- Setat max-height cu overflow-y-auto pentru a permite scroll-ul cand sunt selectate foarte multe etichete fara a bloca restul continutului.

---

### [Commit 098e33b] - build: baterie | commit: covor - smart header active tags
- Unificat titlul formularului PickerSheet cu numaratorul de tag-uri active intr-un singur buton header.
- Numarul de tag-uri active este acum mult mai vizibil (font mai mare, bold, alb puternic).
- Daca nu sunt tag-uri selectate, se afiseaza doar titlul simplu.

---

### [Commit 85f6f5c] - build: cleste | commit: ghiozdan - auto scroll taguri active
- Limitare inaltime modul tag-uri active la max 110px (~3 randuri).
- Implementat logica de auto-scroll (smooth) la ultimul rand adaugat folosind useRef, astfel incat vizibilitatea sa ramana perfecta indiferent de numarul tag-urilor.

---

### [Commit 53d4199] - build: pahar | commit: sertar - floating scroll footer tags picker
- Transformare layout intern PickerSheet in flex-1 min-h-0 pentru a nu mai impinge footer-ul in afara ecranului la rezolutii mici/zoom.
- Footer-ul (Anuleaza / Salveaza) pozitionat absolut la baza Bottom Sheet-ului (lipit cu background semitransparent).
- Adaugat comportament WhatsApp: footer-ul se ascunde fluid in timpul derularii listei de optiuni, eliberand ecranul, si reapare automat cand scroll-ul se opreste.

---

### [Commit 68db3ae] - build: banca | commit: telefon - slim footer in pickersheet
- Micsorat inaltimea butoanelor din footer (de la h-11 la h-9) si padding-ul containerului (de la py-3 la py-2).
- Redusa dimensiunea iconitei Save (de la 18px la 16px) pentru a se potrivi cu noile butoane compacte (70% din marimea initiala).

---

### [Commit 13391ca] - build: strugure | commit: fereastra - bottombar secondary action save
- Arhitectura hibrida: eliminat complet footer-ul absolut plutitor din PickerSheet (acoperind ecranul).
- Butoanele de Salvare/Anulare au fost mutate ca ultimul element in lista, derulandu-se firesc (fara a bloca spatiul vizual).
- Creat mecanismul 'bottomBarSecondaryAction' in useAppStore pentru a injecta un buton de fast-save (Discheta albastra) direct in BottomBar, langa X.
- Ingustat usor butonul de 'Menu Override' (X) din dreapta in BottomBar (de la w-10 la w-8) pentru a optimiza spatiul pentru noul buton de Salvare.

---

### [Commit dc342e5] - build: soare | commit: castel - click direct pe editare item incomplet
- Cand un element din lista globala este incomplet (isIncomplete = true, text portocaliu), un click pe el deschide direct formularul de editare (ItemFormSheet), sarind peste modul de vizionare (ItemDetailSheet).
- Elementele finalizate raman cu comportamentul curent (deschid intai ItemDetailSheet).

---

### [Commit 21941cc] - build: copac | commit: minge - iconita skip pentru salvare incompleta
- Inlocuit iconita 'MoreHorizontal' (...) cu 'FastForward' la butonul de salvare portocaliu (draft/incomplet) pentru a reflecta mai bine intentia utilizatorului de a da skip detaliilor curente.

---

### [Commit Pending]
- 

---

### [Commit 21941cc] - build: metrou | commit: castravete - Adaugare modul Import/Export in Dashboard
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 

*(Not? pentru agent: Adaug? urm?torul commit deasupra acestei linii)*


