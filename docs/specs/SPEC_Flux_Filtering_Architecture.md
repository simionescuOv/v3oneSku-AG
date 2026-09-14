# SPEC: Flux Filtering Architecture — Working Window + Smart Routing

> **Status:** v2 — rescriere completă (sept. 2026). Înlocuiește v1.
> **Sursa deciziilor:** Architecture Review + Interview Design (sept. 2026).
> **Scope:** Exclusiv tab-ul „Flux" (istoricul tranzacțiilor unui Space). Tab-ul „Stoc" rămâne 100% Local-First conform `SPEC_Space_Filtering_Architecture.md` §1–§2 și `SPEC_LocalFilter_v3.md`.

---

## 1. Contextul și problema

Tab-ul **Flux** al unui Space reprezintă registrul complet al mișcărilor de marfă (intrări, ieșiri, transferuri). Spre deosebire de Catalogul de produse (populație finită, câteva mii de SKU-uri), Fluxul este **time-series**: crește nelimitat în timp.

**Constrângerile care determină arhitectura:**
1. Utilizatorul gândește în **perioade** ("luna trecută"), nu în limite tehnice ("ultimele 50 înregistrări").
2. Activitatea recentă trebuie să funcționeze **offline** (operare în teren fără internet).
3. Nu se poate descărca tot istoricul în RAM — atât din motive de memorie (V8/browser), cât și de bandă (utilizatori cu date mobile).
4. Utilizatorul nu este **niciodată restricționat** în ce perioadă poate interoga — primește mereu datele cerute, indiferent de volum.
5. Dacă e offline și datele cerute nu sunt disponibile local, utilizatorul este **informat explicit** — nu i se afișează silențios date parțiale.

---

## 2. Arhitectura în 3 straturi

### Stratul 1 — Working Window (Local, Offline-First)

La **pornirea fiecărei sesiuni**, aplicația aduce automat un subset de tranzacții recente.

**Definiție:** `Working Window = cele mai recente N tranzacții, unde N ≤ THRESHOLD (2.000)`

Nu există o perioadă de timp fixă. Perioada acoperită este un **rezultat**, nu un input — depinde de volumul de activitate al tenantului:
- Tenant cu 2.000 tranzacții/zi → Working Window acoperă ~1 zi
- Tenant cu 20 tranzacții/lună → Working Window acoperă ~8 luni

**Stocare:** array în Zustand (`workingWindow[]`) — RAM, fără persistență între sesiuni.

**Comportament offline:** Orice filtru aplicat pe date din Working Window funcționează 100% local, fără internet, cu latență zero.

**Actualizare Working Window — Delta-fetch după commitCart:**

La `commitCart` success, nu se face re-fetch complet. Se aduc doar tranzacțiile noi:

```js
// Delta-fetch bazat pe created_at
// IMPORTANT: transaction_id e UUID v4 (aleator, non-ordered) — NU poate fi cursor
.from('transactions')
.gt('created_at', workingWindowMeta.lastSyncedAt)
.or(`source_space_id.eq.${spaceId},destination_space_id.eq.${spaceId}`)
.order('created_at', { ascending: false })
```

`lastSyncedAt` se actualizează cu `created_at`-ul cel mai recent din răspunsul serverului (nu cu `Date.now()` local — ceasul clientului poate diferi de server).

Delta-fetch capturează atât tranzacția operatorului curent, cât și tranzacțiile altor operatori care au lucrat simultan pe același Space. Tranzacțiile istorice din cache rămân neatinse — sunt imutabile odată confirmate.

```js
workingWindowMeta: {
  spaceId: null,
  lastSyncedAt: null,   // ISO8601 — created_at al celei mai noi tranzacții din cache
  count: 0,             // numărul de tranzacții din Working Window
}
```

---

### Stratul 2 — Session Cache (Local, volum rezonabil)

Când utilizatorul solicită o perioadă care depășește Working Window:

1. **COUNT query** pe server pentru perioada cerută (rapid, indexat pe `created_at`)
2. Dacă `COUNT ≤ THRESHOLD (2.000)` → **fetch date brute** → stocate în Zustand (`sessionCache[]`) → agregare client-side

**Avantajul cheie:** odată datele în `sessionCache[]`, orice variație de filtru (schimbare granularitate, adăugare filtru produs) se execută **local, instant** — fără niciun request suplimentar, în aceeași sesiune.

```js
sessionCache: {
  spaceId: null,
  from: null,           // ISO8601
  to: null,             // ISO8601
  transactions: [],     // date brute
  fetchedAt: null,      // ISO8601
}
```

---

### Stratul 3 — Server-Side Aggregation (volum mare)

Dacă `COUNT > THRESHOLD (2.000)`:

