'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatUSD, getExchangeColor } from '@/lib/utils'
import { BarChart2, TrendingUp, TrendingDown } from 'lucide-react'
import { Position } from '@/types'

export function PositionTracker({ userId = 'demo-user' }: { userId?: string }) {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const res = await fetch(`/api/positions?userId=${userId}`)
        const json = await res.json()
        setPositions(json.data ?? [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchPositions()
    const interval = setInterval(fetchPositions, 30000)
    return () => clearInterval(interval)
  }, [userId])

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0)
  const totalFunding = positions.reduce((sum, p) => sum + p.fundingEarned, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart2 className="w-4 h-4 text-blue-400" />
          Posições Abertas
          <span className="ml-auto text-sm font-normal">
            PnL Total:{' '}
            <span className={totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {formatUSD(totalPnL)}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="text-sm text-slate-500 text-center py-4">Carregando posições...</div>
        )}

        {!loading && positions.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-6 flex flex-col items-center gap-2">
            <BarChart2 className="w-8 h-8 opacity-30" />
            <span>Nenhuma posição aberta</span>
            <span className="text-xs">Abra posições através das oportunidades de arbitragem</span>
          </div>
        )}

        {positions.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">Posições</div>
                <div className="font-bold text-slate-200">{positions.length}</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">Funding Earned</div>
                <div className="font-bold text-emerald-400">{formatUSD(totalFunding)}</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-500">PnL Total</div>
                <div className={`font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatUSD(totalPnL)}
                </div>
              </div>
            </div>

            {/* Position list */}
            <div className="space-y-2">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="bg-slate-700/20 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    {pos.pnl >= 0
                      ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                      : <TrendingDown className="w-4 h-4 text-red-400" />
                    }
                    <div>
                      <div className="font-semibold text-sm text-slate-200">
                        {pos.symbol.replace('USDT', '')}/USDT
                      </div>
                      <div className="text-xs text-slate-500">
                        {pos.side === 'LONG_SPOT_SHORT_PERP' ? 'Long Spot / Short Perp' : 'Short Spot / Long Perp'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getExchangeColor(pos.exchange as never)}>
                      {pos.exchange}
                    </Badge>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Size</div>
                      <div className="text-sm font-mono text-slate-200">{formatUSD(pos.positionSize)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">PnL</div>
                      <div className={`text-sm font-mono font-semibold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatUSD(pos.pnl)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
