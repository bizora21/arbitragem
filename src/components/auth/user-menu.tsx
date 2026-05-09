'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'

export function UserMenu() {
  const { user, loading } = useUser()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
    )
  }

  if (!user) return null

  const initial = (user.email ?? 'U')[0].toUpperCase()
  const email = user.email ?? ''

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="Menu do utilizador"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white select-none">
          {initial}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Email do utilizador */}
          <div className="px-4 py-3 border-b border-slate-700">
            <p className="text-xs text-slate-500">Sessão iniciada como</p>
            <p className="text-sm text-slate-200 font-medium truncate mt-0.5">{email}</p>
          </div>

          {/* Opções */}
          <div className="p-1">
            <button
              onClick={() => { setOpen(false); router.push('/settings') }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Definições
            </button>

            <button
              onClick={handleLogout}
              disabled={signingOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-900/30 transition-colors text-left disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {signingOut ? 'A sair...' : 'Sair'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
