# SPEC: SpacePage Filtering, Aggregation & Timeline Architecture

Acest document descrie arhitectura și planul de implementare pentru funcționalitățile de filtrare, sortare, agregare și analiză din cadrul paginii `SpacePage`. Documentul face distincția clară între datele statice de catalog (Stoc) prelucrate „Local-First” și datele de tip serii temporale (Flux/Istoric), prelucrate în model „Hybrid-Cloud”.

---

## 1. Arhitectura de Filtrare pentru STOC (Local-First)

Vizualizarea "Stoc" a unui spațiu reprezintă un instantaneu (snapshot) al produselor curente. Deoarece populația de produse dintr-un spațiu este finită și rezonabilă ca dimensiune (mii de articole), vom păstra paradigma **100% Local-First**.

### Reutilizarea Componentei `FilterSheet`
Nu se creează o componentă nouă pentru filtrarea spațiului. Folosim instanța globală `FilterSheet.jsx` cu rol de **Adaptor Contextual**.
- **Izolarea Scope-ului:** `SpacePage` calculează un `Set` unic din toate id-urile produselor prezente fizic în spațiu (`spaceProductIds`).
- **Injectarea Contextului:** Acest `Set` este trimis către `FilterSheet` via prop-ul `baseProductIds`.
- **Dinamica Schemei de Atribute:** Comportamentul vizual este 100% identic cu cel din Catalog. Inițial, în coloana din stânga apar doar dimensiunile „Categorii” și „Tags”. În momentul în care se selectează o Categorie, interfața citește dinamic schema globală (`categoryAttributes`) și injectează în coloana din stânga **exclusiv atributele setate ca filtrabile** (`filterable === true`) pentru acea categorie specifică.
- **Intersecția Matematică:** Motorul de filtrare (`filterEngine.js`) nu lucrează cu întregul catalog, ci face o intersecție matematică ($O(1)$) între indecșii globali ai atributelor (ex: "Roșu", "Mărimea M") și lista ID-urilor din `baseProductIds`.
- **Efectul vizual (Faceted Counts):** Contoarele afișate lângă fiecare atribut în coloana din dreapta vor reflecta **strict** numărul de produse aflate în spațiul curent. Opțiunile irelevante vor avea contorul 0 și vor fi trimise la fundul listei (sau dezactivate).

### Filtre Scalare (Predicate Filtering)
Pentru proprietăți numerice care se modifică tranzacțional, cum ar fi cantitatea stocului, **nu** se folosește Indexul Inversat global.
- **Filtre Vizate:** "Stoc = 0", "Stoc sub prag de alertă", "Cost între X și Y".
- **Mecanism:** Aceste filtre se rezolvă prin *Predicate Filtering* (condiții logice simple de tip `if (produs.stoc === 0)`) rulate direct pe produsele aflate în RAM. Pe 10.000 de obiecte, execuția durează sub 1 milisecundă.

---

## 2. Conceptul de "Data Pipeline" (Sortare și Agregare)

Pentru funcționalitățile viitoare (similar cu agregările din *Memento Database*), aplicația va implementa un model liniar de transformare a datelor (Data Pipeline). Orice interacțiune a utilizatorului trece secvențial prin aceste motoare locale:

`Toate Produsele din Space -> [MOTOR FILTRARE] -> [MOTOR SORTARE] -> [MOTOR AGREGARE] -> [RANDARE UI]`

1. **Sortarea:** Se aplică exclusiv pe subsetul de produse returnat de motorul de filtrare. Fiind obiecte aflate deja în memoria `Zustand`, o sortare după preț, nume sau dată este instantanee.
2. **Agregarea (Totaluri):** Un *Aggregation Engine* va asculta de setul final de produse vizibile și va aplica funcții de reducere (`reduce`) pentru a obține metadate utile pentru Footer/Dashboard.
   - *Exemplu:* Valoare Inventar = $\sum (\text{produs.stoc} \times \text{produs.cost\_achiziție})$.
   - Datorită rulării pur locale (client-side), totalurile financiare sau rapoartele de cantitate se vor actualiza în timp real, fără latență, la fiecare click pe opțiunile de filtrare.

---

## 3. Arhitectura de Filtrare pentru FLUX (Hybrid-Cloud / Time-Series)

Fluxul unui spațiu reprezintă registrul tuturor mișcărilor (intrări, ieșiri, corecții). Spre deosebire de Catalog, fluxul **crește infinit** în dimensiunea Timp. 
Un spațiu mare poate avea zeci de mii de tranzacții lunar. Încărcarea acestora în memoria RAM a telefonului pentru a fi filtrate local ar bloca procesorul (V8/JavaScriptCore) și ar consuma ineficient traficul de date celular.

Pentru această zonă renunțăm la procesarea exclusiv locală și trecem pe o arhitectură **Server-Side Filtering + Paginare**.

### Filtrarea pe "Timp" și "Produs Specific"
Atunci când utilizatorul dorește să vadă: *"Toate tranzacțiile pentru Produsul X din ultimele 30 de zile"*:
1. **Interogarea (Query-ul):** Aplicația trimite comanda către baza de date (Supabase/PostgreSQL) cerând explicit doar setul relevant de date, cu o limită (chunk).
   - `SELECT * FROM transactions WHERE space_id = Y AND product_id = X AND created_at >= 'data' ORDER BY created_at DESC LIMIT 50`
2. **Performanța DB:** Folosind indecși pe coloanele `product_id` și `created_at`, Supabase izolează cele 5 rânduri relevante din milioane posibile, în sub 10 milisecunde.
3. **Bandwidth:** Telefonul primește și parsează doar cele 5 tranzacții relevante, evitând descărcarea a sute de megabytes inutili.

### Paginarea (Infinite Scroll - Model WhatsApp)
Istoricul tranzacțional nu va fi încărcat niciodată în totalitate. 
UI-ul va folosi cursoare (limite de 30-50 tranzacții). Pe măsură ce utilizatorul face scroll către istoricul vechi, o nouă interogare va aduce pachetul următor de date.

---

## 4. Analitice Avansate (BI - Business Intelligence)

Generarea de rapoarte complexe, de exemplu *"Produsele cărora le-a scăzut stocul cu 20% în ultima lună"* sau *"Top Vânzări"*, implică analiza unor mari volume tranzacționale (Flux).
- **Perioade scurte (ex: 30 zile):** Se pot agrega pe client dacă fluxul recent este deja sincronizat (Zustand).
- **Istoric lung (Ani) sau Volume Mari:** Se va implementa prin crearea unor **SQL Views / RPC (Remote Procedure Calls)** dedicate pe server (Supabase). Serverul va efectua calculele grele direct pe hard disk, trimițând aplicației de mobil doar răspunsul curat și sumarizat.
