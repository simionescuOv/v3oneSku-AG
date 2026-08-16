# oneSku — SPEC Formular Secvențial Produs (Adăugare & Editare)

> **Status**: Propunere / Specificație viitoare  
> **Domeniu**: Fluxul de adăugare și editare de produse în Catalog  
> **Componentă țintă**: `ProductFormSheet.jsx` (componentă unificată pentru ambele operațiuni)

---

## 1. Viziune & Obiectiv

Înlocuirea formularului clasic monobloc (vertical, cu multiple câmpuri și deschidere/închidere repetată de pickere) cu un **formular secvențial ghidat (Stepper / Wizard)**.

### Obiective UX:
1. **Viteză maximă de introducere pe mobil**: Utilizatorul este ghidat pas cu pas. Pentru atributele de tip `single_choice`, atingerea unei opțiuni salvează valoarea și avansează automat la pasul următor (*zero click-uri de confirmare intermediare*).
2. **Focus cognitiv**: Ecranul afișează un singur atribut la un moment dat, cu spațiu generos pentru opțiuni mari și vizibile.
3. **Componentă unică (Single Source of Truth)**: Aceeași componentă deservește atât **adăugarea** cât și **editarea** produselor, eliminând duplicarea codului.

---

## 2. Arhitectură & Componentă Unică

Componenta `ProductFormSheet.jsx` va implementa intern o mașină de stări pentru pașii formularului:

```
[Pas 1: Atribut 1] ──> [Pas 2: Atribut 2] ──> ... ──> [Pas N: Atribut N] ──> [Tags] ──> [Preț] ──> [Sumar & Confirmare]
       ▲                      │
       └────── [Înapoi] ──────┘
```

### Stare internă:
* `currentStepIndex`: indexul pasului activ (0 .. totalPași - 1).
* `values`: mapare `{ [attributeId]: valoare }`.
* `tags`: array de stringuri `['tag1', 'tag2']`.
* `listPrice`: valoare numerică sau string vid.
* `isEdit`: boolean (`true` dacă a fost furnizat prop-ul `product`).

---

## 3. Fluxul Pașilor în Detaliu

### Pasul A: Atributele Categoriei (ordonate după `position`)

Pentru fiecare atribut din schema categoriei (`category_attributes`):

#### 1. Tip `single_choice` (opțiune unică)
* **Afișare**: Titlul atributului (ex: *Culoare*) + lista completă de opțiuni existente sub formă de carduri/rânduri mari.
* **Căutare**: Conectată la BottomBar (`usePicker`) pentru filtrare rapidă când sunt multe opțiuni.
* **Adăugare opțiune nouă**: Dacă opțiunea tastată nu există, apare rândul de creare `+ Adaugă "..."`.
* **Interacțiune**:
  * Tap pe o opțiune -> valoarea este setată -> **avansare automată instantanee** la pasul următor.
  * Nu este necesară apăsarea vreunui buton suplimentar de confirmare.

#### 2. Tip `text` (text liber)
* **Afișare**: Titlul atributului (ex: *Descriere scurtă*) + input mare de text cu autofocus.
* **Interacțiune**:
  * Tastare text.
  * Avansare prin tasta `Enter / Next` de pe tastatură sau butonul `Continuă` din interfață.
  * Buton `Omite` (dacă atributul nu este obligatoriu).

---

### Pasul B: Tags (Atribut de sistem)
* **Tip**: Selecție multiplă (`multiSelect: true`).
* **Afișare**: Vocabularul sugerat de tag-uri existente (din `filter_idx.tags`) + tag-urile deja selectate.
* **Căutare & Creare**: Prin BottomBar / câmpul de căutare (`allowCreate: true`).
* **Interacțiune**:
  * Toggle pe tag-urile dorite.
  * Buton de avansare `Continuă` (sau `Omite` dacă nu se doresc tag-uri).

---

### Pasul C: Preț de Listă (Opțional)
* **Tip**: Input numeric (`inputMode="decimal"`).
* **Afișare**: Câmp clar pentru preț în RON.
* **Interacțiune**:
  * Introducere sumă și tap pe `Continuă` / `Omite`.

---

### Pasul D: Ecran de Sumar & Salvare Finală
* **Afișare**: Card sintetic cu toate datele culese:
  * Atribute completate (cu valorile lor).
  * Tag-uri selectate.
  * Preț de listă.
* **Corectare rapidă**: Tap pe oricare rând de atribut sare direct la pasul corespunzător pentru modificare, apoi revine la Sumar.
* **Acțiune finală**:
  * Buton principal `Creează produs` (la adăugare) sau `Salvează modificările` (la editare).

---

## 4. Diferențe între Creare și Editare

| Aspect | Mod Creare (`product = null`) | Mod Editare (`product = {...}`) |
|---|---|---|
| **Stare inițială** | Câmpuri goale | Prepopulate din `product.attributes`, `product.tags`, `product.listPrice` |
| **Punct de pornire** | Pornește direct de la **Pasul 1** | Poate porni de la **Ecranul de Sumar** (cu posibilitatea de a atinge orice atribut pentru a-l schimba direct) sau de la **Pasul 1** cu valorile deja bifate |
| **NameID** | Generat server-side la inserare | Imuabil (afișat în antet ca identificator) |
| **Operațiune Store** | `addProduct(categoryId, attributes, listPrice, tags)` | `updateProduct(productId, attributes, listPrice, tags)` |

---

## 5. Header și Navigare Formular

* **Bara de antet a sheet-ului**:
  * Buton `Înapoi` (`ChevronLeft`) stânga — revine la pasul anterior (dacă e la primul pas, închide sheet-ul cu confirmare/anulare).
  * Indicator de progres central: ex. `Pasul 2 din 5` sau puncte/bară subțire de progres.
  * Buton `Închide` (`X`) dreapta — închide formularul.
* **Gesturi**: Opțional swipe orizontal pentru înapoi / înainte între pași.

---

## 6. Integrarea cu Baza de Date & Store

Nu necesită modificări de schemă SQL. Schema existentă suportă nativ structura:
* Atributele sunt stocate în coloana `attributes` (`jsonb`) din tabela `products`.
* Tag-urile sunt stocate în `tags` (`text[]`).
* Prețul este stocat în `list_price` (`numeric`).
* Mutațiile apelează funcțiile existente din `useCatalogStore.js`:
  * Creare: `addProduct(...)` -> RPC `create_product`.
  * Editare: `updateProduct(...)` -> update direct Supabase cu RLS și trigger de rebuild `filter_idx`.
