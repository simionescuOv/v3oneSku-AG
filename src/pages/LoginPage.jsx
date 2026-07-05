import { useAuthStore } from '../store/useAuthStore'

export default function LoginPage() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8 bg-zinc-950 px-6">
      <h1 className="text-2xl font-semibold text-zinc-100 tracking-wide">oneSku</h1>
      <button
        onClick={signInWithGoogle}
        className="px-6 py-3 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors"
      >
        Continuă cu Google
      </button>
    </div>
  )
}
