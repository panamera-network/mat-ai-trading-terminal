import { useEffect, useRef, useState } from 'react'
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { useOrderStore } from '@/stores/orderStore'
import { Symbol } from '@/types/market'

interface PositionLinesProps {
  chart: IChartApi
  series: ISeriesApi<'Candlestick'>
  symbol: Symbol
}

export default function PositionLines({ chart, series, symbol }: PositionLinesProps) {
  const position = useOrderStore((s) => s.positions.find((p) => p.symbol === symbol.id))
  const modifySLTP = useOrderStore((s) => s.modifySLTP)
  const priceLinesRef = useRef<any[]>([])
  const [drag, setDrag] = useState<{ type: 'sl' | 'tp'; price: number; y: number } | null>(null)

  useEffect(() => {
    // Clear previous lines
    priceLinesRef.current.forEach((line) => series.removePriceLine(line))
    priceLinesRef.current = []

    if (!position) return

    // Entry line
    const entryLine = series.createPriceLine({
      price: position.entryPrice,
      color: position.side === 'buy' ? '#26a69a' : '#ef5350',
      lineWidth: 1,
      lineStyle: 2,
      title: `${position.side.toUpperCase()} ${position.size.toFixed(2)}`,
    })
    priceLinesRef.current.push(entryLine)

    // SL line (draggable)
    if (position.slPrice) {
      const slLine = series.createPriceLine({
        price: position.slPrice,
        color: '#ef5350',
        lineWidth: 1,
        lineStyle: 2,
        title: 'SL',
      })
      // Note: lightweight-charts doesn't support draggable price lines natively
      // We simulate by updating on drag via mouse events on the chart
      priceLinesRef.current.push(slLine)
    }

    // TP line (draggable)
    if (position.tpPrice) {
      const tpLine = series.createPriceLine({
        price: position.tpPrice,
        color: '#26a69a',
        lineWidth: 1,
        lineStyle: 2,
        title: 'TP',
      })
      priceLinesRef.current.push(tpLine)
    }

    return () => {
      priceLinesRef.current.forEach((line) => {
        try { series.removePriceLine(line) } catch {}
      })
      priceLinesRef.current = []
    }
  }, [chart, series, position, symbol.id])

  // Handle drag on price scale to modify SL/TP
  useEffect(() => {
    if (!chart || !position) return

    const handleMouseDown = (e: MouseEvent) => {
      // Check if click is near SL/TP line on price scale
      const rect = chart.chartElement().getBoundingClientRect()
      const priceScaleWidth = 60 // approximate
      if (e.clientX < rect.right - priceScaleWidth) return

      const price = series.coordinateToPrice(e.clientY - rect.top)
      if (price === null) return

      const slDiff = position.slPrice ? Math.abs(price - position.slPrice) : Infinity
      const tpDiff = position.tpPrice ? Math.abs(price - position.tpPrice) : Infinity
      const threshold = symbol.pipSize * 10

      if (slDiff < threshold) {
        // Start dragging SL
        setDrag({ type: 'sl', price: position.slPrice!, y: e.clientY - rect.top })
        const handleMove = (moveE: MouseEvent) => {
          const y = moveE.clientY - rect.top
          const newPrice = series.coordinateToPrice(y)
          if (newPrice !== null) {
            modifySLTP(symbol.id, newPrice, undefined)
            setDrag({ type: 'sl', price: newPrice, y })
          }
        }
        const handleUp = () => {
          setDrag(null)
          window.removeEventListener('mousemove', handleMove)
          window.removeEventListener('mouseup', handleUp)
        }
        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
      } else if (tpDiff < threshold) {
        // Start dragging TP
        setDrag({ type: 'tp', price: position.tpPrice!, y: e.clientY - rect.top })
        const handleMove = (moveE: MouseEvent) => {
          const y = moveE.clientY - rect.top
          const newPrice = series.coordinateToPrice(y)
          if (newPrice !== null) {
            modifySLTP(symbol.id, undefined, newPrice)
            setDrag({ type: 'tp', price: newPrice, y })
          }
        }
        const handleUp = () => {
          setDrag(null)
          window.removeEventListener('mousemove', handleMove)
          window.removeEventListener('mouseup', handleUp)
        }
        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
      }
    }

    chart.chartElement().addEventListener('mousedown', handleMouseDown)
    return () => {
      chart.chartElement().removeEventListener('mousedown', handleMouseDown)
    }
  }, [chart, series, position, symbol, modifySLTP])

  if (!drag || !position) return null

  const pips = position.entryPrice ? Math.abs(drag.price - position.entryPrice) / symbol.pipSize : 0
  const color = drag.type === 'sl' ? '#ef5350' : '#26a69a'

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
      <div
        className="absolute left-0 right-0"
        style={{ top: drag.y, height: 1, backgroundColor: color }}
      />
      <div
        className="absolute rounded-full border-2 border-white"
        style={{
          top: drag.y - 6,
          right: 56,
          width: 12,
          height: 12,
          backgroundColor: color,
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        }}
      />
      <div
        className="absolute text-white text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap"
        style={{ top: drag.y - 20, right: 4, backgroundColor: color }}
      >
        {drag.type.toUpperCase()} {drag.price.toFixed(symbol.digits)} ({pips.toFixed(1)} pips)
      </div>
    </div>
  )
}
