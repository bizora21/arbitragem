'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArbitrageOpportunity } from '@/types'
import { StatsBar } from '@/components/dashboard/stats-bar'
import { FundingRateTable } from '@/components/dashboard/funding-rate-card'
import { OpportunityCard } from '@/components/dashboard/opportunity-card'
import { FundingChart } from '@/components/dashboard/funding-chart'
import { ProfitCalculator } from '@/components/dashboard/profit-calculator'
import { RiskMeter } from '@/components/dashboard/risk-meter'
import { AlertPanel } from '@/components/dashboard/alert-panel'
import { PositionTracker } from '@/components/dashboard/position-tracker'
import { AIAnalysisModal } from '@/components/dashboard/ai-analysis-modal'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/auth/user-menu'
import { useUser } from '@/hooks/use-user'
import { ValidationDashboard } from '@/components/dashboard/validation-dashboard'
import {
  RefreshCw,
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Bell,
  Wallet,
  ChevronDown,
  FlaskConical,
} from 'lucide-react'

type TabId = 'dashboard' | 'opportunities' | 'chart' | 'positions' | 'alerts' | 'validation'

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'opportunities', label: 'Oportunidades', icon: TrendingUp },
  { id: 'chart', label: 'Gráfico', icon: BarChart2 },
  { id: 'positions', label: 'Posições', icon: Wallet },
  { id: 'alerts', label: 'Alertas', icon: Bell },
  { id: 'validation', label: 'Validação', icon: FlaskConical },
]

interface FundingRateRow {
  symbol: string
  OKX: number | null
  BINANCE: number | null
  BYBIT: number | null
  bestDiff: number
  nextFundingTime: string | null
}

