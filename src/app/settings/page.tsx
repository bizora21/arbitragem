'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { useAccount, useDisconnect } from 'wagmi'
import {
  Moon, Monitor, ArrowLeft, Wallet, Shield, Bell,
  ChevronRight, Check, AlertTriangle, Eye, LogOut,
  Zap, RefreshCw, TrendingUp, Lock
} from 'lucide-react'

// ─── Theme selector ────────────────────────────────────────
function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-16 bg-slate-700/30 rounded-xl animate-pulse" />

  const options = [
    { id: 'dark',   label: 'Escuro',  icon: <Moon className="w-4 h-4" />,    desc: 'Fundo preto (recomendado)' },
    { id: 'system', label: 'Sistema', icon: <Monitor className="w-4 h-4" />, desc: `Segue o SO (${resolvedTheme === 'dark' ? 'escuro agora' : 'claro agora'})` },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = theme === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              active
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <span className={active ? 'text-emerald-400' : 'text-slate-400'}>{opt.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${active ? 'text-emerald-300' : 'text-slate-300'}`}>{opt.label}</p>
              <p className="text-[11px] text-slate-500 truncate">{opt.desc}</p>
            </div>
            {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Capital preferences ────────────────────────────────────
function CapitalPreferences() {
  const [capital, setCapital] = useState('1000')
  const [chain, setChain] = useState('Base')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('scanner_capital')
    if (stored) setCapital(stored)
    const storedChain = localStorage.getItem('scanner_chain')
    if (storedChain) setChain(storedChain)
  }, [])

  function save() {
    const val = parseFloat(capital)
    if (!isNaN(val) && val > 0) {
      localStorage.setItem('scanner_capital', val.toString())
      localStorage.setItem('scanner_chain', chain)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      window.dispatchEvent(new Event('capital-update'))
    }
  }

  const CHAINS = ['Base', 'Arbitrum', 'Optimism', 'Polygon', 'Ethereum']

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400 mb-1.5">Capital de operação (USD)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              min="1"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <button
            onClick={save}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : 'Guardar'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Usado para calcular viabilidade e retorno estimado por estratégia.
        </p>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1.5">Chain preferida</label>
        <div className="grid grid-cols-5 gap-1.5">
          {CHAINS.map((c) => (
            <button
              key={c}
              onClick={() => setChain(c)}
              className={`py-1.5 text-xs rounded-lg border transition-colors ${
                chain === c
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Wallet section ─────────────────────────────────────────
function WalletSection() {
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { chains, totalUsd, isLoading } = useWalletBalance()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-20 bg-slate-700/30 rounded-xl animate-pulse" />

  if (!isConnected) {
    return (
      <div className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <Wallet className="w-5 h-5 text-slate-500" />
        <div>
          <p className="text-sm text-slate-400">Nenhuma carteira conectada</p>
          <p className="text-xs text-slate-600">Liga a MetaMask no header para ver os saldos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-emerald-500/20 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-200 font-mono">
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </p>
            <p className="text-xs text-slate-500">{chain?.name ?? 'Chain desconhecida'}</p>
          </div>
        </div>
        <div className="text-right">
          {isLoading ? (
            <div className="w-16 h-4 bg-slate-700 rounded animate-pulse" />
          ) : (
            <p className="text-sm font-bold text-emerald-400">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUsd)}
            </p>
          )}
          <p className="text-[10px] text-slate-500">total</p>
        </div>
      </div>

      {/* Per chain */}
      <div className="space-y-1">
        {chains.filter((c) => c.totalUsd > 0.001).map((c) => (
          <div key={c.name} className="flex items-center justify-between px-3 py-2 bg-slate-800/30 rounded-lg">
            <span className="text-xs text-slate-400">{c.name}</span>
            <div className="flex gap-3 text-xs text-slate-500">
              {parseFloat(c.usdcBalance) > 0 && (
                <span><span className="text-slate-300">{parseFloat(c.usdcBalance).toFixed(2)}</span> USDC</span>
              )}
              {parseFloat(c.nativeBalance) > 0 && (
                <span><span className="text-slate-300">{parseFloat(c.nativeBalance).toFixed(4)}</span> {c.nativeSymbol}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => disconnect()}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Desconectar carteira
      </button>
    </div>
  )
}

// ─── Security panel ─────────────────────────────────────────
function SecurityPanel() {
  const rules = [
    { icon: <Lock className="w-4 h-4" />,       color: 'text-emerald-400', title: 'Leitura apenas', desc: 'O scanner NUNCA executa transações automaticamente' },
    { icon: <Eye className="w-4 h-4" />,         color: 'text-blue-400',    title: 'Sem seed phrase', desc: 'Nunca pedimos a tua seed phrase ou chave privada' },
    { icon: <Shield className="w-4 h-4" />,      color: 'text-purple-400',  title: '5 camadas de verificação', desc: 'On-chain · Identidade · Comunidade · IA · Manual' },
    { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-400', title: 'Zero aprovações infinitas', desc: 'Nunca aprovamos spending ilimitado de tokens' },
    { icon: <Zap className="w-4 h-4" />,         color: 'text-orange-400',  title: 'MetaMask confirma tudo', desc: 'Toda ação real requer o teu clique em Confirmar' },
  ]

  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
          <span className={r.color}>{r.icon}</span>
          <div>
            <p className="text-sm font-medium text-slate-200">{r.title}</p>
            <p className="text-xs text-slate-500">{r.desc}</p>
          </div>
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5 ml-auto" />
        </div>
      ))}
    </div>
  )
}

// ─── Scanner preferences ────────────────────────────────────
function ScannerPreferences() {
  const [refreshInterval, setRefreshInterval] = useState('auto')
  const [showLowCapital, setShowLowCapital] = useState(true)
  const [minTier, setMinTier] = useState('C')

  const intervals = [
    { id: 'auto', label: 'Auto' },
    { id: '30s',  label: '30s' },
    { id: '1m',   label: '1 min' },
    { id: '5m',   label: '5 min' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400 mb-1.5">Intervalo de atualização do dashboard</label>
        <div className="flex gap-1.5">
          {intervals.map((i) => (
            <button
              key={i.id}
              onClick={() => setRefreshInterval(i.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                refreshInterval === i.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">Mostrar estratégias com capital insuficiente</p>
          <p className="text-xs text-slate-500">Inclui oportunidades abaixo do teu capital</p>
        </div>
        <button
          onClick={() => setShowLowCapital(!showLowCapital)}
          className={`w-10 h-5 rounded-full transition-colors relative ${showLowCapital ? 'bg-emerald-600' : 'bg-slate-600'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showLowCapital ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1.5">Tier mínimo de airdrop no radar</label>
        <div className="flex gap-1.5">
          {['S', 'A', 'B', 'C'].map((t) => (
            <button
              key={t}
              onClick={() => setMinTier(t)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                minTier === t
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              Tier {t}+
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main settings page ──────────────────────────────────────
type Section = 'appearance' | 'wallet' | 'scanner' | 'security' | 'account'

const SECTIONS: { id: Section; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'appearance', label: 'Aparência',       icon: <Moon className="w-4 h-4" />,        desc: 'Tema e display' },
  { id: 'wallet',     label: 'Carteira',         icon: <Wallet className="w-4 h-4" />,      desc: 'Saldos e conexão' },
  { id: 'scanner',    label: 'Scanner',          icon: <TrendingUp className="w-4 h-4" />,  desc: 'Preferências de scan' },
  { id: 'security',   label: 'Segurança',        icon: <Shield className="w-4 h-4" />,      desc: 'Proteções ativas' },
  { id: 'account',    label: 'Conta',            icon: <LogOut className="w-4 h-4" />,      desc: 'Email e sessão' },
]

export default function SettingsPage() {
  const { user } = useUser()
  const router = useRouter()
  const [section, setSection] = useState<Section>('appearance')

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-slate-100">Definições</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar nav */}
        <nav className="w-44 shrink-0 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
                section === s.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <span className={section === s.id ? 'text-emerald-400' : ''}>{s.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.label}</p>
              </div>
              {section === s.id && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500" />}
            </button>
          ))}

          {/* Version */}
          <div className="pt-4 px-3">
            <p className="text-[10px] text-slate-600">Multi-Strategy Scanner</p>
            <p className="text-[10px] text-slate-600">v2.0 · DefiLlama + AI</p>
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-6">
          {section === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-100 mb-1">Tema</h2>
                <p className="text-xs text-slate-500 mb-3">Escolhe como o painel aparece no teu dispositivo.</p>
                <ThemeSelector />
              </div>
            </div>
          )}

          {section === 'wallet' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-100 mb-1">Carteira conectada</h2>
                <p className="text-xs text-slate-500 mb-3">Saldos em tempo real. Apenas leitura.</p>
                <WalletSection />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100 mb-1">Capital de operação</h2>
                <p className="text-xs text-slate-500 mb-3">Define o orçamento para simulação de retornos.</p>
                <CapitalPreferences />
              </div>
            </div>
          )}

          {section === 'scanner' && (
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-1">Preferências do scanner</h2>
              <p className="text-xs text-slate-500 mb-3">Ajusta como o scanner filtra e apresenta dados.</p>
              <ScannerPreferences />
            </div>
          )}

          {section === 'security' && (
            <div>
              <h2 className="text-base font-semibold text-slate-100 mb-1">Proteções de segurança</h2>
              <p className="text-xs text-slate-500 mb-3">
                5 camadas automáticas que protegem a tua carteira de golpes.
              </p>
              <SecurityPanel />
              <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-400 font-medium">Todas as proteções estão ativas</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  O scanner é read-only. Nunca assinas nada sem ver primeiro na MetaMask.
                </p>
              </div>
            </div>
          )}

          {section === 'account' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100 mb-1">Conta</h2>
                <p className="text-xs text-slate-500 mb-3">Informação da sessão atual.</p>
              </div>

              {user && (
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-base font-bold text-white">
                      {(user.email ?? 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{user.email}</p>
                      <p className="text-xs text-slate-500">
                        Desde {new Date(user.created_at ?? '').toLocaleDateString('pt-PT', { year: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={async () => {
                  const { createClient } = await import('@/lib/supabase/client')
                  await createClient().auth.signOut()
                  router.push('/login')
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Terminar sessão
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
