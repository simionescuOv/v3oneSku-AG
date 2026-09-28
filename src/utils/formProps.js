/**
 * Proprietăți standard anti-autofill pentru elemente input și textarea.
 * Dezactivează bara de sugestii a tastaturii virtuale (parole, adrese, plăți)
 * în browsere mobile (Chromium, Brave pe Android) și servicii Android Autofill.
 */
export const NO_AUTOFILL_PROPS = {
  autoComplete: 'nope-do-not-autofill',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  role: 'presentation',
  'data-lpignore': 'true',
  'data-form-type': 'other',
}
