# SPEC: Barcode Search in StockHub — Ierarhie Spații

**Status:** PLANIFICAT — neimplementat  
**Prioritate:** Medie  
**Dependință:** `SPEC_BarcodeSearch_Catalog.md` (implementat)

---

## Problema

Când utilizatorul scanează un barcode din `StockHubPage`, comportamentul actual (copiat de la Catalog) afișează pagina globală de rezultate categorie→produs. Aceasta nu oferă informații despre **unde anume** (în ce spații) se află produsul în stoc.

---

## Comportament Planificat

La scanarea unui barcode din `StockHubPage`, rezultatul afișează o **ierarhie de spații**:

```
📦 Barcode: 1234567890123
   Lavazza Espresso — Cafele

  └─ Depozit Principal   stoc: 12 buc   [Deschide în spațiu →]
  └─ Magazin 1           stoc:  3 buc   [Deschide în spațiu →]
  └─ Magazin 2           stoc:  0 buc   (stoc zero, afișat atenuat)
```

Fiecare link navighează la `ProductPage` cu `{ state: { sourceSpaceId } }` injectat (conform `ARCH_ProductNavigation`).

---

## Implementare Necesară

### 1. `useStockStore.js`
- Funcție derivată: `getSpacesForBarcode(barcode)` — caută local în `stocks[]` produsul cu acel barcode și returnează lista de spații + cantitate curentă.

### 2. `useAppStore.js`
- Extindere `activateBarcodeScan(code, context)` — parametru opțional `context: 'catalog' | 'stockhub'` pentru a diferenția comportamentul de randare.

### 3. `StockHubPage.jsx` sau pagină dedicată rezultate
- Ramură de randare `barcodeScanMode && context === 'stockhub'` — afișează ierarhia spații.
- Produsele cu stoc zero se afișează atenuat, la finalul listei.

### 4. Navigare
```js
navigate('/stockhub/space/' + spaceId + '/product/' + nameId, {
  state: { sourceSpaceId: spaceId }
})
```

---

## Note

- Nu necesită modificări DB sau RPC — toate datele vin din cache-ul local Zustand (`useStockStore`).
- Comportamentul din `CatalogPage` (exact match pe `barcode`) rămâne neschimbat.
- Această funcționalitate se poate implementa independent, fără a atinge codul existent al scanner-ului.
