# oneSku — SPEC Tags (UI + flux de selecție)

> Specificația de UI și interacțiune pentru sistemul de Tags în Catalog: secțiunea
> informativă din SchemaSheet, câmpul din ProductFormSheet, picker-ul de selecție și
> regula nouă de stratificare sheet-din-sheet (swap). Modelul de date există deja
> integral — acest document NU introduce migrații sau RPC-uri noi.
>
> Dependențe: `SPEC_DatabaseSchema_v3.md` §6.2 (`products.tags`), `SPEC_LocalFilter_v3.md`
> §5.2 (semantica Tags), `SPEC_Picker_v2.md` (usePicker, moduri sheet, BottomBar),
> `ARCHITECTURE.md` §5.4.

---

## 0. Decizii confirmate

| Decizie | Alegere |
|---|---|
| Tags în schema categoriei | **NU e atribut de schemă** (invariant ARCHITECTURE §5.2). În SchemaSheet apare doar o secțiune informativă read-only „De sistem" (§2) |
| Prezență vs. completare | Câmpul Tags e **prezent pe orice produs** (atribut de sistem, ca NameID); **valoarea e opțională** — zero tag-uri e stare validă, salvarea nu se blochează |
| Selecție | ListPick prin `usePicker({ multiSelect: true, allowCreate: true })`, sheet în modul **„cu căutare"** (BottomBar filtrează) |
| Stratificare sheet-uri | **SWAP, nu stacking**: sheet-ul curent e înlocuit de picker; la confirmare/anulare revine cu starea intactă. Regulă generală nouă (§5) |
| Vocabular | **Derivat** din `filter_idx` global, bucket `tags` — fără tabel de tags, fără RPC nou |
| Scope | **Doar la crearea produsului.** Fără retro-tagging, fără RPC de update |
| Identitate tag | Stocare as-typed cu `trim`; unicitate enforțată în picker pe forma normalizată (`normalize()`) |

---

## 1. Modelul de date — recap, nimic nou

Totul există deja (STATUS 2026-07-05):

- `products.tags text[]` + index GIN.
- `filter_idx` global indexează bucket-ul `tags` (rebuild pe trigger la mutații de produs).
- `create_product` acceptă `p_tags`; `useCatalogStore.addProduct` acceptă `tags`.
- `space_products.local_tags` — pregătit structural, în afara scope-ului (UI la StockHub).

**Semantica „obligatoriu":** Tags e obligatoriu ca **prezență** (câmpul există pe orice
produs, indiferent de categorie), nu ca **valoare** (SPEC_LocalFilter_v3 §5.2.2 —
opțional per produs). Nicio validare de minim la salvare.

---

## 2. SchemaSheet — secțiunea „De sistem"

### 2.1 Structură

Deasupra listei de atribute definite de user, o secțiune fixă, vizual diferențiată
(label de secțiune, stil muted):

```
┌─────────────────────────────────────┐
│ DE SISTEM                           │
│  ⚙ NameID                           │
│     Identificator generat automat   │
│     la creare — unic, needitabil    │
│  ⚙ Tags                             │
│     Etichete libere, valabile în    │
│     tot catalogul; se completează   │
│     în formularul de produs         │
├─────────────────────────────────────┤
│ ATRIBUTELE CATEGORIEI               │
│  … (lista existentă, neschimbată)   │
└─────────────────────────────────────┘
```

### 2.2 Reguli

- **Read-only strict**: fără `onClick`, fără chevron, fără toggle, fără nicio acțiune.
- Rolul e exclusiv explicativ: userul înțelege de unde vine NameID-ul apărut pe card
  și că Tags există pe orice produs fără să fie definit în schemă.
- Secțiunea NU e configurabilă și NU devine configurabilă — orice cerere viitoare de
  configurare a atributelor de sistem trece prin planificare, nu se improvizează aici.
- Nu participă la nicio numărare/validare a schemei.

---

## 3. ProductFormSheet — câmpul Tags

### 3.1 Plasare și afișare

- Poziție: **după câmpurile generate din schemă**, înainte de prețul de listă
  (prețul rămâne ultimul câmp).
