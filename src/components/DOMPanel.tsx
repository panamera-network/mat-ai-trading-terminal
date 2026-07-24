import { useDepthData } from '@/hooks/useDepthData'
import { Symbol } from '@/types/market'
import { useMemo } from 'react'

interface DOMPanelProps {
  symbol: Symbol
}

export default function DOMPanel({ symbol }: DOMPanelProps) {
  const { depth } = useDepthData(symbol)

  const { maxSize, spread } = useMemo(() => {
    if (!depth) return { maxSize: 1, spread: 0 }
    const allSizes = [...depth.bids, ...depth.asks].map((l) => l.size)
    const max = Math.max(...allSizes, 1)
    const bestBid = depth.bids[0]?.price || 0
    const bestAsk = depth.asks[0]?.price || 0
    return { maxSize: max, spread: bestAsk - bestBid }
  }, [depth])

  if (!depth) {
    return (
      <div className="w-[200px] bg-[#161a25] border-l border-gray-800 flex items-center justify-center">
        <span className="text-gray-600 text-xs">Loading DOM...</span>
      </div>
    )
  }

  const midPrice = depth.lastPrice || (depth.bids[0]?.price + depth.asks[0]?.price) / 2

  return (
    <div className="w-[200px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-gray-800">
        <h3 className="text-white text-xs font-semibold">DOM</h3>
        <div className="flex justify-between text-[10px] mt-0.5">
          <span className="text-gray-500">Spread</span>
          <span className="text-yellow-400">{spread.toFixed(symbol.digits)}</span>
        </div>
      </div>

      {/* Asks (red, top) */}
      <div className="flex-1 overflow-auto">
        {[...depth.asks].reverse().map((level, i) => {
          const barWidth = (level.size / maxSize) * 100
          return (
            <div
              key={`ask-${i}`}
              className="relative flex items-center justify-between px-2 py-0.5 text-xs hover:bg-gray-800/50 cursor-pointer group"
              onClick={() => {
                // Could emit event to fill order price
              }}
            >
              {/* Size bar background */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-red-900/20"
                style={{ width: `${barWidth}%` }}
              />
              <span className="text-red-400 z-10 font-mono">
                {level.price.toFixed(symbol.digits)}
              </span>
              <span className="text-gray-400 z-10 font-mono text-[10px]">
                {level.size.toFixed(1)}
              </span>
            </div>
          )
        })}

        {/* Mid price */}
        <div className="px-2 py-1 border-y border-gray-700 bg-[#1e222d]">
          <span className="text-white text-xs font-mono font-bold block text-center">
            {midPrice.toFixed(symbol.digits)}
          </span>
        </div>

        {/* Bids (green, bottom) */}
        {depth.bids.map((level, i) => {
          const barWidth = (level.size / maxSize) * 100
          return (
            <div
              key={`bid-${i}`}
              className="relative flex items-center justify-between px-2 py-0.5 text-xs hover:bg-gray-800/50 cursor-pointer group"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-green-900/20"
                style={{ width: `${barWidth}%` }}
              />
              <span className="text-green-400 z-10 font-mono">
                {level.price.toFixed(symbol.digits)}
              </span>
              <span className="text-gray-400 z-10 font-mono text-[10px]">
                {level.size.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer stats */}
      <div className="px-2 py-1.5 border-t border-gray-800 text-[10px]">
        <div className="flex justify-between">
          <span className="text-gray-500">Total Bid</span>
          <span className="text-green-400">{depth.bids.reduce((s, l) => s + l.size, 0).toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Total Ask</span>
          <span className="text-red-400">{depth.asks.reduce((s, l) => s + l.size, 0).toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}
