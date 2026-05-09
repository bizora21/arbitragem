import { Suspense } from 'react'
import { TrendingUp } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'

export const metadata = {
  title: 'Entrar — FundingRate Scanner',
}

function LoadingCard() {
  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/2" />
        <div className="h-10 bg-slate-800 rounded" />
        <div className="h-10 bg-slate-800 rounded" />
        <div className="h-10 bg-slate-700 rounded" />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="relative w-3 h-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </div>
            <TrendingUp className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">FundingRate Scanner</h1>
          <p className="text-sm text-slate-500 mt-1">
            Arbitragem Delta-Neutral • OKX + Binance + Bybit
          </p>
        </div>

        {/* LoginForm precisa de Suspense por causa de useSearchParams */}
        <Suspense fallback={<LoadingCard />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-slate-700 mt-6">
          Dados de mercado em tempo real. Não é aconselhamento financeiro.
        </p>
      </div>
    </div>
  )
}