- Rând „Tags", marcat vizual ca field de sistem (consistent cu §2):
  - **Cu selecție**: chips cu tag-urile alese; fiecare chip are „×" pentru eliminare
    directă din formular (fără a deschide picker-ul).
  - **Fără selecție**: placeholder muted („Adaugă tag-uri").
- Tap pe rând (în afara „×"-urilor) → deschide picker-ul (§4) prin swap (§5).

### 3.2 Salvare

- Selecția curentă se trimite ca `tags` prin `addProduct` → `create_product(p_tags)` —
  flux deja existent, neschimbat.
- Zero tag-uri = valid; nu se blochează și nu se avertizează.
- După salvare, trigger-ul existent reface `filter_idx` global → tag-urile noi intră
  automat în vocabular.

---

## 4. Picker-ul de tags

### 4.1 Instanțiere

```
usePicker({
  items: vocabular (§4.4) ∪ tag-urile nou-create în sesiunea curentă a formularului,
  labelFn: (t) => t.value,
  multiSelect: true,
  allowCreate: true
})
```

### 4.2 Comportament (conform SPEC_Picker_v2)

- Sheet în modul **„cu căutare"** (SPEC_Picker_v2 §4.5): BottomBar rămâne vizibil,
  inputul lui filtrează lista — acesta **este** prefix search-ul anti-duplicare cerut
  de ARCHITECTURE §5.4. **Fără input propriu de căutare în sheet.**
- Rând per tag: checkbox + valoare + contor (numărul de produse — `idx.length` din
  filter_idx).
- La deschidere: tag-urile deja selectate în formular apar bifate.
- Sortare implicită: frecvență descrescătoare (contor), apoi alfabetic pe forma
  normalizată. Căutarea reordonează prin `filterAndSort` (algoritmul canonic).
- Confirmare explicită: buton „Salvează" → selecția se întoarce în formular.
  Anulare („×" / backdrop) → formularul revine cu selecția anterioară neschimbată.

### 4.3 Creare tag nou

- La **potrivire inexactă** (niciun tag cu formă normalizată identică) → rând
  „+ Adaugă «query»". La tap: tagul intră în lista locală a picker-ului, **bifat
  automat**.
- La **potrivire exactă normalizată** → rândul „+ Adaugă" NU apare (același principiu
  showCreate ca la categorii); tagul existent e garantat în rezultate (prefix match)
  și se selectează.
- Tagul nou-creat trăiește doar în starea formularului până la salvarea produsului —
  intră în vocabular abia când `filter_idx` se reconstruiește după `create_product`.
  Formular abandonat → tagul dispare fără urmă (corect: vocabularul e derivat).
- FAB-ul de creare (SPEC_Picker_v2 §5) nu e necesar în context de sheet — rândul
  inline e suficient.

### 4.4 Vocabularul — sursă derivată

- Sursa unică: `filter_idx` cu `scope_type = 'global'`, bucket-ul `tags`
  (`[{value, idx}]`) → clientul mapează la `{value, count: idx.length}`.
- Fetch la deschiderea picker-ului (un query mic pe rândul filter_idx global), cu
  cache pe durata sesiunii de formular.
- **Interzis**: RPC nou `get_all_tags`, scanarea `products` client-side, tabel de tags.
- Consecințe asumate ale derivării: un tag rămas pe zero produse dispare din vocabular;
  tenant nou → vocabular gol → empty state + creare directă.

---

## 5. Regula sheet-din-sheet — SWAP (regulă generală nouă)

> Regulă de interacțiune valabilă în toată aplicația, nu doar la tags. Casa ei
> definitivă e SPEC_Picker (la următoarea revizie se mută acolo, iar acest document
> va referenția); până atunci, sursa de adevăr e această secțiune.

- Când dintr-un bottom-sheet A (ex. ProductFormSheet) se lansează o selecție care
  necesită propriul sheet B (ex. picker-ul de tags): **A se închide vizual, B îi ia
  locul.** Nu există niciodată două sheet-uri suprapuse simultan.
- Starea lui A (valorile din formular, selecțiile) se păstrează integral în memorie
  (store / state părinte).
- La confirmare sau anulare din B: B se închide, **A se redeschide cu starea intactă.**
- BottomBar urmează sheet-ul activ: A poate fi „fără căutare" (formular), B „cu
  căutare" (picker) — comutarea modurilor e per-sheet, conform SPEC_Picker_v2 §4.5.
- **Aliniere retroactivă**: dacă selecția de valori `single_choice` din
  ProductFormSheet folosește azi alt mecanism (stacking sau altceva), se aliniază la
  regula swap.
- **Anti-pattern nou: stacking de bottom-sheet-uri — INTERZIS.**

---

## 6. Normalizare și identitate

- **Stocare**: exact cum a tastat userul, cu `trim()` aplicat la creare. Fără
  lowercase forțat — „iPhone" rămâne „iPhone".
- **Unicitate**: UX-enforced la punctul de intrare (picker), prin `normalize()` din
  `src/lib/search.js` (funcția canonică): două tag-uri nu pot diferi doar prin
  caz/diacritice/spații.
- Fără constrângere DB (valorile trăiesc într-un `text[]`) — de aceea **orice** punct
  viitor de intrare a tag-urilor (import Excel, editare produs, tags locale de Space)
  trebuie să reaplice același match normalizat contra vocabularului. Notă pentru
  spec-urile respective.
- Motivul: două forme divergente ale aceluiași tag ar produce bucket-uri separate în
  `filter_idx` → filtrare fragmentată.

---

## 7. În afara scope-ului (explicit)

| Element | Status |
|---|---|
| Retro-tagging (editare tags pe produs existent) | **Exclus.** Niciun RPC de update. Vine odată cu feature-ul general de editare produs |
| Tags pe ProductCard | Libertatea agentului cât cardul e placeholder (SPEC_LocalFilter_v3 §12.6) |
| Tag Groups (grupare vizuală) | Amânat (SPEC_LocalFilter_v3 §5.2.5, SPEC_DatabaseSchema_v3 §8) |
| Tag-uri locale de Space | DB pregătit (`space_products.local_tags`); UI la StockHub |
| Filtrarea după tags | Aparține modulului de filtrare (SPEC_LocalFilter_v3) — alt feature |

---

## 8. Fișiere atinse

| Fișier | Modificare |
|---|---|
| `src/components/catalog/SchemaSheet.jsx` | Secțiunea „De sistem" (§2) |
| `src/components/catalog/ProductFormSheet.jsx` | Câmpul Tags + integrarea swap cu picker-ul (§3, §5) |
| componentă nouă sau ListPick parametrizat | Picker-ul de tags (§4) |
| `src/store/useCatalogStore.js` | Selector/acțiune de fetch vocabular din filter_idx global |

**Fără migrații noi. Fără RPC-uri noi.**

---

## 9. Instrucțiuni pentru agentul Claude Code

1. **Zero schimbări DB/RPC.** Verifică doar end-to-end că `create_product` cu `p_tags`
   populează corect coloana și că rebuild-ul filter_idx global include tag-urile noi.
2. **Implementează swap-ul ca mecanism** (la nivelul gestiunii sheet-urilor), nu
   ad-hoc pentru tags. Dacă `single_choice` din ProductFormSheet face azi altceva,
   aliniază-l la aceeași regulă.
3. **Vocabularul vine exclusiv din filter_idx global.** Nu crea RPC `get_all_tags`,
   nu scana produsele în client.
4. **Niciun input de căutare în sheet** — picker-ul rulează în modul „cu căutare" cu
   BottomBar (SPEC_Picker_v2 §4.5).
5. **Nu face tags obligatorii la salvare** — zero tag-uri e stare validă.
6. **Rândurile de sistem din SchemaSheet sunt strict read-only** — fără handlers,
   fără toggles.
7. **Nu implementa retro-tagging**, chiar dacă pare la un pas distanță — e explicit
   exclus (§7).
8. Trim la creare + blocarea rândului „+ Adaugă" la potrivire exactă normalizată
   (§4.3, §6).

---

*SPEC_Tags v1 — Tags rămâne sistem separat de schemă (invariant); SchemaSheet primește
secțiune informativă read-only „De sistem" (NameID + Tags); câmp Tags în
ProductFormSheet cu chips + „×"; picker ListPick multiSelect+allowCreate în modul „cu
căutare"; regulă generală nouă sheet-din-sheet = SWAP (stacking interzis); vocabular
derivat din filter_idx global; doar la creare produs; identitate normalizată
UX-enforced.*