- Aplicația trimite parametrii la server: `(spaceId, from, to, granularity, productId?)`
- Un **Supabase RPC** face `GROUP BY` direct în PostgreSQL și returnează buckets-urile gata agregate
- Rezultatul NU se stochează în `sessionCache` — fiecare variație de filtru = nou request server

Serverul este mai eficient decât clientul la >2.000 tranzacții brute.

**Experiența utilizatorului:** loading spinner standard. Fără Warning Banner, fără restricție.

---

## 3. Algoritmul de routing (Decision Tree)

```
Utilizatorul setează filtrul (perioadă + granularitate + filtre opționale)
          │
          ▼
  Datele cerute sunt în Working Window sau Session Cache?
          │
   DA ────┴──── NU
   │              │
   ▼              │
Filtrare        Offline?
locală            │
(instant)    DA ──┴── NU
             │         │
             ▼         ▼
         Blocare    COUNT query
         + mesaj    pe server
         explicit        │
                  COUNT ≤ 2.000?
                         │
                  DA ────┴──── NU
                  │              │
                  ▼              ▼
             Fetch date     Server RPC →
             brute →        agregare SQL →
             sessionCache   rezultat gata
                  │              │
                  ▼              ▼
             Agregare       Afișare
             client-side    rezultate
```

---

## 4. Modulul de filtrare UI — structura filtrelor

### 4.1 Categoria A — Filtre de sistem (hard-codate în aplicație)

Definite de dezvoltator la build time, disponibile în orice Space, fără configurare din partea utilizatorului:

| Filtru | Valori posibile |
|---|---|
| **Perioadă** | Azi / Săptămâna asta / Luna asta / Luna trecută / Trimestrul asta / Custom (date picker) |
| **Granularitate** | Tranzacție individuală / Zilnic / Săptămânal / Lunar |
| **Tip mișcare** | Inbound / Outbound / ambele — selectabil independent, **fără constrângere de minim** |
| **Sursă / Destinație** | Space-ul de origine / destinație al tranzacției |

> **Tip mișcare — detaliu arhitectural:** fiecare tranzacție are asociat un atribut de sistem — Inbound (Space-ul curent este destinație) sau Outbound (Space-ul curent este sursă). Utilizatorul poate selecta Inbound, Outbound, sau ambele, independent.

### 4.2 Categoria B — Filtre pe atribute de produs (definite de utilizator în Catalog)

| Filtru | Detalii |
|---|---|
| **Produs specific** | Utilizatorul caută după **nameId** sau **cod de bare** — intern, codul folosește `product_id` pentru join; utilizatorul nu vede/nu știe de UUID |
| **Tags** | Vocabularul flat cross-categorie din Catalog (filtrare OR flat, identic cu cel din StockHub) |
| **Atribute per-categorie** | Atributele cu `filterable: true` din schema categoriei produsului |

### 4.3 Categoria C — Atribute de tranzacție `[TBD — v2]`

> Concept documentat pentru implementare viitoare. Detalii complete în `SPEC_LotTracking_v1.md`.

Atribute definite de utilizator la nivel de Space, cu valori completate la momentul tranzacției — metadate care aparțin **tranzacției**, nu produsului.

**Exemplu:** Space "Vânzări Showroom" → atribut `Nume Client`. La fiecare tranzacție, operatorul completează: `Ion Popescu`. În Flux: filtrare după client.

**Soluție tehnică preconizată (fără tabele noi):**
```sql
-- Migrare mică, non-breaking
-- Valoarea e pe tranzacție, NU pe transaction_items
alter table transactions add column attributes jsonb;
```
Schema atributelor disponibile per Space se definește separat (de proiectat în v2).

---

## 5. Default view — Infinite Scroll

La intrarea pe tab-ul Flux (fără filtru activ):

- Tranzacțiile din **Working Window** randate în ordine cronologică inversă, stil WhatsApp
- **Infinite Scroll:** la scroll spre trecut, pachete de 50 de tranzacții se aduc de la server la cerere (date mai vechi decât Working Window)
- Butonul **Filtrează** comută din modul Infinite Scroll în modul Period Filter cu agregare

---

## 6. Comportament offline — reguli explicite

> **Principiu fundamental:** utilizatorul NU trăiește cu impresia că filtrarea funcționează pe toată perioada cerută când de fapt se lucrează doar cu date locale. Informarea este **întotdeauna explicită și clară**.

| Situație | Comportament |
|---|---|
| Filtru pe date din Working Window | ✅ Funcționează complet offline — instant |
| Filtru pe date din Session Cache (aduse anterior în sesiune) | ✅ Funcționează offline — instant |
| Filtru pe perioadă nouă, date indisponibile local, offline | ⛔ **Blocare + mesaj explicit:** „Ești offline. Datele disponibile local acoperă N tranzacții. Pentru perioada solicitată este necesară o conexiune la internet." |
| Server RPC necesar (COUNT > 2.000), offline | ⛔ **Blocare + mesaj explicit:** „Calculul pentru această perioadă necesită conexiune la server." |

