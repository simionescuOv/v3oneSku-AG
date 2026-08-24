// Cuvinte de validare generare build (se actualizează la fiecare push / commit major)
const BUILD_WORD = 'fagure'
const COMMIT_WORD = 'far'

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <h1 className="text-xl font-semibold text-zinc-100 tracking-wide">oneSku</h1>
      <p className="mt-2 text-2xl font-bold text-zinc-50">build: {BUILD_WORD}</p>
      <p className="mt-1 text-lg font-medium text-zinc-400">commit: {COMMIT_WORD}</p>
    </div>
  )
}
