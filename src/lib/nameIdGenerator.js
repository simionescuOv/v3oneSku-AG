import { normalize } from './search'

let wordsCache = null

/**
 * Verifică dacă un Name ID este deja folosit de un alt produs existent.
 */
export function isNameIdAvailable(nameId, products = [], currentProductId = null) {
  if (!nameId || !nameId.trim()) return false
  const target = normalize(nameId.trim())
  return !products.some(
    (p) => !p.deletedAt && p.id !== currentProductId && normalize(p.nameId) === target
  )
}

/**
 * Generează un Name ID aleatoriu și garantat unic față de produsele din catalogul local.
 * Folosește un dicționar vast de ~275.000 cuvinte în engleză încărcat prin Lazy-Loading (pentru 
 * a nu îngreuna memoria sesiunilor normale).
 * Strategie:
 * 1. Încercare cu un singur cuvânt aleatoriu.
 * 2. Fallback extrem (practic imposibil) cu sufix numeric.
 */
export async function generateRandomNameId(products = []) {
  if (!wordsCache) {
    const mod = await import('an-array-of-english-words')
    wordsCache = mod.default
  }

  const existingSet = new Set(
    (products || []).filter((p) => !p.deletedAt && p.nameId).map((p) => normalize(p.nameId))
  )

  // 1) Încercare cu un singur cuvânt
  for (let i = 0; i < 1000; i++) {
    const candidate = wordsCache[Math.floor(Math.random() * wordsCache.length)]
    if (!existingSet.has(normalize(candidate))) {
      return candidate
    }
  }

  // 2) Fallback garantat: cuvânt + număr aleatoriu (în cazul extrem al coliziunilor repetate)
  let fallback = ''
  do {
    const num = 1000 + Math.floor(Math.random() * 900000)
    const baseWord = wordsCache[Math.floor(Math.random() * wordsCache.length)]
    fallback = `${baseWord}-${num}`
  } while (existingSet.has(normalize(fallback)))

  return fallback
}
