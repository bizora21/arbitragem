'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

type Mode = 'login' | 'signup'

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'))
    setError(null)
    setSuccessMessage(null)
    setConfirmPassword('')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!validateEmail(email)) {
      setError('Endereço de email inválido.')
      return
    }
    if (password.length < 8) {
      setError('A palavra-passe deve ter no mínimo 8 caracteres.')
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('As palavras-passe não coincidem.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(redirectTo)
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        setSuccessMessage(
          'Conta criada! Verifica o teu email para confirmar o registo (ou inicia sessão diretamente se a confirmação estiver desativada).'
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro inesperado.'
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou palavra-passe incorretos.')
      } else if (msg.includes('Email not confirmed')) {
        setError('Email ainda não confirmado. Verifica a tua caixa de entrada.')
      } else if (msg.includes('User already registered')) {
        setError('Este email já está registado. Tenta iniciar sessão.')
      } else if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setError('Demasiadas tentativas. Aguarda alguns minutos.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-slate-100 mb-6">
        {mode === 'login' ? 'Iniciar Sessão' : 'Criar Conta'}
      </h2>

      {successMessage && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700/50 text-emerald-400 text-sm">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="o@teu.email"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
            Palavra-passe
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
              Confirmar Palavra-passe
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repete a palavra-passe"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm mt-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading
            ? mode === 'login' ? 'A entrar...' : 'A criar conta...'
            : mode === 'login' ? 'Entrar' : 'Criar Conta'
          }
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        {mode === 'login' ? 'Ainda não tens conta?' : 'Já tens conta?'}{' '}
        <button
          onClick={toggleMode}
          className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          {mode === 'login' ? 'Criar conta' : 'Iniciar sessão'}
        </button>
      </p>
    </div>
  )
}
