import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

// Sursa de adevăr pentru user + tenant e sesiunea Supabase Auth, nu o valoare
// hardcodată. `tenantId` se citește din `tenant_members` (RLS permite userului
// să-și vadă propriile rânduri) — primul creat e tenantul propriu al userului
// (SPEC din PROMPT_ClaudeCode_auth_rls: owner/admin la primul login).
async function fetchTenantId(userId) {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.tenant_id ?? null
}

export const useAuthStore = create((set, get) => ({
  user: null,
  tenantId: null,
  initialized: false,

  init: async () => {
    if (get().initialized || get()._initializing) return
    set({ _initializing: true })

    const { data: { session } } = await supabase.auth.getSession()
    await get()._applySession(session)

    supabase.auth.onAuthStateChange((_event, newSession) => {
      get()._applySession(newSession)
    })
  },

  _applySession: async (session) => {
    const user = session?.user ?? null
    if (!user) {
      set({ user: null, tenantId: null, initialized: true, _initializing: false })
      return
    }
    const tenantId = await fetchTenantId(user.id)
    set({ user, tenantId, initialized: true, _initializing: false })
  },

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, tenantId: null })
  },
}))
