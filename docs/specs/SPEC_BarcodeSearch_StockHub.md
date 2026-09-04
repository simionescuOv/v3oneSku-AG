# SPEC: Barcode Search in StockHub — Ierarhie Spații

**Status:** IMPLEMENTAT  
**Prioritate:** Medie  
**Dependință:** `SPEC_BarcodeSearch_Catalog.md` (implementat)

---

## Problema

Când utilizatorul scanează un barcode din `StockHubPage` sau `SpacePage`, trebuie să poată localiza instantaneu în ce spații se află fizic acel produs și care sunt stocurile aferente, fără a naviga manual prin fiecare spațiu în parte. Mai mult, experiența de vizualizare trebuie să fie bogată vizual (utilizând cardul produsului) și stabilă navigațional (păstrând rezultatele la întoarcere).

---

## Comportament Planificat

La scanarea unui barcode din modulul StockHub, panoul de rezultate (sau un ecran modal/overlay dedicat) va afișa o **ierarhie de spații** în care a fost găsit produsul (sau, eventual, toate spațiile, cu stoc zero pentru cele în care lipsește). 

Pentru a oferi flexibilitate maximă de navigare, fiecare rezultat afișat va combina titlul/chip-ul spațiului cu cardul vizual al produsului, permițând acces direct în ambele pagini:

- **Tap pe Numele/Linkul Spațiului**: Deschide direct pagina spațiului respectiv (`SpacePage`).
- **Tap pe Cardul Produsului**: Deschide direct fișa detaliată a produsului (`ProductPage`), contextualizată pe acel spațiu.

### Exemplu conceptual UI:

```text
📦 Barcode: 1234567890123

🔗 [Depozit Principal]  ---> (Tap: navighează la SpacePage)
<ProductCard product={produs} meta="Stoc: 12 buc" />  ---> (Tap: navighează la ProductPage)

🔗 [Magazin 1]  ---> (Tap: navighează la SpacePage)
<ProductCard product={produs} meta="Stoc: 3 buc" />  ---> (Tap: navighează la ProductPage)

🔗 [Magazin 2]  ---> (Tap: navighează la SpacePage)
<ProductCard product={produs} meta="Stoc: 0 buc" opacity="50%" />  ---> (Tap: navighează la ProductPage)
```

### Navigare și Persistență a Stării (Regula de Back)

1. **Puncte Duble de Navigare**:
   - **Click/Tap pe Titlul Spațiului**: Navighează direct la pagina spațiului (`SpacePage`).
   - **Click/Tap pe Cardul Produsului**: Navighează la pagina produsului (`/catalog/product/:nameId`), transmitând ID-ul spațiului în stare (`{ state: { sourceSpaceId } }`) conform convenției `ARCH_ProductNavigation`.
2. **Persistența Căutării**: Starea căutării (overlay-ul/lista cu ierarhia spațiilor) **nu** trebuie să fie distrusă la această navigare.
3. **Întoarcerea (Gestul Back)**: Când utilizatorul apasă tasta Back (fizică sau din UI) pentru a părăsi fișa produsului sau pagina spațiului, el trebuie să fie readus **exact în lista rezultatelor de scanare**, putând să continue inspecția (ex: să apese pe al doilea spațiu, "Magazin 1"). Aceasta funcționează similar cu persistența `productFormDraft` la inspecția coliziunilor din Catalog.

---

## Implicații Arhitecturale: Șabloane de Carduri (Future Proofing)

Componenta `<ProductCard />` va fi în curând refactorizată pentru a suporta **Șabloane Configurabile (Dynamic Templates)** (vezi `SPEC_ConfigurableProductCards.md`). 

Prin refolosirea strictă a componentei `<ProductCard />` în această ierarhie de scanare, funcționalitatea de căutare StockHub devine *future-proof*. În momentul în care motorul de template-uri va fi gata, lista de rezultate ale scanării se va deforma și se va adapta instantaneu la preferințele de vizualizare curente ale utilizatorului (cu poză, fără poză, fonturi mari/mici), fără nicio modificare la nivelul logicii de scanare.

---

## Implementare Necesară

### 1. `useStockStore.js`
- Funcție derivată: `getSpacesForBarcode(barcode)` — caută local produsul cu acel barcode și returnează lista de spații + cantitate curentă (ținând cont de structura viitoarelor stocuri locale).

### 2. `useAppStore.js`
- Stare persistentă pentru modul de scanare StockHub, decuplată logic de unmount-ul rapid, pentru a supraviețui navigării `pushState` / react-router.

### 3. UI Randare
- Un overlay sau vizualizare (`StockHubBarcodeResults`) care ciclează prin spațiile găsite și randează `<ProductCard>` trecând o componentă/text custom în prop-ul `meta` (ex: cantitatea).
- Stoc zero va forța un opacity redus sau o afișare atenuată.

### 4. Rutare
```js
// Navigare către vizualizarea detaliului cu reținerea sursei:
navigate('/catalog/product/' + encodeURIComponent(nameId), {
  state: { sourceSpaceId: space.id }
})
```
