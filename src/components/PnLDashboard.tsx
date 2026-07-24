import { useOrderStore } from '@/stores/orderStore'
import { usePnL } from '@/hooks/usePnL'

interface PnLDashboardProps {
  symbol: string
}

export default function PnLDashboard({ symbol }: PnLDashboardProps) {
  const positions = useOrderStore((s) => s.positions)
  const trades = useOrderStore((s) => s.trades)
  const { summary } = usePnL(positions, trades)

  const symbolPositions = positions.filter((p) => p.symbol === symbol)

  return (
    <div className="w-[280px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-800">
        <h3 className="text-white text-sm font-semibold">P&amp;L Dashboard</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-gray-800">
        <div className={`rounded px-2 py-1.5 ${summary.totalUnrealized >= 0 ? 'bg-green-950/40' : 'bg-red-950/40'}`}>
          <div className="text-gray-500 text-[10px] uppercase">Unrealized</div>
          <div className={summary.totalUnrealized >= 0 ? 'text-green-400 text-sm font-semibold' : 'text-red-400 text-sm font-semibold'}>
            ${summary.totalUnrealized.toFixed(2)}
          </div>
        </div>
        <div className="rounded px-2 py-1.5 bg-[#1e222d]">
          <div className="text-gray-500 text-[10px] uppercase">Open positions</div>
          <div className="text-white text-sm font-semibold">{summary.openCount}</div>
        </div>
        <div className="rounded px-2 py-1.5 bg-[#1e222d]">
          <div className="text-gray-500 text-[10px] uppercase">Closed trades</div>
          <div className="text-white text-sm font-semibold">{summary.closedCount}</div>
        </div>
        <div className="rounded px-2 py-1.5 bg-[#1e222d]">
          <div className="text-gray-500 text-[10px] uppercase">Commission paid</div>
          <div className="text-white text-sm font-semibold">${summary.totalCommission.toFixed(2)}</div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-gray-800 flex justify-between text-xs">
        <span className="text-gray-500">SL hits <span className="text-red-400">{summary.slHits}</span></span>
        <span className="text-gray-500">TP hits <span className="text-green-400">{summary.tpHits}</span></span>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2">
        <h4 className="text-gray-400 text-[10px] uppercase mb-1">Positions</h4>
        {symbolPositions.length === 0 && <span className="text-gray-600 text-[10px]">No open positions for {symbol}</span>}
        <div className="space-y-1">
          {symbolPositions.map((pos) => (
            <div key={pos.id} className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1 text-xs">
              <span className={pos.side === 'buy' ? 'text-green-400' : 'text-red-400'}>{pos.side.toUpperCase()}</span>
              <span className="text-gray-400">{pos.size.toFixed(2)}</span>
              <span className={pos.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                ${pos.unrealizedPnL.toFixed(2)} ({pos.unrealizedPnLPips.toFixed(1)}p)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
