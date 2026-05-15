import { AaveLiquidationTab } from '@/components/dashboard/aave-liquidation-tab'

export const metadata = { title: 'Aave Liquidations — Scanner' }

export default function LiquidationsPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <h1 className="font-bold text-lg text-slate-100">Aave V3 Liquidation Monitor</h1>
          <span className="text-xs text-slate-500">Base Chain</span>
          <a href="/" className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Dashboard principal
          </a>
        </div>
      </header>
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <AaveLiquidationTab />
      </main>
    </div>
  )
}
