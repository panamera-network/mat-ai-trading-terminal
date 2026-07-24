import { OHLCV } from '@/types'

// Simple Moving Average
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    result.push(sum / period)
  }
  return result
}

// Exponential Moving Average
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const multiplier = 2 / (period + 1)

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    if (i === period - 1) {
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0)
      result.push(sum / period)
      continue
    }
    const prevEma = result[i - 1]!
    result.push((data[i] - prevEma) * multiplier + prevEma)
  }
  return result
}

// RSI (Relative Strength Index)
export function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  const gains: number[] = []
  const losses: number[] = []

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null)
      continue
    }

    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period

    if (avgLoss === 0) {
      result.push(100)
    } else {
      const rs = avgGain / avgLoss
      result.push(100 - (100 / (1 + rs)))
    }
  }
  return result
}

// MACD
export interface MACDResult {
  macd: (number | null)[]
  signal: (number | null)[]
  histogram: (number | null)[]
}

export function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const emaFast = calculateEMA(data, fastPeriod)
  const emaSlow = calculateEMA(data, slowPeriod)

  const macdLine: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null)
    } else {
      macdLine.push(emaFast[i]! - emaSlow[i]!)
    }
  }

  // Signal line = EMA of MACD
  const validMacd = macdLine.map(v => v ?? 0)
  const signalLine = calculateEMA(validMacd, signalPeriod)

  const histogram: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null)
    } else {
      histogram.push(macdLine[i]! - signalLine[i]!)
    }
  }

  return { macd: macdLine, signal: signalLine, histogram }
}

// Bollinger Bands
export interface BollingerResult {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
}

export function calculateBollinger(
  data: number[],
  period: number = 20,
  multiplier: number = 2
): BollingerResult {
  const sma = calculateSMA(data, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      lower.push(null)
      continue
    }

    const slice = data.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
    const stdDev = Math.sqrt(variance)

    upper.push(mean + multiplier * stdDev)
    lower.push(mean - multiplier * stdDev)
  }

  return { upper, middle: sma, lower }
}

// VWAP (Volume Weighted Average Price)
export function calculateVWAP(data: OHLCV[]): (number | null)[] {
  const result: (number | null)[] = []
  let cumulativeTPV = 0
  let cumulativeVolume = 0

  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3
    const tpv = typicalPrice * data[i].volume

    cumulativeTPV += tpv
    cumulativeVolume += data[i].volume

    if (cumulativeVolume === 0) {
      result.push(null)
    } else {
      result.push(cumulativeTPV / cumulativeVolume)
    }
  }
  return result
}

// ATR (Average True Range)
export function calculateATR(data: OHLCV[], period: number = 14): (number | null)[] {
  const tr: number[] = []

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low)
    } else {
      const tr1 = data[i].high - data[i].low
      const tr2 = Math.abs(data[i].high - data[i - 1].close)
      const tr3 = Math.abs(data[i].low - data[i - 1].close)
      tr.push(Math.max(tr1, tr2, tr3))
    }
  }

  return calculateSMA(tr, period)
}

// Volume Profile: distributes each candle's volume across price bins it spans,
// returns the point of control (POC) and the 70% value area (VAH/VAL).
export interface VolumeProfileResult {
  priceLevels: number[]
  volumes: number[]
  poc: number
  vah: number
  val: number
  totalVolume: number
  maxVolume: number
}

export function calculateVolumeProfile(data: OHLCV[], bins: number = 50): VolumeProfileResult | null {
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

  const maxVolIndex = volumes.indexOf(Math.max(...volumes))
  const poc = priceLevels[maxVolIndex]

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
    maxVolume: Math.max(...volumes),
  }
}