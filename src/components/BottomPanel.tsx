import { useState } from 'react'
import { Activity, List, TrendingUp, Settings } from 'lucide-react'
import { Symbol, ChartType } from '@/types/market'
import { useOrderStore } from '@/stores/orderStore'
import { useLayoutStore } from '@/stores/layoutStore'

type PanelTab = 'trades' | 'orders' | 'positions' | 'settings'

interface BottomPanelProps {
  chartId: string
  symbol: Symbol
}

export default function BottomPanel({ chartId, symbol }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('trades')
  const [isExpanded, setIsExpanded] = useState(false)

  const trades = useOrderStore((s) => s.trades.filter((t) => t.symbol === symbol.id))
  const orders = useOrderStore((s) => s.orders.filter((o) => o.symbol === symbol.id))
  const positions = useOrderStore((s) => s.positions.filter((p) => p.symbol === symbol.id))

  const chart = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId))
  const updateChart = useLayoutStore((s) => s.updateChart)
  const toggleShowVolume = useLayoutStore((s) => s.toggleShowVolume)
  const toggleShowGrid = useLayoutStore((s) => s.toggleShowGrid)
  const magnetMode = useLayoutStore((s) => s.magnetMode)
  const toggleMagnetMode = useLayoutStore((s) => s.toggleMagnetMode)

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'trades', label: 'Trades', icon: <Activity size={13} />, count: trades.length },
    { id: 'orders', label: 'Orders', icon: <List size={13} />, count: orders.length },
    { id: 'positions', label: 'Positions', icon: <TrendingUp size={13} />, count: positions.length },
    { id: 'settings', label: 'Settings', icon: <Settings size={13} /> },
  ]

  if (!chart) return null

  return (
    <div className={`bg-[#161a25] border-t border-gray-800 transition-all duration-200 flex-shrink-0 ${isExpanded ? 'h-56' : 'h-7'}`}>
      <div className="flex items-center h-7 border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-1.5 px-3 h-full text-[10px] transition-colors ${
              activeTab === tab.id ? 'bg-[#1e222d] text-white border-t-2 border-blue-500' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            onClick={() => { setActiveTab(tab.id); setIsExpanded(true) }}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && <span className="text-gray-500">({tab.count})</span>}
          </button>
        ))}

        <div className="flex-1" />

        <button className="px-3 text-gray-400 hover:text-white text-[10px]" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2 h-[calc(100%-1.75rem)] overflow-auto">
          {activeTab === 'trades' && (
            trades.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-500 text-xs">No trades yet for {symbol.name}.</div>
            ) : (
              <div className="space-y-1">
                {trades.map((t) => (
                  <div key={t.id} className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1 text-xs">
                    <span className="text-gray-500 w-24">{new Date(t.timestamp).toLocaleTimeString()}</span>
                    <span className={t.side === 'buy' ? 'text-green-400 w-10' : 'text-red-400 w-10'}>{t.side.toUpperCase()}</span>
                    <span className="text-white w-16">{t.price.toFixed(symbol.digits)}</span>
                    <span className="text-gray-400 w-14">{t.size.toFixed(2)}</span>
                    <span className="text-gray-500 w-16">{t.exitReason ?? 'open'}</span>
                    <span className="text-gray-500">${t.commission.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'orders' && (
            orders.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-500 text-xs">No orders for {symbol.name}.</div>
            ) : (
              <div className="space-y-1">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1 text-xs">
                    <span className={o.side === 'buy' ? 'text-green-400 w-10' : 'text-red-400 w-10'}>{o.side.toUpperCase()}</span>
                    <span className="text-gray-400 w-16">{o.type}</span>
                    <span className="text-white w-16">{o.price?.toFixed(symbol.digits) ?? 'MKT'}</span>
                    <span className="text-gray-400 w-14">{o.size.toFixed(2)}</span>
                    <span className="text-gray-500">{o.status}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'positions' && (
            positions.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-500 text-xs">No open positions for {symbol.name}.</div>
            ) : (
              <div className="space-y-1">
                {positions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1 text-xs">
                    <span className={p.side === 'buy' ? 'text-green-400 w-10' : 'text-red-400 w-10'}>{p.side.toUpperCase()}</span>
                    <span className="text-gray-400 w-14">{p.size.toFixed(2)}</span>
                    <span className="text-white w-16">{p.entryPrice.toFixed(symbol.digits)}</span>
                    <span className={p.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ${p.unrealizedPnL.toFixed(2)} ({p.unrealizedPnLPips.toFixed(1)}p)
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'settings' && (
            <div className="text-xs text-gray-400 space-y-2">
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span>Chart Type</span>
                <select
                  value={chart.chartType}
                  onChange={(e) => updateChart(chartId, { chartType: e.target.value as ChartType })}
                  className="bg-[#1e222d] border border-gray-700 rounded px-2 py-1 text-xs text-white"
                >
                  <option value="candlestick">Candlestick</option>
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                  <option value="heikin-ashi">Heikin Ashi</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span>Show Volume</span>
                <input type="checkbox" checked={chart.showVolume} onChange={() => toggleShowVolume(chartId)} className="accent-blue-500" />
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span>Show Grid</span>
                <input type="checkbox" checked={chart.showGrid} onChange={() => toggleShowGrid(chartId)} className="accent-blue-500" />
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span>Magnet Mode</span>
                <input type="checkbox" checked={magnetMode} onChange={() => toggleMagnetMode()} className="accent-blue-500" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
