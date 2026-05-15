'use client'

import { useState } from 'react'
import { FundingTab } from '@/components/dashboard/funding-tab'
import { DepegTab } from '@/components/dashboard/depeg-tab'
import { YieldTab } from '@/components/dashboard/yield-tab'
import { SpreadTab } from '@/components/dashboard/spread-tab'
import { AirdropTab } from '@/components/dashboard/airdrop-tab'
import { LPTab } from '@/components/dashboard/lp-tab'
import { ValidationDashboard } from '@/components/dashboard/validation-dashboard'
import { FlashLoanTab } from '@/components/dashboard/flash-loan-tab'
import { AaveLiquidationTab } from '@/components/dashboard/aave-liquidation-tab'
import { AlertPanel } from '@/components/dashboard/alert-panel'
import { StatsBar } from '@/components/dashboard/stats-bar'
import { UserMenu } from '@/components/auth/user-menu'
import { CapitalInput } from '@/components/CapitalInput'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { WalletBalance } from '@/components/wallet/WalletBalance'
import { useUser } from '@/hooks/use-user'
import { Bell } from 'lucide-react'

type Tab = 'airdrop' | 'lp' | 'yield' | 'depeg' | 'funding' | 'spread' | 'flashloan' | 'validation' | 'liquidations'

const TABS: { id: Tab; label: string; emoji: string; description: string }[] = [
  {
    id: 'airdrop',
    label: 'Airdrop Farming',
    emoji: '🪂',
    description: 'Protocolos sem token · DefiLlama · Tier S/A/B · Base-first · $0.50+',
  },
  {
    id: 'lp',
    label: 'LP Scanner',
    emoji: '💧',
    description: 'Aerodrome · Velodrome · Curve · Uniswap V3 · APY decomposto (fee vs emissão)',
  },
  {
    id: 'yield',
    label: 'Yield Rotation',
    emoji: '🌿',
    description: 'Aave V3 · Compound V3 · Curve · Yearn',
  },
  {
    id: 'depeg',
    label: 'Depeg Monitor',
    emoji: '🛡️',
    description: 'USDC · USDT · DAI · FRAX · LUSD · USDe',
  },
  {
    id: 'funding',
    label: 'Funding Rate',
    emoji: '⚡',
    description: 'Delta-neutral · 8h window · OKX + Binance + Bybit · $5k+',
  },
  {
    id: 'flashloan',
    label: 'Flash Loan',
    emoji: '⚡',
    description: 'Aave V3 Base · zero capital · Arbitragem atómica · Aerodrome · BaseSwap',
  },
  {
    id: 'spread',
    label: 'CEX-DEX Spread',
    emoji: '🔗',
    description: 'Binance · OKX vs Uniswap V3 · $5k+',
  },
  {
    id: 'validation',
    label: 'Validação',
    emoji: '📊',
    description: 'Edge Tracker · Persistência · Paper Trades · Veredicto GO/NO-GO',
  },
  {
    id: 'liquidations',
    label: 'Aave Monitor',
    emoji: '🔴',
    description: 'Liquidation bot · Posições Aave V3 em risco · Base Chain · HF em tempo real',
  },
]

export default function DashboardPage() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState<Tab>('airdrop')
  const [mobileAlertOpen, setMobileAlertOpen] = useState(false)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400">
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-100 leading-none">
                Multi-Strategy Survival Scanner
              </h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">
                7 estratégias · Airdrop + LP + Yield + Depeg + Funding + Spread + Flash Loan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CapitalInput />
            <WalletBalance />
            <ConnectButton />
            {user && (
              <span className="text-xs text-slate-500 hidden md:block">
                {user.email?.split('@')[0]}
              </span>
            )}
            <UserMenu />
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="border-b border-slate-700/30 bg-slate-900/50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <StatsBar />
        </div>
      </div>

      {/* Tab description strip */}
      <div className="border-b border-slate-700/20 bg-slate-900/30">
        <div className="max-w-screen-2xl mx-auto px-4 py-2">
          <p className="text-xs text-slate-500">
            {TABS.find((t) => t.id === activeTab)?.description}
          </p>
        </div>
      </div>

      {/* Main layout — content + sidebar */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6 lg:flex lg:gap-6 lg:items-start">
        <main className="flex-1 min-w-0">
          {activeTab === 'airdrop'  && <AirdropTab />}
          {activeTab === 'lp'       && <LPTab />}
          {activeTab === 'yield'    && <YieldTab />}
          {activeTab === 'depeg'    && <DepegTab />}
          {activeTab === 'funding'  && <FundingTab />}
          {activeTab === 'flashloan'  && <FlashLoanTab />}
          {activeTab === 'spread'     && <SpreadTab />}
          {activeTab === 'validation'  && <ValidationDashboard />}
          {activeTab === 'liquidations' && <AaveLiquidationTab />}
        </main>

        <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 bg-slate-900/60 border border-slate-700/50 rounded-xl sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden">
          <AlertPanel />
        </aside>
      </div>

      {/* Mobile: floating bell button */}
      <button
        onClick={() => setMobileAlertOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 w-12 h-12 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center shadow-xl z-40 hover:bg-slate-700 transition-colors"
        aria-label="Abrir alertas"
      >
        <Bell className="w-5 h-5 text-slate-300" />
      </button>

      {mobileAlertOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setMobileAlertOpen(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900 border-l border-slate-700/50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertPanel onClose={() => setMobileAlertOpen(false)} />
          </div>
        </div>
      )}

      <footer className="border-t border-slate-700/30 mt-12">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>Multi-Strategy Survival Scanner v2 — Dados reais. Não é aconselhamento financeiro.</span>
          <span>DefiLlama · Aerodrome · Velodrome · Curve · Uniswap V3 · OKX · Binance · Bybit</span>
        </div>
      </footer>
    </div>
  )
}




