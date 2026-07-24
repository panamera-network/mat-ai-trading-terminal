import { useEffect, useRef } from 'react'
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
        const handleMove = (moveE: MouseEvent) => {
          const newPrice = series.coordinateToPrice(moveE.clientY - rect.top)
          if (newPrice !== null) modifySLTP(symbol.id, newPrice, undefined)
        }
        const handleUp = () => {
          window.removeEventListener('mousemove', handleMove)
          window.removeEventListener('mouseup', handleUp)
        }
        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
      } else if (tpDiff < threshold) {
        // Start dragging TP
        const handleMove = (moveE: MouseEvent) => {
          const newPrice = series.coordinateToPrice(moveE.clientY - rect.top)
          if (newPrice !== null) modifySLTP(symbol.id, undefined, newPrice)
        }
        const handleUp = () => {
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

  return null
}
