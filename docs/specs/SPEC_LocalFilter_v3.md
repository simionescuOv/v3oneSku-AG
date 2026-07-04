# SPEC — Modul de Filtrare Locală (oneSku) — v3

> **Status document.** Rescriere completă a `SPEC_LocalFilter_v2.md`, care absoarbe integral și `NOTA_Sincronizare_FiltrareArhitectura.md`. După adoptarea acestui document, atât v2 cât și NOTA devin caduce și se arhivează — v3 e sursa unică de adevăr pentru modulul de filtrare.
>
> **Ce aduce nou v3 față de v2 + NOTA:** modelul celor trei `filter_idx` (din NOTA) integrat formal; rebuild-ul mutat pe server (decizie nouă, rezolvă contradicția v2 §1.5/§2.5 vs. NOTA §5); modulul de filtrare unificat Catalog/Space (rând „Categorie" și în Catalog, nu doar în Space); NameID redefinit ca identificator de sistem imuabil; produs-în-Space clarificat ca pointer + delta; Tag Groups confirmat ca strat pur UI, amânabil. Jurnalul complet e în §14.
>
> **Status implementare:** structurile sunt gândite pentru Supabase (Postgres). Rebuild-ul indexurilor se face server-side (vezi §4). Clientul consumă indexuri gata calculate.

---

## 1. Principii de bază

1.1. Filtrarea (interogarea prin bifarea valorilor de atribute) este **100% locală (client-side)**. La fiecare bifare NU se face roundtrip la server. Acesta e obiectivul fondator al întregului modul: eliminarea așteptării la fiecare bifare.

1.2. Filtrarea operează pe un index inversat precalculat (`filter_idx`, vezi §3 și §6), nu prin scanarea produselor la fiecare interacțiune.

1.3. Logica booleană: **OR în cadrul aceluiași atribut, AND între atribute**.

1.4. Scope de referință: **implementare mobile-first**. Varianta desktop (coloană laterală fixă în loc de bottom sheet) — deferred (§12).

1.5. **Separarea celor două fluxuri, după frecvență (decizie v3):**
- 1.5.1. **Citire / interogare** (bifarea valorilor pentru a ajunge la produsele dorite) — se întâmplă de zeci de ori per sesiune → **exclusiv local**, zero request.
- 1.5.2. **Mutație** (adăugare / editare / ștergere produs, tranzacții) — se întâmplă rar și **atinge oricum serverul** (produsul se salvează în Supabase) → rebuild-ul `filter_idx` se face **server-side**, în același flux (vezi §4). Nu se introduce niciun request nou; se mută doar locul calculului.

1.6. **Clientul nu ține lista completă de produse.** Clientul primește de la server `filter_idx`-urile relevante (structuri ușoare: atribut → valoare → listă de `product_id`). Datele complete ale produselor (pentru afișarea cardurilor) se cer separat, paginat, la nevoie.

---

## 2. Reguli transversale

2.1. **Zero dropdown-uri native.** Orice selecție (tip atribut, atribut global, opțiuni, categorie, tag) se face exclusiv prin **bottom sheet** (`ListPick`), componentă universală de selecție.

2.2. **Componentă unică de listă produse + filtrare**, folosită la Catalog și **refolosită identic** la Spaces. Diferența de comportament e minimă și parametrizată (vezi §9, §10).

2.3. **Căutare per-coloană.** Coloana din dreapta (valorile atributului selectat) e **întotdeauna** filtrabilă prin căutarea din bottom-bar — pentru orice atribut, inclusiv rândul special „Categorie" și inclusiv Tags (indiferent de gruparea vizuală, vezi §5).

2.4. **Indexare prin UUID, nu prin poziție.** `filter_idx` referențiază `product_id` (UUID), niciodată poziția numerică. Esențial pentru siguranța la ștergere și pentru Supabase.

2.5. **`filter_idx` e derivat, recalculat integral, nu întreținut incremental.** Sursa de adevăr e tabela `products` din Postgres (NU o listă în client). La orice mutație relevantă (§4.3), indexul afectat se **recalculează integral** pe server (`GROUP BY`), nu se peticește bucată cu bucată. Motiv: elimină complet clasa de bug-uri „produs-fantomă rămas într-un bucket vechi" specifică update-ului incremental, la un cost de compute neglijabil la scara vizată (mii de produse per tenant).

---

## 3. Modelul celor TREI tipuri de `filter_idx`

> Aceasta e piesa centrală adusă din NOTĂ. Nu există un singur index, ci trei tipuri distincte care **se intersectează la citire**, nu se combină la scriere. Astfel, o mutație invalidează doar piesa care o conține, fără cascadă.

3.1. **`filter_idx` global** — un singur index per tenant. Construit din **toate** produsele din tot catalogul, dar conținând **doar** Tags + atributele globale (ex. Brand). Nu conține atribute per-categorie.

3.2. **`filter_idx` per-categorie** — câte unul pentru fiecare categorie (câte scheme, atâtea indexuri). Construit doar din atributele **locale** ale schemei acelei categorii, doar din produsele acelei categorii.

3.3. **`filter_idx` local de Space** — câte unul per Space. Construit doar din atributele care există **exclusiv** într-un Space (ex. `stoc`, tag-uri locale de Space), calculat doar peste `product_id`-urile din lista de pointeri a acelui Space.

3.4. **De ce trei piese separate, nu una combinată:**
- 3.4.1. `filter_idx` per-categorie → recalculat doar la schimbări în acea categorie.
- 3.4.2. `filter_idx` global → recalculat doar la schimbări pe Tags / atribute globale ale oricărui produs.
- 3.4.3. `filter_idx` local de Space → recalculat doar la schimbări de atribute locale de Space sau la schimbarea listei de pointeri (tranzacții).
- 3.4.4. Niciuna dintre cele trei nu necesită propagare manuală către celelalte.

3.5. **Spaces NU duplică indexuri.** Un Space refolosește indexurile de Catalog (global + per-categorie) și adaugă **un singur** index propriu (local de Space). Produsele din Space care nu se potrivesc se elimină prin **mascare cu lista de pointeri**, nu prin construirea unui index separat (vezi §4 pentru intersecție).

---

## 4. Construcția și combinarea rezultatelor (calcul)

### 4.1. Construcția (server-side)

4.1.1. Rebuild-ul fiecărui `filter_idx` se face pe server, prin `GROUP BY` direct pe tabela `products` (și pe tabelele de stoc / pointeri pentru indexul de Space).

4.1.2. **Mecanism recomandat: trigger Postgres** pe `products` (și pe tabela de tranzacții/stoc), astfel încât recalculul e parte din aceeași tranzacție ca mutația — nu există fereastră în care indexul e stale, și nu se poate „uita" apelul. Alternativă acceptabilă pentru început: RPC apelat explicit de client imediat după mutație (mai simplu de depanat, dar cu risc de stale dacă apelul eșuează).

4.1.3. **Unde stă rezultatul:** `filter_idx` se materializează (coloană JSONB pe o tabelă de sumar sau tabel dedicat cheiat pe scope — detaliu de schemă tratat în SPEC_DatabaseSchema, nu aici). Clientul îl cere la intrarea în ecranul de filtrare.

4.1.4. **Cache local între sesiuni (opțional):** clientul poate păstra ultimul `filter_idx` primit pentru afișare instantă la redeschidere, dar la fiecare intrare în ecranul de filtrare cere varianta proaspătă (un singur fetch mic, nu o listă de produse).

### 4.2. Combinarea la citire (client-side, prin intersecție de seturi de UUID)

4.2.1. **Catalog, la nivel de categorie (categorie bifată):**
`rezultat = filtrare(filter_idx per-categorie) ∩ filtrare(filter_idx global)`, aplicate pe produsele categoriei curente.

4.2.2. **Catalog, fără categorie bifată (scope global):**
`rezultat = filtrare(filter_idx global)`, aplicată pe tot catalogul.

4.2.3. **Space, cu categorie bifată:**
`rezultat = pointeri_Space ∩ filtrare(filter_idx per-categorie a categoriei bifate) ∩ filtrare(filter_idx global) ∩ filtrare(filter_idx local de Space)`.

4.2.4. **Space, fără categorie bifată:**
`rezultat = pointeri_Space ∩ filtrare(filter_idx global) ∩ filtrare(filter_idx local de Space)` (fără componenta per-categorie).

4.2.5. Lista de pointeri a Space-ului funcționează ca **mască**: indexurile de Catalog conțin și produse care nu există în Space; intersecția cu pointerii le elimină, fără index duplicat.

### 4.3. Declanșatorii rebuild-ului

4.3.1. Rebuild **doar** pentru atribute `filterable`. Editarea unui atribut nefilterabil (ex. o descriere `text` cu `filterable: false`) nu declanșează rebuild.

4.3.2. `filter_idx` global → rebuild la modificarea Tags sau a unui atribut global `filterable` pe orice produs.

4.3.3. `filter_idx` per-categorie → rebuild la modificarea unui atribut local `filterable`, adăugare/ștergere (soft-delete)/restore de produs în acea categorie.

4.3.4. `filter_idx` local de Space → rebuild la: (a) modificarea unui atribut local de Space `filterable` (ex. stoc), (b) **modificarea listei de pointeri** (intrare/ieșire produs din Space prin tranzacție Cart). Ambele vin prin server (Cart atinge oricum Supabase), deci trigger-ul le prinde natural.

---

## 5. Atribute predefinite (prezente pe orice produs)

### 5.1. `NameID` — identificator de sistem, imuabil

5.1.1. **NameID e un identificator de sistem generat automat, NU o etichetă introdusă de user.** Analogie: un UUID, dar pronunțabil și memorabil (asemănător numelui uman al unui deploy Netlify). Comportament identic cu al UUID-ului intern în toate privințele, cu singura diferență că e lizibil.

5.1.2. **Generat automat, needitabil de user, imuabil pe toată durata de viață a produsului.** Userul nu îl tastează niciodată → nu există typo de corectat → nu există caz de editare de protejat. Costul de UX al imuabilității dispare fiindcă omul nu scrie niciodată acest câmp.

5.1.3. **Nu e un tip de atribut în schema categoriei.** Implementare: **coloană dedicată** `products.name_id text`, cu `unique index on (tenant_id, name_id)`.

5.1.4. Unicitate la nivel de **catalog (tenant)**. Un produs poreclit „carrot" la categoria Telefoane blochează orice alt „carrot" din tot catalogul.

5.1.5. **Generatorul garantează unicitatea:** produce un cuvânt EN lizibil; la coliziune, retry cu strategie de unicitate garantată (sufix numeric — `carrot-42` — sau combinație de două cuvinte — `brave-carrot`). La scara vizată (mii de produse/tenant) spațiul e practic inepuizabil.

5.1.6. **`searchable: true`, `filterable: false` — permanent.** Exclus complet din modulul de filtrare (cardinalitate maximă prin definiție). Poate fi găsit prin căutare, dar nu apare ca rând de filtrat.

5.1.7. **Afișare pe card:** NameID e afișat **implicit** pe cardul de produs, ca etichetă umană (rolul pe care în alte aplicații tip magazin online îl are un „entry name" obligatoriu). Userul îl va putea dezactiva de pe card **atunci când** va exista mecanismul de configurare a cardului (§12.6) — dar câmpul rămâne mereu prezent și imuabil în date, indiferent de afișare.

5.1.8. **NameID înlocuiește coloana `products.name`.** Nu coexistă cu un câmp `name` separat: NameID preia integral rolul de identificator uman obligatoriu al produsului. Descrierea comercială lungă (ex. „Laptop Gaming Intel i5-12600H…") rămâne un atribut **separat, opțional**, de tip `text`, definit de user per categorie.

5.1.9. **Identificatorii aleși de user** (dacă userul vrea propriile coduri/porecle) se fac prin **atribute normale**, definite de el — nu prin NameID. (Notă: unicitatea garantată pentru astfel de atribute — flag `unique` — este deferred, vezi §12.8.)

### 5.2. `Tags` — atribut cross-categorie

5.2.1. **Stocare: `tags text[]` flat pe produs.** Sursă unică pentru date și pentru filtrare. Fără structură de grupuri la nivel de produs.

5.2.2. Opțional per produs.

5.2.3. **Vizibilitate live prin pointer în Space:** tag-urile de Catalog ale unui produs se văd în orice Space în forma lor **curentă** (nu înghețată). Dacă un tag e editat/șters în Catalog, Space-ul reflectă imediat schimbarea — la fel ca toate celelalte atribute ale produsului (vezi §7, modelul pointer).

5.2.4. **Tag-uri locale de Space:** tag-urile adăugate direct într-un Space rămân locale acelui Space (fac parte din delta locală, nu se propagă înapoi în Catalog). Ele trăiesc în `filter_idx` local de Space.

5.2.5. **Grupare vizuală (`tag_groups`) — strat pur UI, fără efect pe date sau filtrare:**
- 5.2.5.1. La nivel de date, tag-urile rămân o listă plată. Gruparea NU apare ca structură pe produs în baza de date.
- 5.2.5.2. Gruparea e ținută separat, ca **metadata de configurare** (tabelă `tag_groups` + apartenență tag→grup), consumată **exclusiv de UI** pentru a organiza lista de tag-uri în bottom sheet. Fără nicio legătură cu `products.tags` sau cu `filter_idx`.
- 5.2.5.3. **Filtrarea rămâne OR flat** peste toate tag-urile bifate, indiferent de grup. Gruparea NU introduce AND între grupuri.
- 5.2.5.4. **Căutarea prin tastare rămâne flată** pe toată lista de tag-uri, indiferent de grupare (grupurile organizează doar scroll-ul/răsfoirea vizuală).
- 5.2.5.5. **Scop:** ajutor de regăsire pentru userul care folosește multe tag-uri rar și le uită denumirea — găsește grupul (contextul situației), nu trebuie să-și amintească textul exact. Util mai ales la editarea produselor.
- 5.2.5.6. Butonul dedicat („Tag Groups" / „Tags Tree") comută lista de tag-uri din formă plată în formă ierarhică, similar ierarhiei de foldere de la categorii. Tag-urile negrupate apar fără header, amestecate în listă.
- 5.2.5.7. **Amânabil fără refactorizare:** fiind complet izolată (nu atinge `products.tags`, `filter_idx` sau logica de filtrare), această funcționalitate poate fi implementată ulterior fără a rescrie nimic din filtrarea curentă.

---

## 6. Atribute per-categorie și atribute globale

### 6.1. Atribute per-categorie (schema definită de user)

6.1.1. Tipuri disponibile: `text`, `single_choice`.

6.1.2. Flag `filterable: boolean` per atribut, cu default după tip:
- `single_choice` → `filterable: true` implicit.
- `text` → `filterable: false` implicit.
- Override manual disponibil pe ambele direcții.

6.1.3. (Deferred) Warning vizual la configurare pentru cardinalitate mare (§12.5).

### 6.2. Atribute globale (registry separat)

6.2.1. Concept: atribute valabile cross-categorie (ex. „Brand"), stocate într-un registry independent de schema per-categorie.

6.2.2. UI de marcare: toggle **„Atribut global"** la formularul de adăugare atribut, **implicit OFF**. La activare → bottom sheet (`ListPick`) cu atributele globale existente: alegere existent → legare prin `global_attribute_id`; creare unul nou → disponibil apoi în orice categorie.

6.2.3. **Tip: doar `single_choice` în v1.** `multiple_choice` la atribute globale e eliminat — Tags acoperă deja cazul multi-select cross-categorie, iar reintroducerea lui ar crea două sisteme paralele care fac același lucru. Dacă apare ulterior un caz real neacoperit de Tags, se reintroduce separat, cu justificare la acel moment.

6.2.4. `stoc` este un atribut global din perspectiva **comportamentului de filtrare** (mereu vizibil, restrâns de categoria bifată — vezi §10.3), dar datele lui trăiesc în `filter_idx` **local de Space** (§3.3), fiindcă stocul e per-Space, nu per-Catalog (același produs are stoc diferit în Space-uri diferite, și nu există deloc în Catalog).

---

## 7. Modelul „produs în Space" (pointer + delta)

7.1. Un produs într-un Space **NU e o clonă**. Este **pointerul** către produsul definit în Catalog (prin `product_id` / UUID) **plus delta locală** — atributele introduse de user în acel Space (ex. `stoc`, tag-uri locale de Space).

7.2. Toate atributele definite în Catalog (NameID, tags de catalog, brand, atribute per-categorie) se citesc **live prin pointer** din Catalog — se văd mereu în forma lor curentă. Nu există copie care să se desincronizeze.

7.3. Space = mini-catalog: un segment din catalog (listă de pointeri), nu toate produsele. De aceea filtrarea în Space refolosește indexurile de Catalog mascate cu lista de pointeri (§4.2.3–4.2.5).

7.4. **Flux (istoric tranzacții):**
- 7.4.1. Legătura stabilă a unei linii de Flux către produs = **UUID-ul intern** (imuabil, invizibil).
- 7.4.2. Eticheta umană afișată în Flux = **NameID**. Fiindcă NameID e imuabil prin definiție (§5.1.2), eticheta din istoric coincide întotdeauna cu cea curentă — **nu e nevoie de snapshot separat de etichetă** în linia de tranzacție. Aceasta e una dintre justificările pentru imuabilitatea NameID.

---

## 8. Structuri de date

> Toate `idx` conțin `product_id` (UUID).

8.1. **Schema categoriei:**
```
category_schema = {
  category_id: uuid,
  attributes: [
    { key: "attr_diagonala", name: "Diagonală", type: "single_choice",
      filterable: true, options: ["24\"", "27\"", "32\""] },
    { key: "attr_descriere", name: "Denumire produs", type: "text",
      filterable: false },
    { key: "attr_brand", name: "Brand", global_attribute_id: uuid_brand }
  ]
}
```

8.2. **Registry atribute globale:**
```
global_attributes = [
  { id: uuid_brand, name: "Brand", type: "single_choice",
    options: ["Dell", "HP", "Lenovo"] }
]
```

8.3. **Cheia JSONB pentru atribute legate global:**
- 8.3.1. **Cheia rămâne locală** (`category_attributes.id`). Invariant: cheile din `products.attributes` sunt mereu id-uri locale de categorie, indiferent dacă atributul e legat de un `global_attribute_id` sau nu.
- 8.3.2. Builder-ul de `filter_idx` **global** rezolvă maparea local→global: pentru fiecare categorie, verifică ce chei locale sunt legate de un `global_attribute_id` și agregă valorile sub acel id global, indiferent din ce categorie/cheie locală provin.
- 8.3.3. Motiv: alternativa (cheia = `global_attribute_id` direct) ar rupe invariantul „cheile JSONB = id local de categorie" și ar complica editarea per-categorie.

8.4. **`filter_idx`** — index inversat, per scope (global / categorie / Space):
```
filter_idx = {
  attr_diagonala: [
    { value: "27\"", idx: ["prod_a", "prod_c", "prod_f"] },
    { value: "24\"", idx: ["prod_b", "prod_d"] }
  ],
  attr_brand: [
    { value: "Dell", idx: ["prod_a", "prod_b"] },
    { value: "HP",   idx: ["prod_c"] }
  ]
}
```
- 8.4.1. `single_choice`: idx-uri disjuncte între valorile aceluiași atribut.
- 8.4.2. Tags (multi-valoare): un produs poate apărea la mai multe valori.
- 8.4.3. Recalculat integral server-side la orice declanșator din §4.3.

8.5. **`user_filter`:**
```
user_filter = {
  attr_diagonala: ["27\"", "24\""],
  attr_brand: ["Dell"]
}
```

8.6. **`arr_idx_rezultat`:**
- 8.6.1. Per atribut din `user_filter`: concatenare (**OR**) a idx-urilor valorilor bifate.
- 8.6.2. Intersecție (**AND**) între rezultatele atributelor diferite.
- 8.6.3. În Space: se intersectează suplimentar cu masca de pointeri (§4.2.3).
- 8.6.4. Ordine implicită = ordinea din `arr_idx_rezultat` (sortare reală — deferred, §12).

---

## 9. Contoare (counts live)

9.1. Fiecare valoare din coloana de valori afișează un contor de produse.

9.2. **Semantica recalculării (standard faceted search):** contorul unei valori se calculează aplicând toate filtrele active **cu excepția filtrului de pe propriul atribut**.
- 9.2.1. Motiv: dacă la calculul contorului „HP" s-ar aplica și filtrul deja bifat „Dell" pe același atribut Brand, „HP" ar cădea mereu la 0 — imposibil de extins selecția OR în cadrul aceluiași atribut.
- 9.2.2. Regulă: **OR-siblings excluși din calculul propriului atribut; toate celelalte atribute bifate rămân aplicate.**

9.3. **În Space, contoarele se calculează DUPĂ mascarea cu lista de pointeri**, nu direct din indexul de Catalog. Altfel userul ar vedea „Dell (12)" când în Space există doar 3 produse Dell. Contorul = mărimea intersecției dintre idx-ul valorii și masca Space-ului (plus regula faceted de mai sus).

---

## 10. UI și comportament — modul de filtrare UNIFICAT

> Catalog și Space folosesc **același modul de filtrare**. Singura diferență e că Catalog are, în plus, un ecran de ierarhie/foldere ca mod alternativ de acces. Structura de filtrare propriu-zisă e identică.

### 10.1. Structura comună

10.1.1. Tabel cu 2 coloane (stil eMAG): stânga = atribute, dreapta = valori (checkbox + contor). Fără variantă tree. Fără limită de 8 valori. Bottom sheet pe mobil.

10.1.2. **Primul rând din coloana stângă = atributul special „Categorie"** (single-select).
- Generat automat din categoriile prezente în scope (tot catalogul, respectiv categoriile prezente în acel Space), atribut de sistem, nu definit de user.
- **Fără pre-bifare:** rândul „Categorie" e selectat implicit la deschidere (coloana dreaptă îi arată valorile), dar **nicio valoare nu e bifată automat**. Evită filtrul-surpriză.

10.1.3. **Scope determinat de bifarea categoriei:**
- Fără categorie bifată → scope **global**: vizibile doar atributele globale + Tags (din `filter_idx` global; în Space, plus atributele locale de Space precum stoc).
- Cu o categorie bifată → scope **restrâns** la acea categorie: globale + Tags rămân, iar atributele **locale** ale categoriei bifate se deblochează și apar dedesubt.
- La schimbarea categoriei bifate: globalele rămân, localele se înlocuiesc cu cele ale noii categorii.

10.1.4. Coloana dreaptă: scroll + căutare prin bottom-bar (§2.3), pentru orice atribut, inclusiv „Categorie" și „Tags".

10.1.5. Filtrul se aplică pe listă doar la confirmare („Arată produsele" / „Vezi N rezultate"). Pre-selecțiile din sheet nu ating lista subiacentă până la confirmare.

### 10.2. Catalog — specific

10.2.1. Ecranul implicit al Catalogului = **ierarhia de foldere** în care sunt grupate categoriile. Acesta e un mod de **navigare/administrare** (crearea și organizarea categoriilor după nevoile userului), NU de filtrare.

10.2.2. Arborele de foldere e **căutabil din bottom-bar** exclusiv pentru **regăsirea și accesarea unei categorii** (navigare), niciodată pentru filtrarea produselor.

10.2.3. Butonul **Filtrează** comută interfața din ierarhia de foldere în **modulul de filtrare** (bottom sheet 2 coloane, §10.1). Cele două sunt moduri distincte pe aceeași rută — nu o filtrare suprapusă peste ierarhie. Filtrarea operează pe **tot catalogul**, indiferent de poziția curentă în arbore la momentul apăsării.

### 10.3. Space (StockHub) — specific

10.3.1. Fără ecran de ierarhie/foldere. La intrare → direct lista flat de produse (toate categoriile amestecate), sortate după o relevanță de stabilit ulterior (§12.2).

10.3.2. Butonul Filtrează deschide **același modul unificat** (§10.1), cu rândul „Categorie" generat din categoriile prezente în acel Space (sortate după frecvența de utilizare în Space).

10.3.3. `stoc` apare ca rând de filtrare cu comportament de **global** (mereu vizibil, indiferent de categoria bifată; restrâns de aceasta când o categorie e bifată — comportament de filtrare normal). Datele vin din `filter_idx` local de Space (§6.2.4).

10.3.4. Lista de produse a Space-ului e nefiltrată inițial. Confirmarea din sheet aplică filtrul, inclusiv cel de categorie.

---

## 11. Sinteza simetriei Catalog ↔ Space

11.1. **Modul de filtrare:** identic. Rând „Categorie" single-select fără pre-bifare → globale + Tags mereu vizibile → locale ale categoriei bifate deblocate dinamic.

11.2. **Singura diferență:** Catalog are în plus ecranul de ierarhie/foldere (navigare/administrare, acces alternativ). Space nu-l are — intri direct în lista flat + modul de filtrare.

11.3. **La nivel de indexuri:** Catalog folosește global + per-categorie. Space folosește aceleași două (mascate cu pointerii) + local de Space. Zero duplicare.

---

## 12. În afara scope-ului (deferred, de decis ulterior)

12.1. Sortarea reală a produselor (acum: ordinea din `arr_idx_rezultat`).
12.2. Criteriul de „relevanță" pentru ordinea inițială a produselor într-un Space.
12.3. Varianta desktop a modulului de filtrare (coloană laterală fixă).
12.4. Tipuri de atribut suplimentare (număr, imagine etc.).
12.5. Warning de cardinalitate la configurare.
12.6. **Configurarea cardului de produs:** ce atribute apar implicit pe card (candidați: preț de listă, titlu, stoc — mai ales în Spaces) + mecanismul de activare/dezactivare (inclusiv dezactivarea afișării NameID de pe card). Până la implementare, agentul de coding poate alege liber atribute suplimentare de afișat pe card (peste NameID, care e implicit), ca soluție temporară, fără confirmare per alegere — strict cât timp cardul e placeholder.
12.7. **Filtrare de tip interval numeric (ex. preț):** aplicabilă pe atribute de tip numeric. `filter_idx` actual suportă doar valori discrete; range e altă structură (min/max sau valori sortate), netratată aici. Depinde și de decizia deschisă asupra prețului (la nivel de SPEC_DatabaseSchema).
12.8. **Flag `unique: true` pe atribute user-defined:** pentru cazul în care userul vrea identificatori proprii garantat unici (revenirea conceptului `unique_text`, de data asta corect aplicat — pe atribute definite de user, nu pe NameID). Va reveni ca cerință; nu se implementează preventiv.

---

## 13. Puncte închise în v3 (fost „deschise")

13.1. ✅ Model trei `filter_idx` (global / per-categorie / local de Space) — formalizat (§3).
13.2. ✅ Space nu duplică indexuri — mascare cu pointeri (§3.5, §4.2).
13.3. ✅ Contoare în Space calculate pe set mascat (§9.3).
13.4. ✅ Rebuild server-side, rezolvă contradicția v2 §1.5/§2.5 vs. NOTA §5 (§4).
13.5. ✅ Declanșatori rebuild, inclusiv tranzacții Cart pentru indexul de Space (§4.3).
13.6. ✅ Modul de filtrare unificat Catalog/Space, cu rând „Categorie" și în Catalog (§10, §11).
13.7. ✅ Scope global/restrâns după bifarea categoriei, identic Catalog/Space (§10.1.3).
13.8. ✅ Arbore = navigare, filtrare = listă plată (§10.2.2–10.2.3).
13.9. ✅ Tags flat + grupare pur UI, amânabilă (§5.2).
13.10. ✅ NameID = identificator de sistem imuabil, auto-generat, needitabil (§5.1).
13.11. ✅ `products.name` → înlocuit de NameID (§5.1.8).
13.12. ✅ Produs în Space = pointer + delta, nu clonă; atribute live prin pointer (§7).
13.13. ✅ Flux: UUID stabil + NameID imuabil ca etichetă, fără snapshot (§7.4).
13.14. ✅ `stoc` = comportament global în UI, date în index local de Space (§6.2.4, §10.3.3).

---

## 14. Jurnal de revizuire (v2 + NOTĂ → v3)

14.1. **Absorbit NOTA integral:** modelul celor trei `filter_idx` (NOTA §2), intersecția la citire (NOTA §4), încărcarea doar a indexurilor (NOTA §5). NOTA se arhivează.
14.2. **Rebuild mutat pe server (decizie nouă v3):** rezolvă contradicția pe care NOTA §6.1 și auditul o semnalaseră între „lista completă în client" (v2 §2.5) și „doar filter_idx în client" (NOTA §5.3). Sursa de adevăr = Postgres; clientul primește indexuri calculate.
14.3. **Modul de filtrare unificat (decizie nouă v3):** rândul „Categorie" introdus și în Catalog (nu doar în Space, cum era în v2 §9–§10 și NOTA §3.2). „Două stări pe două ecrane" din NOTA §3.2 → „un modul universal + ecran de navigare opțional în Catalog".
14.4. **NameID redefinit (decizie nouă v3):** din „poreclă umană editabilă cu fallback" (v2 §3.1) în „identificator de sistem auto-generat, imuabil, needitabil". Fallback-ul devine mecanismul unic. Validarea live la tastare dispare (nimeni nu tastează). `products.name` eliminat.
14.5. **Produs în Space clarificat (decizie nouă v3):** pointer + delta, nu clonă. Snapshot-ul de tag-uri din v2 §3.2.4 eliminat — atributele se văd live prin pointer.
14.6. **Tags:** confirmat flat + grupare pur UI (v2 §3.2.5 corectat de la orice ambiguitate de „grupuri cu semantică"); gruparea e metadata de configurare, amânabilă.
14.7. **Unicitate categorii:** decisă (global per tenant) — dar aparține SPEC_DatabaseSchema / ONESKU_ARCHITECTURE, nu acestui document. Menționată aici doar ca dependență rezolvată.
14.8. Păstrate din v2 fără schimbare: logica OR/AND (§1.3), zero dropdown-uri native (§2.1), indexare UUID (§2.4), cheia JSONB locală cu mapare local→global (§8.3), semantica contoarelor faceted (§9.2), `multiple_choice` eliminat de la globale (§6.2.3).
