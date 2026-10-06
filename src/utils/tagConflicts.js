// [ITEMS FEATURE] — Helpere pure pentru tag-uri de tip OR (foldere exclusive).
// Un folder cu tagType === 'OR' admite cel mult un tag pe înregistrare.
// Conflictele se DERIVĂ din tag-urile înregistrării + folderele curente (nu se stochează).

/**
 * @returns {{ conflictTags: Set<string>, groups: Array<{ groupId: string, name: string, tags: string[] }> }}
 */
export function getTagConflicts(tags, tagGroups, tagGroupMembers) {
  const conflictTags = new Set()
  const groups = []
  if (!tags || tags.length < 2) return { conflictTags, groups }

  for (const g of tagGroups) {
    if (g.tagType !== 'OR') continue
    const members = tagGroupMembers[g.id] ?? []
    const present = tags.filter((t) => members.includes(t))
    if (present.length >= 2) {
      present.forEach((t) => conflictTags.add(t))
      groups.push({ groupId: g.id, name: g.name, tags: present })
    }
  }
  return { conflictTags, groups }
}

/** Starea efectivă: flag manual SAU conflict OR. */
export function isItemEffectivelyIncomplete(item, tagGroups, tagGroupMembers) {
  if (item.isIncomplete) return true
  return getTagConflicts(item.tags, tagGroups, tagGroupMembers).groups.length > 0
}

/** Numără înregistrările care ar avea conflict dacă folderul ar deveni OR. */
export function countItemsConflictingInGroup(items, members) {
  if (!members || members.length < 2) return 0
  const set = new Set(members)
  let n = 0
  for (const it of items) {
    let c = 0
    for (const t of it.tags ?? []) {
      if (set.has(t) && ++c >= 2) {
        n++
        break
      }
    }
  }
  return n
}
