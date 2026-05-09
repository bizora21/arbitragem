import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FundingRate Scanner | Arbitrage Dashboard',
  description: 'Monitor funding rates em tempo real e encontre oportunidades de arbitragem delta-neutral entre OKX, Binance e Bybit.',
  keywords: ['funding rate', 'arbitrage', 'crypto', 'OKX', 'Binance', 'Bybit', 'perpetual futures'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full gradient-bg text-slate-100 antialiased">
        {children}
      </body>
    </html>
  )
}
