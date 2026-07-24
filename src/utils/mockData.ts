import { OHLCV } from '@/types'

export function generateMockData(symbol: string, timeframe: string, count: number = 500): OHLCV[] {
  const data: OHLCV[] = []

  // Base price based on symbol
  const basePrice = symbol.includes('BTC') ? 65000 
    : symbol.includes('ETH') ? 3500
    : symbol.includes('SOL') ? 150
    : symbol.includes('EUR') ? 1.08
    : symbol.includes('GBP') ? 1.27
    : symbol.includes('JPY') ? 149
    : symbol.includes('AAPL') ? 220
    : symbol.includes('TSLA') ? 250
    : symbol.includes('NVDA') ? 120
    : 100

  let currentPrice = basePrice
  const now = Date.now() / 1000

  // Timeframe to seconds
  const tfSeconds: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
    '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800, '12h': 43200,
    '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000
  }

  const interval = tfSeconds[timeframe] || 3600

  for (let i = count; i >= 0; i--) {
    const time = Math.floor(now - i * interval)

    // Random walk with trend
    const volatility = basePrice * 0.002 // 0.2% volatility
    const trend = Math.sin(i * 0.05) * volatility * 2 // Cyclical trend
    const noise = (Math.random() - 0.5) * volatility

    const open = currentPrice
    const close = currentPrice + trend + noise
    const high = Math.max(open, close) + Math.random() * volatility * 0.5
    const low = Math.min(open, close) - Math.random() * volatility * 0.5
    const volume = Math.floor(Math.random() * 1000000) + 100000

    data.push({
      time,
      open: parseFloat(open.toFixed(symbol.includes('JPY') ? 3 : 2)),
      high: parseFloat(high.toFixed(symbol.includes('JPY') ? 3 : 2)),
      low: parseFloat(low.toFixed(symbol.includes('JPY') ? 3 : 2)),
      close: parseFloat(close.toFixed(symbol.includes('JPY') ? 3 : 2)),
      volume,
    })

    currentPrice = close
  }

  return data
}

// Volume Profile calculation
export function calculateVolumeProfile(data: OHLCV[], bins: number = 50) {
  if (data.length === 0) return null

  const priceMin = Math.min(...data.map(d => d.low))
  const priceMax = Math.max(...data.map(d => d.high))
  const binSize = (priceMax - priceMin) / bins

  const volumes = new Array(bins).fill(0)
  const priceLevels: number[] = []

  for (let i = 0; i < bins; i++) {
    priceLevels.push(priceMin + i * binSize)
  }

  for (const candle of data) {
    const lowBin = Math.max(0, Math.floor((candle.low - priceMin) / binSize))
    const highBin = Math.min(bins - 1, Math.floor((candle.high - priceMin) / binSize))
    const binsCovered = Math.max(1, highBin - lowBin + 1)
    const volPerBin = candle.volume / binsCovered

    for (let b = lowBin; b <= highBin; b++) {
      volumes[b] += volPerBin
    }
  }

  // POC
  const maxVolIndex = volumes.indexOf(Math.max(...volumes))
  const poc = priceLevels[maxVolIndex]

  // VAH/VAL (70% value area)
  const totalVol = volumes.reduce((a, b) => a + b, 0)
  const targetVol = totalVol * 0.7

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

  return {
    priceLevels,
    volumes,
    poc,
    vah,
    val,
    totalVolume: totalVol,
    maxVolume: Math.max(...volumes)
  }
}