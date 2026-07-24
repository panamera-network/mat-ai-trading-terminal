import { useState } from 'react'
import { Symbol } from '@/types/market'
import { Position } from '@/types/order'
import { useOrderStore } from '@/stores/orderStore'

interface PositionActionsProps {
  symbol: Symbol
  position: Position
  bid: number
  ask: number
  spread: number
}

type ConfirmState = { type: 'close'; pct: number } | { type: 'reverse' } | null

export default function PositionActions({ symbol, position, bid, ask, spread }: PositionActionsProps) {
  const placeOrder = useOrderStore((s) => s.placeOrder)
  const modifySLTP = useOrderStore((s) => s.modifySLTP)
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const currentPrice = (bid + ask) / 2
  const oppositeSide = position.side === 'buy' ? 'sell' : 'buy'
  const atBreakeven = position.slPrice === position.entryPrice

  const closePartial = (pct: number) => {
    const size = Math.round(position.size * pct * 100) / 100
    if (size < 0.01) return
    placeOrder({ symbol, side: oppositeSide, type: 'market', size, currentPrice, spread, bid, ask })
    setConfirm(null)
  }

  const reverse = () => {
    placeOrder({ symbol, side: oppositeSide, type: 'market', size: position.size * 2, currentPrice, spread, bid, ask })
    setConfirm(null)
  }

  const breakeven = () => {
    modifySLTP(symbol.id, position.entryPrice, undefined)
  }

  return (
    <div className="space-y-1 mt-1">
      <div className="grid grid-cols-4 gap-1">
        {[0.25, 0.5, 0.75].map((pct) => (
          <button
            key={pct}
            onClick={() => setConfirm({ type: 'close', pct })}
            className="py-1 text-[10px] rounded border border-gray-700 text-gray-400 hover:text-white"
          >
            {pct * 100}%
          </button>
        ))}
        <button
          onClick={() => setConfirm({ type: 'close', pct: 1 })}
          className="py-1 text-[10px] rounded border border-red-900 text-red-400 hover:text-red-300"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button
          onClick={breakeven}
          disabled={atBreakeven}
          className="py-1 text-[10px] rounded border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40"
        >
          Breakeven
        </button>
        <button
          onClick={() => setConfirm({ type: 'reverse' })}
          className="py-1 text-[10px] rounded border border-gray-700 text-gray-400 hover:text-white"
        >
          Reverse
        </button>
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setConfirm(null)}>
          <div className="bg-[#161a25] border border-gray-700 rounded-lg shadow-xl w-[240px] p-4" onClick={(e) => e.stopPropagation()}>
            {confirm.type === 'close' ? (
              <>
                <h4 className="text-white text-sm font-semibold mb-2">
                  Close {confirm.pct === 1 ? 'all' : `${confirm.pct * 100}%`}?
                </h4>
                <p className="text-xs text-gray-400 mb-1">{symbol.name} {position.side.toUpperCase()} {position.size.toFixed(2)}</p>
                <p className={`text-xs mb-3 ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  P&amp;L: ${position.unrealizedPnL.toFixed(2)}
                </p>
              </>
            ) : (
              <>
                <h4 className="text-white text-sm font-semibold mb-2">Reverse position?</h4>
                <p className="text-xs text-gray-400 mb-3">
                  Close {position.side.toUpperCase()} and open {oppositeSide.toUpperCase()} {position.size.toFixed(2)}
                </p>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={() => (confirm.type === 'close' ? closePartial(confirm.pct) : reverse())}
                className="flex-1 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