---

## 7. Granularitatea și rezultatul afișat

| Granularitate selectată | Rezultat randat |
|---|---|
| **Tranzacție individuală** | Fiecare bloc Flux = o tranzacție (identic cu default Infinite Scroll) |
| **Zilnic / Săptămânal / Lunar** | Produsele din interval grupate după `product_id`, cantități sumate (`SUM(qty)`). Un bloc sumar per interval. |

Calculul `GROUP BY` se execută:
- **Client-side** dacă datele sunt în Working Window sau Session Cache
- **Server-side RPC** dacă COUNT > THRESHOLD

---

## 8. Structura stării Zustand pentru Flux

```js
// În useStockStore sau un hook dedicat useFluxStore (de decis la implementare)
{
  // Stratul 1: Working Window
  workingWindow: [],
  workingWindowMeta: {
    spaceId: null,
    lastSyncedAt: null,   // ISO8601 — cursor pentru delta-fetch (created_at server-side)
    count: 0,
  },

  // Stratul 2: Session Cache
  sessionCache: {
    spaceId: null,
    from: null,
    to: null,
    transactions: [],
    fetchedAt: null,
  },

  // Filtrul activ setat de utilizator
  fluxFilter: {
    from: null,
    to: null,
    granularity: 'transaction',   // 'transaction' | 'daily' | 'weekly' | 'monthly'
    types: ['inbound', 'outbound'],
    productId: null,
    sourceSpaceId: null,
    destinationSpaceId: null,
  },

  // Starea routing-ului (pentru UI loading/error/offline states)
  fluxRoutingStatus: 'idle',
  // 'idle' | 'counting' | 'fetching_raw' | 'computing_local'
  // | 'fetching_rpc' | 'done' | 'error' | 'offline_blocked'

  // Rezultatul final (output calculat — nu sursă de date, nu se scrie direct)
  fluxResult: [],
}
```

**Regulă critică:** `workingWindow[]` și `sessionCache.transactions[]` sunt **mereu separate**. Nu se combină niciodată într-un singur array. `fluxResult[]` este output-ul final calculat, niciodată scris direct.

---

## 9. Bug fix aplicat — fetchSpaceTransactions

**Problemă rezolvată:** mapping-ul itemelor nu includea `product_id`, făcând filtrarea după produs imposibilă.

```js
// ✅ Fix aplicat în useStockStore.js
const items = (tx.transaction_items ?? []).map((item) => ({
  productId: item.product_id,        // UUID intern — pentru filtrare programatică
  nameId: item.products?.name_id ?? '—',  // identificator uman — afișat în UI
  qty: item.quantity,
}))
```

**Distincție:**
- `productId` — UUID intern Postgres, invizibil utilizatorului, folosit de cod pentru join-uri
- `nameId` — identificator uman auto-generat, imuabil (ex: `brave-carrot`), afișat pe card și în Flux

Filtrul "Produs specific" acceptă input de **nameId sau cod de bare** — intern se face lookup `nameId → productId`.

---

## 10. Constante și praguri

| Constantă | Valoare | Motiv |
|---|---|---|
| `ROUTING_THRESHOLD` | 2.000 tranzacții | Maxim rezonabil pentru procesare JS client-side pe device mid-range |
| `INFINITE_SCROLL_PAGE_SIZE` | 50 tranzacții | Consistent cu `ARCHITECTURE.md` §6.5 |
| `DELTA_FETCH_CURSOR` | `created_at` (timestamp server-side) | `transaction_id` e UUID v4 (aleator, non-ordered) — nu poate fi cursor de ordine temporală |

> **Nu există `WORKING_WINDOW_DAYS`.** Perioada acoperită de Working Window este determinată dinamic de volumul tenantului, nu de o valoare fixă de timp.

---

## 11. Relația cu spec-urile existente

| Document | Status |
|---|---|
| `SPEC_Space_Filtering_Architecture.md` §1–§2 | ✅ Valid (filtrarea Stoc, Local-First) |
| `SPEC_Space_Filtering_Architecture.md` §3 | ⛔ **Depășit** — înlocuit de acest document |
| `SPEC_Space_Filtering_Architecture.md` §4 | ⚠️ Parțial depășit — analitice BI acoperite de §3 (Server RPC); rămâne ca viziune BI |
| `ARCHITECTURE.md` §6.5 | ⚠️ De actualizat: Period Filter = paradigma filtrare, Infinite Scroll = default view (§5) |
| `SPEC_LocalFilter_v3.md` | ✅ Neatins — filtrarea produselor (Stoc) |
| `SPEC_LotTracking_v1.md` | ✅ Document nou — arhitectura trasabilitate loturi (TBD v2+) |

---

*v2 — sept. 2026. Rescriere completă față de v1.*
