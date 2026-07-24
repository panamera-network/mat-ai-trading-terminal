import { useMemo } from 'react'
import { OHLCV } from '@/types'
import { IChartApi } from 'lightweight-charts'

interface VolumeProfileOverlayProps {
  data: OHLCV[]
  chart: IChartApi | null
}

export default function VolumeProfileOverlay({ data, chart }: VolumeProfileOverlayProps) {
  const profile = useMemo(() => {
    if (data.length === 0) return null

    const visibleData = data.slice(-100) // Last 100 candles
    const priceMin = Math.min(...visibleData.map(d => d.low))
    const priceMax = Math.max(...visibleData.map(d => d.high))
    const bins = 50
    const binSize = (priceMax - priceMin) / bins

    const volumes = new Array(bins).fill(0)
    const priceLevels: number[] = []

    for (let i = 0; i < bins; i++) {
      priceLevels.push(priceMin + i * binSize)
    }

    // Distribute volume across bins
    for (const candle of visibleData) {
      const lowBin = Math.floor((candle.low - priceMin) / binSize)
      const highBin = Math.floor((candle.high - priceMin) / binSize)
      const binsCovered = Math.max(1, highBin - lowBin + 1)
      const volPerBin = candle.volume / binsCovered

      for (let b = Math.max(0, lowBin); b <= Math.min(bins - 1, highBin); b++) {
        volumes[b] += volPerBin
      }
    }

    // POC
    const maxVolIndex = volumes.indexOf(Math.max(...volumes))
    const poc = priceLevels[maxVolIndex]

    // VAH/VAL (70% value area)
    const totalVol = volumes.reduce((a, b) => a + b, 0)
    const targetVol = totalVol * 0.7

    // Sort by distance from POC, accumulate
    const indexed = volumes.map((v, i) => ({ vol: v, idx: i, dist: Math.abs(i - maxVolIndex) }))
    indexed.sort((a, b) => a.dist - b.dist)

    let cumVol = 0
    const vaIndices: number[] = []
    for (const item of indexed) {
      cumVol += item.vol
      vaIndices.push(item.idx)
      if (cumVol >= targetVol) break
    }

    const vah = priceLevels[Math.max(...vaIndices)]
    const val = priceLevels[Math.min(...vaIndices)]

    return { priceLevels, volumes, poc, vah, val, maxVol: Math.max(...volumes) }
  }, [data])

  if (!profile || !chart) return null

  const { priceLevels, volumes, poc, vah, val, maxVol } = profile

  // Calculate positions (simplified - right side overlay)
  const barWidth = 80 // pixels
  const maxBarHeight = 200 // approximate pixels per price level

  return (
    <div 
      className="absolute right-0 top-0 bottom-0 w-20 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {/* POC Line */}
      <div 
        className="absolute right-0 w-full border-t-2 border-blue-400"
        style={{ 
          top: '50%', // Simplified - would need actual coordinate conversion
        }}
      >
        <span className="absolute right-1 -top-3 text-[10px] text-blue-400 bg-chart-bg px-1">
          POC {poc.toFixed(2)}
        </span>
      </div>

      {/* VAH */}
      <div className="absolute right-0 w-full border-t border-dashed border-green-400">
        <span className="absolute right-1 -top-3 text-[10px] text-green-400 bg-chart-bg px-1">
          VAH {vah.toFixed(2)}
        </span>
      </div>

      {/* VAL */}
      <div className="absolute right-0 w-full border-t border-dashed border-red-400">
        <span className="absolute right-1 -top-3 text-[10px] text-red-400 bg-chart-bg px-1">
          VAL {val.toFixed(2)}
        </span>
      </div>

      {/* Value Area Background */}
      <div 
        className="absolute right-0 w-full bg-gray-500/10"
        style={{
          top: '30%',
          bottom: '30%',
        }}
      />
    </div>
  )
}