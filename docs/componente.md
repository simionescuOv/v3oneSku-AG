# Documentație Componente UI (`oneSku`)

Această pagină descrie componentele principale ale aplicației și comportamentul lor vizual și interactiv.

## 1. Shell Components (Structura generală a aplicației)
Aceste componente construiesc scheletul aplicației și se ocupă de navigare, layout și layere globale.

* **AppShell.jsx**
  * **Rol**: Este containerul rădăcină (wrapper) pentru întreaga interfață.
  * **UI**: Susține rutele, suprapune meniul lateral, și include barele de sus și de jos. Tot ce vede utilizatorul trece prin acest "înveliș".
* **BottomBar.jsx**
  * **Rol**: Bara de unelte din partea de jos, principalul mijloc de interacțiune.
  * **UI**: Conține un câmp de căutare (care afișează sugestii de tip "ghost text"), un buton de filtrare, un buton pentru activarea scanerului de coduri de bare, și un buton contextual pentru meniu. Apăsarea pe meniu deschide panouri contextuale (ex: Drawer-ul principal, Filtre, Acțiuni pe listă).
* **TopBar.jsx**
  * **Rol**: Header-ul aplicației.
  * **UI**: Minimalist, de obicei afișează doar logo-ul `oneSku` și doar pe pagina de pornire (Home). În restul paginilor este ascuns.
* **MainContent.jsx**
  * **Rol**: Containerul unde este injectat conținutul dinamic (paginile).
  * **UI**: Se ocupă de padding-ul necesar pentru ca elementele paginilor să nu fie acoperite de `BottomBar` și `TopBar`.
* **SideMenu.jsx**
  * **Rol**: Meniul lateral (Drawer / Hamburger menu).
  * **UI**: Apare printr-o animație de culisare din partea stângă peste conținut. Conține navigația principală (Home, Catalog, StockHub, Archive, Settings, etc.).
* **ContextMenu.jsx**
  * **Rol**: Un meniu de tip foaie (Bottom Sheet) pentru acțiuni specifice.
  * **UI**: Se ridică de jos și prezintă butoane de acțiune specifice paginii curente (de exemplu selecție multiplă, accesare filtre sau setări de elemente).
* **ScannerOverlay.jsx**
  * **Rol**: Interfața pentru cititorul de coduri de bare folosind camera dispozitivului.
  * **UI**: Acoperă ecranul complet cu o mască semi-transparentă și o "țintă" (reticul) în centru, indicând utilizatorului să încadreze codul de bare.

## 2. Paginile Aplicației (Pages)
Acestea reprezintă vederile (views) asociate cu rutele URL.

* **HomePage.jsx** (`/`)
  * **UI**: Pagină de aterizare (landing) simplă care poate oferi statistici sumare, butoane rapide și un identificator pentru dezvoltatori (Build Word).
* **CatalogPage.jsx** (`/catalog`)
  * **UI**: Afișează structura principală de foldere / categorii a catalogului de produse. Apăsarea pe o categorie navighează mai adânc sau deschide o listă de produse.
* **CategoryPage.jsx** (`/catalog/category/:id`)
  * **UI**: Afișează produsele aferente unei categorii sub formă de listă (cu `ProductCard`). Oferă filtrare prin `BottomBar`.
* **ProductPage.jsx** (`/catalog/product/:nameId`)
  * **UI**: O vizualizare detaliată a unui singur produs. Prezintă atribute, prețuri, cod de bare, istoricul mișcărilor (stocului) și un buton mare "Adaugă în coș".
* **CartPage.jsx** (`/cart`)
  * **UI**: Coșul de operațiuni stoc. Utilizatorul alege un "Sursă" și o "Destinație" (spații fizice, gestiuni), vede lista de produse adăugate, și poate modifica cantitățile înainte de a aproba mutarea stocului.
* **StockHubPage.jsx** (`/stockhub`)
  * **UI**: Centrul de control al stocurilor. Afișează un "FluxFeed" global (istoric) și lista cu gestiunile/locațiile disponibile.
* **SpacePage.jsx** (`/stockhub/space/:spaceId`)
  * **UI**: Arată conținutul unui singur spațiu fizic (gestiune). Listează produsele și cantitățile existente acolo.
* **ListPage.jsx** / **ArchivePage.jsx** (`/items`, `/archive`)
  * **UI**: Listează item-uri sau tag-uri cu suport pentru acțiuni de editare și selectare (checkbox-uri la stânga fiecărui element vizibile în modul de organizare). Oferă recuperare sau ștergere.
