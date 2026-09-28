Salut! Vreau să implementăm un sistem de filtrare pentru secțiunea "Flux" (istoricul de tranzacții) din cadrul unui Space (sau la nivel global de StockHub) în această aplicație React/Zustand. 

Aplicația are deja un sistem de filtrare foarte avansat și performant construit pentru "Catalog" (produse). Vreau să analizezi acel sistem existent pentru a-i înțelege arhitectura (separarea UI de logica de date) și să construiești o soluție similară, dar adaptată pentru entități de tip "Tranzacție", refolosind componentele vizuale existente.

Te rog să începi prin a citi și analiza următoarele fișiere, în această ordine:

### 1. Sistemul curent de filtrare (Catalog) - Pentru arhitectură și UI
Citește aceste fișiere ca să înțelegi cum funcționează filtrarea curentă:
- `src/lib/filterEngine.js` -> Aici este logica matematică/algoritmii de filtrare și calcul fațete bazați pe indici.
- `src/components/catalog/BaseFilterSheet.jsx` -> Este componenta UI "dumb" (pur vizuală). Aceasta TREBUIE refolosită exact așa cum este pentru noul filtru de Flux.
- `src/components/catalog/FilterSheet.jsx` -> Este componenta "smart" (adapter-ul) care leagă `BaseFilterSheet` de datele din catalog. Aici vei vedea cum se trimit dimensiunile (dimensions), cum se rețin filtrele active (draftFilters) și cum se calculează numărul de elemente per opțiune.
- `src/store/useCatalogStore.js` -> (doar secțiunile legate de `filterIndices` și `products` ca să înțelegi sursa de date pentru `FilterSheet`).

### 2. Secțiunea Flux (Ținta noii implementări)
Acum citește fișierele unde va trebui să adăugăm noul sistem:
- `src/store/useStockStore.js` -> Caută funcția `fetchSpaceTransactions`. Aici se aduc tranzacțiile din baza de date Supabase și se formatează sub formă de blocuri de Flux.
- `src/components/stockhub/FluxFeed.jsx` -> Componenta care randează lista efectivă a tranzacțiilor primite din store.
- `src/pages/SpacePage.jsx` -> Pagina care leagă logica; aici se află starea `view === 'flux'`, aici se apelează `fetchSpaceTransactions` și aici va trebui probabil integrat noul `FluxFilterSheet`.

### Context și Constrângeri Arhitecturale (Trade-offs importante):
1. **Nu putem refolosi direct `FilterSheet.jsx`**: Acel fișier este cuplat strict pe tipul de date "Product" și atribute de catalog. Fluxul conține "Tranzacții" (atribute: direcție intrare/ieșire, dată, spațiu sursă/destinație).
2. **Asimetria Datelor**: În `fetchSpaceTransactions`, interogarea Supabase aduce `product_id` din `transaction_items`, dar în acest moment se mapează și se trimite spre UI doar `name_id` (numele produsului) și `qty`. Pentru a putea filtra tranzacțiile după produs, va trebui să modifici această mapare pentru a reține array-ul de `product_id`-uri reale în cadrul fiecărei tranzacții.
3. **Obiectivul tău**: Trebuie să creezi o nouă componentă "smart" (ex: `FluxFilterSheet.jsx`) care să instanțieze `BaseFilterSheet.jsx`, dar care să definească propriile dimensiuni (ex: "Data", "Tip Transfer", "Conține Produs") și să aplice filtrarea array-ului de tranzacții din memorie, returnând lista (sau ID-urile) tranzacțiilor care îndeplinesc condițiile, pentru a actualiza afișarea din `FluxFeed.jsx`.

Te rog să îmi confirmi când ai terminat de citit și analizat aceste fișiere, și să îmi propui sumar un plan de atac. Fără execuție de cod (doar plan) până nu îți confirm.