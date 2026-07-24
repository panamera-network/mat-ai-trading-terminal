import { useState, useCallback, useRef, useEffect } from 'react'
import { IChartApi, ISeriesApi } from 'lightweight-charts'
import { Symbol } from '@/types/market'
import { useOrderStore } from '@/stores/orderStore'

interface ChartContextMenuProps {
  chart: IChartApi | null
  series: ISeriesApi<any> | null
  symbol: Symbol
  bid: number
  ask: number
  spread: number
}

export default function ChartContextMenu({ chart, series, symbol, bid, ask, spread }: ChartContextMenuProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; price: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const placeOrder = useOrderStore((s) => s.placeOrder)

  useEffect(() => {
    if (!chart || !series) return
    const chartEl = chart.chartElement()

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const rect = chartEl.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const price = series.coordinateToPrice(y)
      if (price !== null) {
        setMenu({ x: e.clientX, y: e.clientY, price })
      }
    }

    chartEl.addEventListener('contextmenu', handleContextMenu)
    return () => chartEl.removeEventListener('contextmenu', handleContextMenu)
  }, [chart, series])

  // Close menu on click outside
  useEffect(() => {
    if (!menu) return
    const handleClick = () => setMenu(null)
    setTimeout(() => window.addEventListener('click', handleClick), 0)
    return () => window.removeEventListener('click', handleClick)
  }, [menu])

  const handleBuyLimit = useCallback(() => {
    if (!menu) return
    placeOrder({
      symbol,
      side: 'buy',
      type: 'limit',
      price: menu.price,
      size: 0.1,
      currentPrice: (bid + ask) / 2,
      spread,
      bid,
      ask,
    })
    setMenu(null)
  }, [menu, symbol, bid, ask, spread, placeOrder])

  const handleSellLimit = useCallback(() => {
    if (!menu) return
    placeOrder({
      symbol,
      side: 'sell',
      type: 'limit',
      price: menu.price,
      size: 0.1,
      currentPrice: (bid + ask) / 2,
      spread,
      bid,
      ask,
    })
    setMenu(null)
  }, [menu, symbol, bid, ask, spread, placeOrder])

  const handleBuyStop = useCallback(() => {
    if (!menu) return
    placeOrder({
      symbol,
      side: 'buy',
      type: 'stop',
      stopPrice: menu.price,
      size: 0.1,
      currentPrice: (bid + ask) / 2,
      spread,
      bid,
      ask,
    })
    setMenu(null)
  }, [menu, symbol, bid, ask, spread, placeOrder])

  const handleSellStop = useCallback(() => {
    if (!menu) return
    placeOrder({
      symbol,
      side: 'sell',
      type: 'stop',
      stopPrice: menu.price,
      size: 0.1,
      currentPrice: (bid + ask) / 2,
      spread,
      bid,
      ask,
    })
    setMenu(null)
  }, [menu, symbol, bid, ask, spread, placeOrder])

  const handleSetAlert = useCallback(() => {
    // TODO: Implement price alerts
    console.log('Set alert at', menu?.price)
    setMenu(null)
  }, [menu])

  if (!menu) return null

  return (
    <div
      ref={menuRef}
      className="fixed bg-[#1e222d] border border-gray-700 rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="px-3 py-1 border-b border-gray-700">
        <span className="text-gray-400 text-[10px] uppercase">Price</span>
        <span className="text-white text-xs font-mono ml-2">{menu.price.toFixed(symbol.digits)}</span>
      </div>

      <button onClick={handleBuyLimit} className="w-full text-left px-3 py-1.5 text-xs text-green-400 hover:bg-gray-700 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Buy Limit Here
      </button>
      <button onClick={handleSellLimit} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Sell Limit Here
      </button>

      <div className="border-t border-gray-700 my-1" />

      <button onClick={handleBuyStop} className="w-full text-left px-3 py-1.5 text-xs text-green-400 hover:bg-gray-700 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Buy Stop Here
      </button>
      <button onClick={handleSellStop} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Sell Stop Here
      </button>

      <div className="border-t border-gray-700 my-1" />

      <button onClick={handleSetAlert} className="w-full text-left px-3 py-1.5 text-xs text-yellow-400 hover:bg-gray-700 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
        Set Alert
      </button>
    </div>
  )
}
