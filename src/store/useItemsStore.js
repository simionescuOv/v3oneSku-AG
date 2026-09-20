// [ITEMS FEATURE] — store izolat, removable. Șterge acest fișier pentru a elimina funcționalitatea.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Schema unui Item:
// {
//   id: string (uuid simplu)
//   value: number (întreg)
//   description: string
//   tags: string[]
//   moment: string (ISO 8601 — editabil de utilizator)
//   createdAt: string (ISO 8601 — automat, imuabil)
// }

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export const useItemsStore = create(
  persist(
    (set, get) => ({
      items: [],
      archivedItems: [],

      addItem: ({ value, description, tags, moment }) => {
        const now = new Date().toISOString()
        const newItem = {
          id: generateId(),
          value: parseInt(value, 10) || 0,
          description: description?.trim() ?? '',
          tags: tags ?? [],
          moment: moment || now,
          createdAt: now,
        }
        set((s) => ({ items: [newItem, ...s.items] }))
        return newItem
      },

      updateItem: (id, { value, description, tags, moment }) => {
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id
              ? {
                  ...it,
                  value: value !== undefined ? parseInt(value, 10) || 0 : it.value,
                  description: description !== undefined ? description.trim() : it.description,
                  tags: tags !== undefined ? tags : it.tags,
                  moment: moment !== undefined ? moment : it.moment,
                }
              : it
          ),
        }))
      },

      deleteItem: (id) => {
        set((s) => ({ items: s.items.filter((it) => it.id !== id) }))
      },

      // Mută elementele în arhivă
      archiveItems: (ids) => {
        const now = new Date().toISOString()
        const idSet = new Set(ids)
        set((s) => {
          const toArchive = s.items
            .filter((it) => idSet.has(it.id))
            .map((it) => ({ ...it, archivedAt: now }))
          return {
            items: s.items.filter((it) => !idSet.has(it.id)),
            archivedItems: [...toArchive, ...s.archivedItems],
          }
        })
      },

      // Recuperează elementele din arhivă înapoi în lista principală
      restoreItems: (ids) => {
        const idSet = new Set(ids)
        set((s) => {
          const toRestore = s.archivedItems
            .filter((it) => idSet.has(it.id))
            .map(({ archivedAt, ...it }) => it)
          return {
            archivedItems: s.archivedItems.filter((it) => !idSet.has(it.id)),
            items: [...toRestore, ...s.items],
          }
        })
      },

      getTagVocabulary: () => {
        const items = get().items
        const freq = {}
        for (const item of items) {
          for (const tag of item.tags ?? []) {
            freq[tag] = (freq[tag] ?? 0) + 1
          }
        }
        return Object.entries(freq)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      },

      getArchivedTagVocabulary: () => {
        const items = get().archivedItems
        const freq = {}
        for (const item of items) {
          for (const tag of item.tags ?? []) {
            freq[tag] = (freq[tag] ?? 0) + 1
          }
        }
        return Object.entries(freq)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      },
    }),
    {
      name: 'onesku-items',
    }
  )
)
