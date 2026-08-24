const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g')

export function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '')
}

export function scoreMatch(label, tokens) {
  const words = normalize(label).split(/[\s-]+/).filter(Boolean)
  let total = 0
  const usedWords = new Set()
  for (const tok of tokens) {
    let best = null
    for (let i = 0; i < words.length; i++) {
      if (usedWords.has(i)) continue
      const word = words[i]
      if (word.startsWith(tok)) {
        const rank = i === 0 ? 0 : 1
        if (best === null || rank < best.rank) best = { idx: i, rank }
      } else if (tok.length >= 2 && word.includes(tok)) {
        if (best === null || 2 < best.rank) best = { idx: i, rank: 2 }
      }
    }
    if (best === null) return null
    usedWords.add(best.idx)
    total += best.rank
  }
  return total
}

export function filterAndSort(items, query, getLabel = (x) => x) {
  const q = normalize(query.trim())
  if (!q) return items
  const tokens = q.split(/[\s-]+/).filter(Boolean)
  const scored = []
  for (const item of items) {
    const s = scoreMatch(getLabel(item), tokens)
    if (s !== null) scored.push({ item, score: s })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.map((s) => s.item)
}

export function getAncestorFolders(nodes, nodeId) {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return []
  const chain = []
  let parentId = node.parentId
  while (parentId) {
    const parent = nodes.find((n) => n.id === parentId)
    if (!parent || parent.isTemp) break
    chain.unshift(parent)
    parentId = parent.parentId
  }
  return chain
}

export function buildSearchTree(nodes, matches) {
  const root = { node: null, children: [], categories: [], matched: false }

  function getOrCreateChild(cursor, folderNode) {
    let existing = cursor.children.find((c) => c.node.id === folderNode.id)
    if (!existing) {
      existing = { node: folderNode, children: [], categories: [], matched: false }
      cursor.children.push(existing)
    }
    return existing
  }

  for (const item of matches) {
    const chain = getAncestorFolders(nodes, item.id)
    let cursor = root
    for (const folder of chain) {
      cursor = getOrCreateChild(cursor, folder)
    }
    if (item.type === 'category' || item.type === 'space') {
      cursor.categories.push(item)
    } else {
      const entry = getOrCreateChild(cursor, item)
      entry.matched = true
    }
  }
  return root
}

export function sortTreeFolders(group, orderOf) {
  group.children.sort((a, b) => orderOf(a.node.id) - orderOf(b.node.id))
  group.children.forEach((child) => sortTreeFolders(child, orderOf))
}
