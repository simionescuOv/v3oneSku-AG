import { ATTRIBUTE_TYPES } from '../attributeTypes'
import { normalize } from '../search'
import { generateRandomNameId, isNameIdAvailable } from '../nameIdGenerator'

/**
 * Analizează coloanele extrase din fișier și propune o configurare inițială inteligentă.
 */
export function buildInitialColumnConfigs(headers, rows, existingCategoryAttributes = []) {
  const existingAttrsByName = new Map(
    existingCategoryAttributes.map((a) => [normalize(a.name), a])
  )

  return headers.map((header) => {
    const norm = normalize(header)
    const sampleValues = rows.slice(0, 10).map((r) => r[header])

    // 1. Detectare câmpuri speciale de sistem
    if (['nameid', 'name_id', 'name id', 'sku', 'cod', 'cod_produs', 'cod produs', 'identificator'].includes(norm)) {
      return {
        key: header,
        target: 'name_id',
        attrName: header,
        attrType: 'text',
        existingAttrId: null,
      }
    }

    if (['pret', 'preț', 'price', 'list_price', 'list price', 'pret_lista', 'preț de listă'].includes(norm)) {
      return {
        key: header,
        target: 'list_price',
        attrName: header,
        attrType: 'text',
        existingAttrId: null,
      }
    }

    if (['tags', 'taguri', 'etichete', 'tag', 'eticheta'].includes(norm)) {
      return {
        key: header,
        target: 'tags',
        attrName: header,
        attrType: 'text',
        existingAttrId: null,
      }
    }

    // 2. Verificare dacă atributul există deja în schemă
    if (existingAttrsByName.has(norm)) {
      const existing = existingAttrsByName.get(norm)
      return {
        key: header,
        target: 'attribute',
        attrName: existing.name,
        attrType: existing.type,
        existingAttrId: existing.id,
      }
    }

    // 3. Atribut nou cu auto-detecție tip
    const detectedType = ATTRIBUTE_TYPES.single_choice.detect(sampleValues)
      ? 'single_choice'
      : 'text'

    return {
      key: header,
      target: 'attribute',
      attrName: header,
      attrType: detectedType,
      existingAttrId: null,
    }
  })
}

/**
 * Validează mapările și detectează avertismente sau erori înainte de execuție.
 */
export function validateImportConfigs(columnConfigs, rows, existingProducts = []) {
  const issues = []
  const nameIdConfig = columnConfigs.find((c) => c.target === 'name_id')

  if (nameIdConfig) {
    const rawValues = rows.map((r) => String(r[nameIdConfig.key] ?? '').trim()).filter(Boolean)
    const seen = new Set()
    const duplicatesInFile = new Set()

    for (const val of rawValues) {
      const norm = normalize(val)
      if (seen.has(norm)) {
        duplicatesInFile.add(val)
      } else {
        seen.add(norm)
      }
    }

    const collisionsWithDb = []
    const existingNormSet = new Set(
      existingProducts.filter((p) => !p.deletedAt && p.nameId).map((p) => normalize(p.nameId))
    )

    for (const val of seen) {
      if (existingNormSet.has(val)) {
        collisionsWithDb.push(val)
      }
    }

    if (duplicatesInFile.size > 0) {
      issues.push({
        type: 'warning',
        field: 'name_id',
        message: `Există ${duplicatesInFile.size} valori NameID duplicate în fișier (ex: ${Array.from(duplicatesInFile).slice(0, 3).join(', ')}). Rândurile duplicate vor primi un NameID generat automat dacă bifați opțiunea de fallback.`,
      })
    }

    if (collisionsWithDb.length > 0) {
      issues.push({
        type: 'warning',
        field: 'name_id',
        message: `${collisionsWithDb.length} valori NameID există deja în catalog (ex: ${collisionsWithDb.slice(0, 3).join(', ')}).`,
      })
    }
  }

  return issues
}

/**
 * Curăță valoarea numerică pentru preț de listă.
 */
