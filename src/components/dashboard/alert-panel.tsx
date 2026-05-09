'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, BellOff, Trash2, Plus } from 'lucide-react'
import { Alert, AlertType, Exchange } from '@/types'

const ALERT_LABELS: Record<AlertType, string> = {
  FUNDING_SPIKE: 'Spike de Funding',
  FLIP_WARNING: 'Aviso de Flip',
  ARB_OPPORTUNITY: 'Oportunidade ARB',
}

const ALERT_COLORS: Record<AlertType, string> = {
  FUNDING_SPIKE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  FLIP_WARNING: 'bg-red-500/20 text-red-300 border-red-500/30',
  ARB_OPPORTUNITY: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

export function AlertPanel({ userId = 'demo-user' }: { userId?: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'ARB_OPPORTUNITY' as AlertType,
    symbol: 'BTCUSDT',
    exchange: 'BINANCE' as Exchange,
    message: '',
    threshold: '',
  })

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/alerts?userId=${userId}`)
      const json = await res.json()
      setAlerts(json.data ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [userId])

  const handleCreate = async () => {
    if (!form.message) return
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...form,
          threshold: form.threshold ? parseFloat(form.threshold) : null,
        }),
      })
      setShowForm(false)
      fetchAlerts()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' })
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      // ignore
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            Alertas
            {alerts.length > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {alerts.length}
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="bg-slate-700/30 rounded-lg p-3 space-y-2 text-sm">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as AlertType })}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
            >
              <option value="ARB_OPPORTUNITY">Oportunidade ARB</option>
              <option value="FUNDING_SPIKE">Spike de Funding</option>
              <option value="FLIP_WARNING">Aviso de Flip</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Símbolo (ex: BTCUSDT)"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
              />
              <select
                value={form.exchange}
                onChange={(e) => setForm({ ...form, exchange: e.target.value as Exchange })}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
              >
                <option>OKX</option>
                <option>BINANCE</option>
                <option>BYBIT</option>
              </select>
            </div>
            <input
              placeholder="Mensagem do alerta"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
            />
            <input
              placeholder="Threshold (opcional, ex: 0.001)"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-slate-200"
            />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} className="flex-1">Criar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {loading && <div className="text-sm text-slate-500 text-center py-4">Carregando...</div>}

        {!loading && alerts.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-4 flex flex-col items-center gap-2">
            <BellOff className="w-8 h-8 opacity-30" />
            Nenhum alerta configurado
          </div>
        )}

        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start justify-between gap-2 bg-slate-700/20 rounded-lg p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={ALERT_COLORS[alert.type as AlertType]}>
                  {ALERT_LABELS[alert.type as AlertType]}
                </Badge>
                <span className="text-xs text-slate-500">{alert.symbol}</span>
              </div>
              <p className="text-xs text-slate-300 truncate">{alert.message}</p>
              {alert.threshold && (
                <p className="text-xs text-slate-500 mt-0.5">Threshold: {alert.threshold}</p>
              )}
            </div>
            <button
              onClick={() => handleDelete(alert.id)}
              className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
