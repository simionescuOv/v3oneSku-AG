import { Type, List } from 'lucide-react'

/**
 * Registru centralizat și extensibil de tipuri de date pentru atributele de categorie.
 * Permite adăugarea facilă de noi tipuri de date (ex: number, boolean, date, multi_choice)
 * fără modificări complexe în SchemaSheet sau în motorul de import.
 */
export const ATTRIBUTE_TYPES = {
  text: {
    id: 'text',
    label: 'Text',
    icon: Type,
    description: 'Valori text libere per produs',
    isChoice: false,
    detect: (values) => true,
    parseValue: (raw) => (raw !== null && raw !== undefined ? String(raw).trim() : ''),
    validate: () => true,
  },
  single_choice: {
    id: 'single_choice',
    label: 'Listă cu o alegere',
    icon: List,
    description: 'Valoare dintr-o listă predefinită de opțiuni',
    isChoice: true,
    detect: (values) => {
      if (!values || values.length === 0) return false
      const nonEmpties = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
      if (nonEmpties.length === 0) return false
      const unique = new Set(nonEmpties.map((v) => String(v).trim()))
      // Dacă numărul de valori unice este <= 25 și reprezintă mai puțin de 70% din total
      return unique.size <= 25 && unique.size <= Math.max(2, nonEmpties.length * 0.7)
    },
    parseValue: (raw) => (raw !== null && raw !== undefined ? String(raw).trim() : ''),
    validate: () => true,
    extractOptions: (values) => {
      const set = new Set()
      for (const v of values || []) {
        if (v !== null && v !== undefined) {
          const clean = String(v).trim()
          if (clean) set.add(clean)
        }
      }
      return Array.from(set)
    },
  },
}

/**
 * Returnează toate tipurile de date înregistrate.
 */
export function getAllAttributeTypes() {
  return Object.values(ATTRIBUTE_TYPES)
}

/**
 * Returnează definiția unui tip de date după ID (cu fallback la text).
 */
export function getAttributeType(id) {
  return ATTRIBUTE_TYPES[id] || ATTRIBUTE_TYPES.text
}

/**
 * Euristică de auto-detecție a tipului de date sugerat pentru o coloană pe baza mostrelor din fișier.
 */
export function detectColumnType(sampleValues) {
  if (ATTRIBUTE_TYPES.single_choice.detect(sampleValues)) {
    return 'single_choice'
  }
  return 'text'
}