function parseNumericPrice(val) {
  if (val === null || val === undefined || val === '') return null
  const cleaned = String(val).replace(',', '.').replace(/[^0-9.-]/g, '').trim()
  if (!cleaned) return null
  const num = Number(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Extrage tag-urile dintr-o celulă (separate prin virgulă sau punct și virgulă).
 */
function parseTags(val) {
  if (val === null || val === undefined || val === '') return []
  return String(val)
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Procesează întregul import de produse conform configurărilor stabilite.
 */
export async function executeProductImport({
  categoryId,
  rows,
  columnConfigs,
  fallbackRandomNameIdOnCollision = true,
  store,
  onProgress,
}) {
  const {
    categoryAttributes = [],
    attributeOptions = [],
    products = [],
    addAttribute,
    addAttributeOption,
    addProduct,
    fetchCatalog,
  } = store

  const errors = []
  let createdCount = 0
  let skippedCount = 0
  let newAttrsCount = 0
  let newOptionsCount = 0

  // ── PASUL 1: Creare atribute noi de categorie ──────────────────────────────
  onProgress?.({
    step: 'attributes',
    current: 0,
    total: 1,
    percent: 10,
    label: 'Configurare atribute categorie...',
  })

  // Mapare: columnKey -> attributeId
  const resolvedAttributeIds = new Map()

  for (const config of columnConfigs) {
    if (config.target !== 'attribute') continue

    // Dacă este deja legat de un atribut existent
    if (config.existingAttrId) {
      resolvedAttributeIds.set(config.key, config.existingAttrId)
      continue
    }

    // Verificăm dacă există deja în schemă după nume normalizat
    const normName = normalize(config.attrName.trim())
    const existing = categoryAttributes.find(
      (a) => a.categoryId === categoryId && normalize(a.name) === normName
    )

    if (existing) {
      resolvedAttributeIds.set(config.key, existing.id)
    } else {
      // Creăm atribut nou
      const res = await addAttribute(categoryId, config.attrName.trim(), config.attrType)
      if (res.ok && res.data) {
        resolvedAttributeIds.set(config.key, res.data)
        newAttrsCount++
      } else {
        errors.push({
          row: 0,
          nameId: 'Schemă',
          error: `Nu s-a putut crea atributul „${config.attrName}”: ${res.error || 'Eroare necunoscută'}`,
        })
      }
    }
  }

  // ── PASUL 2: Adăugare opțiuni pentru single_choice ─────────────────────────
  onProgress?.({
    step: 'options',
    current: 0,
    total: 1,
    percent: 25,
    label: 'Configurare opțiuni de listă...',
  })

  for (const config of columnConfigs) {
    if (config.target !== 'attribute' || config.attrType !== 'single_choice') continue

    const attrId = resolvedAttributeIds.get(config.key)
    if (!attrId) continue

    const colValues = rows.map((r) => r[config.key])
    const uniqueVals = ATTRIBUTE_TYPES.single_choice.extractOptions(colValues)

    // Opțiuni deja existente în catalog
    const existingOptions = attributeOptions
      .filter((o) => o.attributeId === attrId)
      .map((o) => normalize(o.value))
    const existingSet = new Set(existingOptions)

    for (const val of uniqueVals) {
      const cleanVal = val.trim()
      if (cleanVal && !existingSet.has(normalize(cleanVal))) {
        const res = await addAttributeOption(attrId, cleanVal)
        if (res.ok) {
          existingSet.add(normalize(cleanVal))
          newOptionsCount++
        }
      }
    }
  }

  // ── PASUL 3: Creare produse ────────────────────────────────────────────────
  const nameIdConfig = columnConfigs.find((c) => c.target === 'name_id')
  const priceConfig = columnConfigs.find((c) => c.target === 'list_price')
  const tagsConfig = columnConfigs.find((c) => c.target === 'tags')

  // Pool local pentru evitarea coliziunilor intra-import
  const usedNameIdsSet = new Set(
    products.filter((p) => !p.deletedAt && p.nameId).map((p) => normalize(p.nameId))
  )

  const dynamicProductsPool = [...products]

  const totalRows = rows.length

  for (let i = 0; i < totalRows; i++) {
    const row = rows[i]
    const rowNum = i + 1

    const progressPercent = 25 + Math.round(((i + 1) / totalRows) * 70)
    onProgress?.({
      step: 'products',
      current: i + 1,
      total: totalRows,
      percent: progressPercent,
      label: `Importare produse (${i + 1}/${totalRows})...`,
    })

    // Construire atribute JSONB
    const attributes = {}
    for (const config of columnConfigs) {
      if (config.target !== 'attribute') continue
      const attrId = resolvedAttributeIds.get(config.key)
      if (!attrId) continue

      const rawVal = row[config.key]
      const parsedVal = ATTRIBUTE_TYPES[config.attrType]?.parseValue(rawVal)
      if (parsedVal) {
        attributes[attrId] = parsedVal
      }
    }

    // Rezolvare NameID
    let finalNameId = null

    if (nameIdConfig) {
      const rawCandidate = String(row[nameIdConfig.key] ?? '').trim()
      if (rawCandidate) {
        const normCandidate = normalize(rawCandidate)
        if (usedNameIdsSet.has(normCandidate)) {
          if (fallbackRandomNameIdOnCollision) {
            finalNameId = generateRandomNameId(dynamicProductsPool)
          } else {
            skippedCount++
            errors.push({
              row: rowNum,
              nameId: rawCandidate,
              error: `NameID „${rawCandidate}” există deja sau este duplicat în fișier.`,
            })
            continue
          }
        } else {
          finalNameId = rawCandidate
        }
      } else {
        // Celulă goală în coloana NameID -> generare aleatorie
        finalNameId = generateRandomNameId(dynamicProductsPool)
      }
    } else {
      // Nicio coloană mapată ca NameID -> generare aleatorie
      finalNameId = generateRandomNameId(dynamicProductsPool)
    }

    usedNameIdsSet.add(normalize(finalNameId))
    dynamicProductsPool.push({ nameId: finalNameId, deletedAt: null })

    // Rezolvare Preț de listă
    const listPrice = priceConfig ? parseNumericPrice(row[priceConfig.key]) : null

    // Rezolvare Tags
    const tags = tagsConfig ? parseTags(row[tagsConfig.key]) : []

    // Salvare produs
    const res = await addProduct(categoryId, attributes, listPrice, tags, finalNameId)
    if (res.ok) {
      createdCount++
    } else {
      skippedCount++
      errors.push({
        row: rowNum,
        nameId: finalNameId,
        error: res.error || 'Eroare la crearea produsului',
      })
    }
  }

  // ── PASUL 4: Resincronizare completă catalog Zustand ────────────────────────
  onProgress?.({
    step: 'finalize',
    current: totalRows,
    total: totalRows,
    percent: 100,
    label: 'Finalizare și actualizare catalog...',
  })

  await fetchCatalog()

  return {
    ok: true,
    createdCount,
    skippedCount,
    totalRows,
    newAttrsCount,
    newOptionsCount,
    errors,
  }
}
