import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Multi-Strategy Survival Scanner',
  description: 'Monitor funding rates, depegs, yield rotation e CEX-DEX spreads em tempo real.',
  keywords: ['funding rate', 'arbitrage', 'crypto', 'OKX', 'Binance', 'Bybit', 'DeFi', 'yield'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning>
      <body className="min-h-full gradient-bg text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
