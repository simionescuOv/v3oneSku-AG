import { normalize } from './search'

// Dicționar de cuvinte pentru NameID (substantive și adjective)
// Structură inspirată din generatorul Netlify/Supabase, garantând identificatori pronunțabili și unici.
const NOUNS = [
  'carrot', 'meadow', 'comet', 'lantern', 'harbor', 'cinder', 'willow', 'ember', 'granite', 'thicket',
  'otter', 'falcon', 'marble', 'quartz', 'ridge', 'brook', 'hazel', 'linden', 'cobalt', 'amber',
  'birch', 'cedar', 'coral', 'delta', 'ferry', 'glacier', 'heron', 'indigo', 'jasper', 'kestrel',
  'lagoon', 'maple', 'nectar', 'opal', 'pebble', 'quokka', 'raven', 'saffron', 'tundra', 'umber',
  'violet', 'walnut', 'yucca', 'zephyr', 'sparrow', 'thistle', 'canyon', 'meridian', 'anchor', 'basalt',
  'aurora', 'breeze', 'cascade', 'dune', 'flint', 'haven', 'island', 'jungle', 'lagoon', 'moss',
  'oasis', 'prism', 'reef', 'savanna', 'solstice', 'summit', 'timber', 'valley', 'whisper', 'zenith'
]

const ADJECTIVES = [
  'brave', 'quiet', 'swift', 'golden', 'silver', 'gentle', 'bold', 'calm', 'bright', 'clever',
  'eager', 'fierce', 'humble', 'jolly', 'keen', 'lively', 'merry', 'noble', 'proud', 'rustic',
  'sturdy', 'tidy', 'urban', 'vivid', 'warm', 'young', 'zealous', 'azure', 'crimson', 'dusty',
  'emerald', 'frosty', 'hollow', 'ivory', 'jade', 'lunar', 'misty', 'olive', 'coral', 'maroon',
  'amber', 'blissful', 'cosmic', 'dawn', 'epic', 'fresh', 'grand', 'harmonic', 'infinite', 'joyful'
]

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

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
 * Strategie:
 * 1. Încercare cu un singur substantiv (ex: "willow")
 * 2. Dacă există coliziune, încercare cu adjectiv-substantiv (ex: "brave-carrot")
 * 3. Fallback garantat: substantiv-număr (ex: "harbor-4291")
 */
export function generateRandomNameId(products = []) {
  const existingSet = new Set(
    (products || []).filter((p) => !p.deletedAt && p.nameId).map((p) => normalize(p.nameId))
  )

  // 1) Încercare cu substantiv simplu
  for (let i = 0; i < 15; i++) {
    const candidate = randomItem(NOUNS)
    if (!existingSet.has(normalize(candidate))) {
      return candidate
    }
  }

  // 2) Încercare cu adjectiv-substantiv
  for (let i = 0; i < 20; i++) {
    const candidate = `${randomItem(ADJECTIVES)}-${randomItem(NOUNS)}`
    if (!existingSet.has(normalize(candidate))) {
      return candidate
    }
  }

  // 3) Fallback garantat: substantiv + număr aleatoriu din 4 cifre
  let fallback = ''
  do {
    const num = 1000 + Math.floor(Math.random() * 9000)
    fallback = `${randomItem(NOUNS)}-${num}`
  } while (existingSet.has(normalize(fallback)))

  return fallback
}