* **AccountPage.jsx** & **SettingsPage.jsx**
  * **UI**: Formulare standard pentru actualizarea informațiilor despre cont și preferințe de sistem.
* **DashboardPage.jsx**
  * **UI**: Pagină cu KPI-uri, indicatori financiari / de stoc și un sumar al stării aplicației.
* **StorefrontPage.jsx**
  * **UI**: Pagină potențial B2B/Client-facing pentru plasare de comenzi rapide sau răsfoirea catalogului într-un mod prietenos clienților.

## 3. Catalog Components (Gestionarea Produselor)
* **ProductCard.jsx**
  * **UI**: Elementul vizual pentru un produs dintr-o listă. Afișează titlul, iconiță de pachet, metadate și un buton (🛒) pentru a fi adăugat rapid în coș fără a intra pe pagina de detalii.
* **NodeCard.jsx**
  * **UI**: Reprezintă un element ierarhic tip folder sau subgrup. Arată ca o bară orizontală care poate fi selectabilă. Apăsarea pe el duce la nivelul următor din ierarhie.
* **BottomSheet.jsx** (Generic)
  * **UI**: O fereastră cu fundal întunecat care glisează dinspre partea de jos a ecranului (modal non-distructiv). Folosit extensiv pentru filtre, selectoare, formulare.
* **FilterSheet.jsx** & **BaseFilterSheet.jsx**
  * **UI**: Un panou de tip Bottom Sheet unde utilizatorul bifează atribute, alege limite de preț sau alte criterii. La confirmare, lista de produse se re-randează. Elementele active (selectate) sunt "pinned" (agățate) în partea de sus.
* **DestinationPicker.jsx** & **PickerSheet.jsx**
  * **UI**: Implementează "Picker v2". Utilizatorul apasă un buton, iar un bottom sheet se ridică pentru a-i prezenta o listă de selecție (ex: Destinația în CartPage). Acestea înlocuiesc complet selecturile native HTML `<select>`.
* **ProductFormSheet.jsx**
  * **UI**: Un formular care glisează de jos, cu inputuri de text (Nume, Preț, Cod) folosite la crearea/editarea rapidă a unui produs.
* **GroupNameSheet.jsx** / **SubgroupSheet.jsx**
  * **UI**: Modale similare pentru redenumirea sau crearea de foldere noi în catalog.
* **SchemaSheet.jsx**
  * **UI**: Panou unde administratorul poate defini "ce tip de atribute (culoare, greutate)" va avea o anumită categorie.
* **ActionBar.jsx**
  * **UI**: Bară secundară ce poate apărea sub TopBar (sau lipită de lista) cu butoane suplimentare, în special când sunt selectate mai multe produse (bulk actions).

## 4. Items & Tags Components
* **TagGroupsPicker.jsx**
  * **UI**: O fereastră BottomSheet cu o schemă dinamică (două coloane: foldere stânga, taguri dreapta). Permite o navigare fluidă. Când utilizatorul tastează în BottomBar, coloana din stânga filtrează folderele. Dispune și de un "Floating Action Button" (+) pentru crearea de noi foldere.
* **TagSuggestionsPanel.jsx**
  * **UI**: Listă derulantă de sugestii care apare deasupra `BottomBar`-ului în momentele în care utilizatorul editează proprietățile unui produs, autocompletând etichete existente.
* **ItemDetailSheet.jsx** / **ItemFormSheet.jsx**
  * **UI**: Modale similare cu cele de produs, dar specifice modificării atributelor generice ale entităților (items, categorii).

## 5. StockHub Components (Management Stoc)
* **FluxFeed.jsx**
  * **UI**: O vizualizare cronologică (timeline) a mișcărilor. Fiecare rând descrie "X unități mutate de la A la B" însoțite de marcaje temporale.
* **FluxFilterSheet.jsx**
  * **UI**: Panou (Bottom Sheet) dedicat restrângerii mișcărilor de feed (pe zile specifice, spații, sau tipuri de mutări).
* **SpaceProductCard.jsx**
  * **UI**: Variante ale `ProductCard`, dar optimizate pentru afișarea stocului disponibil în interiorul unui depozit specific, indicând clar cantitatea pe care acel spațiu o găzduiește.
* **StockHubBarcodeResults.jsx**
  * **UI**: Afișează instant o listă de rezultate (produse / locații) care corespund codului de bare scanat.

## 6. Shared Components
* **HierarchyTree.jsx**
  * **UI**: O hartă vizuală care desenează un arbore interactiv. Este folosit pentru a vizualiza de la distanță "părinții" și "copiii" diferitelor subgrupe din catalog.
