/**
 * filterEngine.js — Motorul de filtrare locală client-side (SPEC_LocalFilter_v3)
 *
 * Principii:
 * 1. Logica booleană: OR în cadrul aceluiași atribut, AND între atribute diferite.
 * 2. Categoria ca filtru: îngustează scope-ul la nivel de catalog.
 * 3. Contoare faceted live: la calculul contorului unei valori, se aplică toate filtrele
 *    active cu excepția filtrului de pe propriul atribut (OR-siblings rule, §9.2).
 */

/**
 * Intersecție a două seturi
 */
export function intersectSets(setA, setB) {
  if (!setA) return new Set(setB)
  if (!setB) return new Set(setA)
  const result = new Set()
  for (const elem of setA) {
    if (setB.has(elem)) result.add(elem)
  }
  return result
}

/**
 * Reuniune a două seturi
 */
export function unionSets(setA, setB) {
  const result = new Set(setA)
  if (setB) {
    for (const elem of setB) result.add(elem)
  }
  return result
}

/**
 * Calculează setul de product_id rezultate pentru filtrele active
 * @param {Object} activeFilters - { [dimKey]: string[] } (ex: { category: ['cat_id'], tags: ['promo'], attr_id: ['27"'] })
 * @param {Object} indices - { global: {...}, categoryIndices: { [categoryId]: {...} } }
 * @param {Array} products - Lista de produse disponibile în scope
 * @param {string|null} fixedCategoryId - Dacă filtrarea e fixată pe o categorie (ex: CategoryPage)
 * @returns {Set<string>} Set de product_id care satisfac filtrele
 */
export function computeFilteredProductIds({
  activeFilters = {},
  indices = {},
  products = [],
  fixedCategoryId = null,
  excludeDimKey = null, // Pentru faceted counters (exclude propriul atribut)
}) {
  const allProductIds = new Set(
    (fixedCategoryId
      ? products.filter((p) => p.categoryId === fixedCategoryId && !p.deletedAt)
      : products.filter((p) => !p.deletedAt)
    ).map((p) => p.id)
  )

  let currentResultSet = null

  // 1. Filtrare după Categorie (dacă nu e exclusă și nu e fixedCategoryId)
  if (excludeDimKey !== 'category' && !fixedCategoryId) {
    const selectedCats = activeFilters.category || []
    if (selectedCats.length > 0) {
      const catProductIds = new Set(
        products
          .filter((p) => selectedCats.includes(p.categoryId) && !p.deletedAt)
          .map((p) => p.id)
      )
      currentResultSet = catProductIds
    }
  }

  // 2. Colectare indexuri relevante
  const globalIdx = indices.global || {}
  const selectedCatId = fixedCategoryId || (activeFilters.category?.[0] ?? null)
  const catIdx = (selectedCatId && indices.categoryIndices?.[selectedCatId]) || {}

  // Merge map: dimKey -> Array<{ value: string, idx: string[] }>
  const dimBuckets = { ...globalIdx, ...catIdx }

  // 3. Aplicare filtre pe atribute / tags
  for (const [dimKey, selectedValues] of Object.entries(activeFilters)) {
    if (dimKey === 'category') continue
    if (dimKey === excludeDimKey) continue
    if (!selectedValues || selectedValues.length === 0) continue

    const bucket = dimBuckets[dimKey] || []
    let dimUnionSet = new Set()

    for (const val of selectedValues) {
      const entry = bucket.find((b) => b.value === val)
      if (entry && Array.isArray(entry.idx)) {
        for (const pid of entry.idx) dimUnionSet.add(pid)
      }
    }

    if (currentResultSet === null) {
      currentResultSet = dimUnionSet
    } else {
      currentResultSet = intersectSets(currentResultSet, dimUnionSet)
    }
  }

  if (currentResultSet === null) {
    return allProductIds
  }

  // Restricționează la produsele existente în scope
  return intersectSets(allProductIds, currentResultSet)
}

/**
 * Calculează contoarele faceted pentru toate valorile unei dimensiuni
 * @returns {Object} { [value]: count }
 */
export function computeFacetedCountsForDimension({
  dimKey,
  values = [],
  activeFilters = {},
  indices = {},
  products = [],
  fixedCategoryId = null,
}) {
  // Calculăm matching set excluzând filtrul pe propriul atribut
  const baseMatchingSet = computeFilteredProductIds({
    activeFilters,
    indices,
    products,
    fixedCategoryId,
    excludeDimKey: dimKey,
  })

  const counts = {}

  if (dimKey === 'category') {
    // Pentru dimensiunea Categorie, numărăm produsele din baseMatchingSet aparținând acelei categorii
    const prodCatMap = new Map(products.map((p) => [p.id, p.categoryId]))
    for (const catId of values) {
      let c = 0
      for (const pid of baseMatchingSet) {
        if (prodCatMap.get(pid) === catId) c++
      }
      counts[catId] = c
    }
    return counts
  }

  const globalIdx = indices.global || {}
  const selectedCatId = fixedCategoryId || (activeFilters.category?.[0] ?? null)
  const catIdx = (selectedCatId && indices.categoryIndices?.[selectedCatId]) || {}
  const bucket = globalIdx[dimKey] || catIdx[dimKey] || []

  for (const val of values) {
    const entry = bucket.find((b) => b.value === val)
    if (!entry || !Array.isArray(entry.idx)) {
      counts[val] = 0
    } else {
      let c = 0
      for (const pid of entry.idx) {
        if (baseMatchingSet.has(pid)) c++
      }
      counts[val] = c
    }
  }

  return counts
}
