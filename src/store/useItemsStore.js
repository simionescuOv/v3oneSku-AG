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

      // ─────────────────────────────────────────────────────────────────────
      // TAG GROUPS — Foldere pentru organizarea tag-urilor (Many-to-Many)
      // Decuplat complet de items.tags (care rămâne string[] simplu pe fiecare item).
      // Schema:
      //   tagGroups: [{ id: string, name: string, position: number }]
      //   tagGroupMembers: { [groupId]: string[] }  — lista de tagValues per folder
      // ─────────────────────────────────────────────────────────────────────

      tagGroups: [],
      tagGroupMembers: {},

      // Creează un folder nou; returnează noul grup
      addTagGroup: (name) => {
        const groups = get().tagGroups
        const newGroup = {
          id: 'tg_' + generateId(),
          name: name.trim(),
          position: groups.length,
        }
        set((s) => ({
          tagGroups: [...s.tagGroups, newGroup],
          tagGroupMembers: { ...s.tagGroupMembers, [newGroup.id]: [] },
        }))
        return newGroup
      },

      // Redenumește un folder
      renameTagGroup: (groupId, newName) => {
        set((s) => ({
          tagGroups: s.tagGroups.map((g) =>
            g.id === groupId ? { ...g, name: newName.trim() } : g
          ),
        }))
      },

      // Șterge un folder (nu șterge tag-urile din items)
      deleteTagGroup: (groupId) => {
        set((s) => {
          const { [groupId]: _removed, ...rest } = s.tagGroupMembers
          return {
            tagGroups: s.tagGroups.filter((g) => g.id !== groupId),
            tagGroupMembers: rest,
          }
        })
      },

      // Asociere Many-to-Many: adaugă tagValues la mai multe grupuri simultan
      // Folosit în modul allowOrganize: dacă tagValues sunt bifate + grupuri bifate → Salvează
      associateTagsToGroups: ({ targetGroupIds, tagValues }) => {
        set((s) => {
          const updated = { ...s.tagGroupMembers }
          for (const groupId of targetGroupIds) {
            const existing = new Set(updated[groupId] ?? [])
            for (const tag of tagValues) existing.add(tag)
            updated[groupId] = [...existing]
          }
          return { tagGroupMembers: updated }
        })
      },

      // Creează un folder nou și îi asociază direct tagValues — combină addTagGroup + associate
      createGroupWithTags: ({ groupName, tagValues }) => {
        const groups = get().tagGroups
        const newGroup = {
          id: 'tg_' + generateId(),
          name: groupName.trim(),
          position: groups.length,
        }
        set((s) => ({
          tagGroups: [...s.tagGroups, newGroup],
          tagGroupMembers: {
            ...s.tagGroupMembers,
            [newGroup.id]: [...tagValues],
          },
        }))
        return newGroup
      },

      // Elimină un tag dintr-un folder specific
      removeTagFromGroup: (groupId, tagValue) => {
        set((s) => ({
          tagGroupMembers: {
            ...s.tagGroupMembers,
            [groupId]: (s.tagGroupMembers[groupId] ?? []).filter((t) => t !== tagValue),
          },
        }))
      },

      // Setează lista completă de tagValues pentru un folder (suprascriere)
      setGroupMembers: (groupId, tagValues) => {
        set((s) => ({
          tagGroupMembers: {
            ...s.tagGroupMembers,
            [groupId]: [...tagValues],
          },
        }))
      },

      // Returnează ID-urile grupurilor care conțin un anumit tag
      getGroupsForTag: (tagValue) => {
        const members = get().tagGroupMembers
        return Object.entries(members)
          .filter(([, tags]) => tags.includes(tagValue))
          .map(([groupId]) => groupId)
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
