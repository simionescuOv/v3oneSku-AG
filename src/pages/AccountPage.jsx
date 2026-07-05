import { LogOut } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'

export default function AccountPage() {
  const user = useAuthStore((s) => s.user)
  const tenantName = useAuthStore((s) => s.tenantName)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)

  const displayName = user?.user_metadata?.full_name || user?.email
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : '—'

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Account</h1>
      <p className="text-sm text-zinc-500 mb-6">Setări cont tenant.</p>

      <div className="max-w-sm rounded-lg border border-zinc-800 divide-y divide-zinc-800">
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500">Cont Google</p>
          <p className="text-sm font-medium text-zinc-100">{displayName ?? '—'}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500">Tenant</p>
          <p className="text-sm font-medium text-zinc-100">{tenantName ?? '—'}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500">Rol</p>
          <p className="text-sm font-medium text-zinc-100">{roleLabel}</p>
        </div>
      </div>

      <button
        onClick={signOut}
        className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 border border-zinc-800 hover:bg-zinc-800/60 transition-colors"
      >
        <LogOut size={18} />
        Deconectare
      </button>
    </div>
  )
}
