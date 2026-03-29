// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#070b10] flex items-center justify-center text-center px-4">
      <div>
        <p className="text-6xl font-bold text-white/10 mb-4">404</p>
        <p className="text-lg font-semibold text-white/40 mb-2">Página no encontrada</p>
        <p className="text-sm text-white/20 mb-8">
          La URL que buscas no existe o fue eliminada.
        </p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm
            transition-all shadow-lg shadow-emerald-500/20">
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
