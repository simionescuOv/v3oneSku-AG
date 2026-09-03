# SPEC: Configurable Product Cards (Dynamic UI Rendering)

**Status:** VIZIUNE ARHITECTURALĂ — neimplementat  
**Prioritate:** Scăzută / Viitor  
**Dependință:** Structura curentă `ProductCard.jsx` și Schema Categoriilor

---

## Viziunea Produsului (User Story)

Utilizatorul aplicației va avea posibilitatea de a configura modul în care sunt afișate cardurile produselor în liste (ex: pagini de categorii, liste de spații, rezultate scanare).

În loc ca interfața să aibă un singur design fix, utilizatorul va putea defini și salva mai multe **Șabloane (Templates)**. 
De exemplu:
- *Template Depozit*: Fără poză, font mare pentru stoc, format compact.
- *Template Showroom*: Poză mare în stânga, font mare pentru numele produsului și preț.
- *Template Inventar*: Aliniere specifică pentru vizibilitate optimă la scanare.

Utilizatorul va putea comuta între aceste șabloane oricând, în funcție de ocazie, iar aplicația se va adapta instantaneu, modificând structura vizuală a tuturor cardurilor de produse aflate pe ecran.

---

## Concepte Arhitecturale (React + Zustand)

Această funcționalitate se bazează pe avantajele ecosistemului React (UI condus de date) și Zustand (managementul stării globale).

### 1. Stocarea Configurației (Șabloane)
Șabloanele create vor reprezenta obiecte JSON care descriu regulile de randare (ex: `showPhoto: boolean`, `titleSize: 'sm' | 'lg'`, `metaAlignment: 'left' | 'right'`).
Acestea vor fi stocate în baza de date (Supabase) per Tenant/Utilizator și sincronizate local în starea globală (ex: `useUiStore`).

### 2. Motorul de Randare (`ProductCard.jsx`)
Componenta actuală `ProductCard` va înceta să mai fie o interfață statică. Ea va fi refactorizată într-un motor inteligent de randare:
- Va citi șablonul activ din `useUiStore.getState().activeCardTemplate`.
- Va folosi renderizare condiționată și clase dinamice de Tailwind CSS pentru a construi DOM-ul în concordanță cu regulile din șablon.
- Fiind abonată la starea globală Zustand, schimbarea șablonului de către utilizator va declanșa **o re-randare instantanee a tuturor cardurilor** (zero latență, fără reload).

### 3. Moștenirea Universală (DRY Principle)
Componenta `<ProductCard />` este folosită unitar peste tot în aplicație:
- `CategoryPage` (lista de produse)
- `ProductFormSheet` (vizualizare duplicat coliziune)
- `StockHubBarcodeResults` (rezultatele scanării în spații)
- Posibil și în fluxul de tranzacții.

Prin modificarea exclusivă a logicii interne a `<ProductCard />`, **toate modulele aplicației vor suporta instantaneu** această viziune de UI dinamic, respectând perfect principiul DRY (Don't Repeat Yourself). Orice modul nou dezvoltat (cum ar fi scanarea în StockHub) este future-proof automat dacă refolosește această componentă.

---

## Etape de Implementare (Când va fi cazul)

1. **Modelare DB:** Adăugare suport pentru salvarea structurilor JSON de șabloane per utilizator/tenant.
2. **Store UI:** Extindere `useUiStore` pentru a ține șablonul activ.
3. **Refactor `ProductCard`:** Parsarea regulilor JSON și scrierea logicilor condiționate Tailwind (ex: flex-col vs flex-row, text-xl vs text-sm).
4. **Interfață de Configurare:** Un formular/editor unde utilizatorul își compune și testează (live-preview) cardul dorit, cu opțiunea de a salva rezultatul.