export default function DashboardPage() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [capital, setCapital] = useState(5)
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [fundingRates, setFundingRates] = useState<FundingRateRow[]>([])
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([])
  const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errors, setErrors] = useState<{ rates?: string; opps?: string }>({})
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [showAllOpps, setShowAllOpps] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    const newErrors: { rates?: string; opps?: string } = {}

    const [ratesRes, oppsRes] = await Promise.allSettled([
      fetch('/api/funding-rates'),
      fetch(`/api/opportunities?capital=${capital}&limit=50`),
    ])

    if (ratesRes.status === 'fulfilled' && ratesRes.value.ok) {
      try {
        const json = await ratesRes.value.json()
        setFundingRates(json.data ?? [])
      } catch {
        newErrors.rates = 'Erro ao processar funding rates'
      }
    } else {
      newErrors.rates = 'Falha ao buscar funding rates das exchanges'
    }

    if (oppsRes.status === 'fulfilled' && oppsRes.value.ok) {
      try {
        const json = await oppsRes.value.json()
        setOpportunities(json.data ?? [])
      } catch {
        newErrors.opps = 'Erro ao processar oportunidades'
      }
    } else {
      newErrors.opps = 'Falha ao calcular oportunidades de arbitragem'
    }

    setErrors(newErrors)
    setLastUpdate(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [capital])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const topOpportunities = showAllOpps ? opportunities : opportunities.slice(0, 6)
  const bestOpportunity = opportunities[0] ?? null

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400">
                <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-100 leading-none">FundingRate Scanner</h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">
                Delta-Neutral Arbitrage • OKX + Binance + Bybit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-slate-500 hidden md:block">
                Olá, {user.email?.split('@')[0]}
              </span>
            )}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400">Capital:</span>
              <span className="text-slate-300 font-mono text-sm">$</span>
              <input
                type="number"
                min={5}
                value={capital}
                onChange={(e) => setCapital(parseFloat(e.target.value) || 5)}
                className="w-16 bg-transparent text-slate-100 font-mono text-sm focus:outline-none"
              />
            </div>

            {lastUpdate && (
              <span className="text-xs text-slate-600 hidden sm:block">
                Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
              </span>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <UserMenu />
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'opportunities' && opportunities.length > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 ml-1">
                  {opportunities.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {Object.entries(errors).map(([key, msg]) =>
          msg ? (
            <div key={key} className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-red-400 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{msg}</span>
            </div>
          ) : null
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Buscando funding rates em tempo real...</p>
              <p className="text-slate-600 text-xs mt-1">OKX • Binance • Bybit</p>
            </div>
          </div>
        )}

        {!loading && (
          <>
            <StatsBar />

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold text-slate-200">Funding Rates ao Vivo</h2>
                      <span className="text-xs text-slate-500">{fundingRates.length} pares — clique para ver gráfico</span>
                    </div>
                    <FundingRateTable
                      data={fundingRates.slice(0, 25)}
                      onSelectSymbol={(sym) => { setSelectedSymbol(sym); setActiveTab('chart') }}
                    />
                  </div>

                  <div className="space-y-4">
                    <ProfitCalculator initialFundingRate={bestOpportunity?.fundingRateDiff ?? 0.0003} />
                    {bestOpportunity && <RiskMeter score={bestOpportunity.riskScore} />}
                  </div>
                </div>

                {opportunities.length > 0 && (
                  <div>
                    <h2 className="font-semibold text-slate-200 mb-3">
                      Melhores Oportunidades de Arbitragem
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {opportunities.slice(0, 3).map((opp) => (
                        <OpportunityCard
                          key={opp.id}
                          opportunity={opp}
                          capital={capital}
                          onAnalyze={setSelectedOpportunity}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {opportunities.length === 0 && !loading && (
                  <div className="text-center py-8 text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/30">
                    <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma oportunidade com retorno &gt; 10% e risco ≤ 7 encontrada agora</p>
                    <p className="text-xs mt-1 text-slate-600">O mercado pode estar com funding rates baixos. Tente mais tarde.</p>
                  </div>
                )}
              </div>
            )}

            {/* OPPORTUNITIES */}
            {activeTab === 'opportunities' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-200">
                    Todas as Oportunidades
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({opportunities.length} encontradas)
                    </span>
                  </h2>
                  <div className="text-xs text-slate-500">Ordenado por retorno anual ÷ risco</div>
                </div>

                {opportunities.length === 0 && (
                  <div className="text-center py-16 text-slate-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma oportunidade encontrada com os filtros atuais</p>
                    <p className="text-xs mt-1">Filtros: retorno anual &gt; 10% • risco ≤ 7/10</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {topOpportunities.map((opp) => (
                    <OpportunityCard
                      key={opp.id}
                      opportunity={opp}
                      capital={capital}
                      onAnalyze={setSelectedOpportunity}
                    />
                  ))}
                </div>

                {opportunities.length > 6 && (
                  <div className="text-center">
                    <Button variant="outline" onClick={() => setShowAllOpps(!showAllOpps)} className="gap-2">
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAllOpps ? 'rotate-180' : ''}`} />
                      {showAllOpps ? 'Mostrar menos' : `Mostrar mais (${opportunities.length - 6} restantes)`}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* CHART */}
            {activeTab === 'chart' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-semibold text-slate-200">Histórico de Funding Rate</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Símbolo:</span>
                    <select
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none"
                    >
                      {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'].map((s) => (
                        <option key={s} value={s}>{s.replace('USDT', '')}/USDT</option>
                      ))}
                      {fundingRates.slice(0, 30).map((r) => (
                        r.symbol !== 'BTCUSDT' && r.symbol !== 'ETHUSDT' ? (
                          <option key={r.symbol} value={r.symbol}>
                            {r.symbol.replace('USDT', '')}/USDT
                          </option>
                        ) : null
                      ))}
                    </select>
                  </div>
                </div>
                <FundingChart symbol={selectedSymbol} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ProfitCalculator />
                  {bestOpportunity && <RiskMeter score={bestOpportunity.riskScore} />}
                </div>
              </div>
            )}

            {/* POSITIONS */}
            {activeTab === 'positions' && (
              <div className="space-y-4">
                <h2 className="font-semibold text-slate-200">Tracker de Posições</h2>
                <PositionTracker />
              </div>
            )}

            {/* ALERTS */}
            {activeTab === 'alerts' && (
              <div className="space-y-4">
                <h2 className="font-semibold text-slate-200">Gerenciar Alertas</h2>
                <div className="max-w-lg">
                  <AlertPanel />
                </div>
              </div>
            )}

            {/* VALIDATION */}
            {activeTab === 'validation' && <ValidationDashboard />}
          </>
        )}
      </main>

      <footer className="border-t border-slate-700/30 mt-12">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-slate-600">
          <span>FundingRate Scanner — Dados em tempo real. Não é aconselhamento financeiro.</span>
          <span>OKX • Binance • Bybit • Delta-Neutral</span>
        </div>
      </footer>

      {selectedOpportunity && (
        <AIAnalysisModal
          opportunity={selectedOpportunity}
          onClose={() => setSelectedOpportunity(null)}
        />
      )}
    </div>
  )
}
