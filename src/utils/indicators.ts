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

export function calculateWMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const divisor = (period * (period + 1)) / 2
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    let sum = 0
    for (let j = 0; j < period; j++) sum += data[i - j] * (period - j)
    result.push(sum / divisor)
  }
  return result
}

export function calculateDEMA(data: number[], period: number): (number | null)[] {
  const ema1 = calculateEMA(data, period)
  const ema2 = calculateEMA(ema1.map((v) => v ?? data[0] ?? 0), period)
  return ema1.map((v, i) => (v === null || ema2[i] === null ? null : 2 * v - ema2[i]!))
}

export function calculateTEMA(data: number[], period: number): (number | null)[] {
  const ema1 = calculateEMA(data, period)
  const ema2 = calculateEMA(ema1.map((v) => v ?? data[0] ?? 0), period)
  const ema3 = calculateEMA(ema2.map((v) => v ?? data[0] ?? 0), period)
  return ema1.map((v, i) => (v === null || ema2[i] === null || ema3[i] === null ? null : 3 * v - 3 * ema2[i]! + ema3[i]!))
}

export function calculateHMA(data: number[], period: number): (number | null)[] {
  const half = Math.max(1, Math.floor(period / 2))
  const sqrt = Math.max(1, Math.round(Math.sqrt(period)))
  const wmaHalf = calculateWMA(data, half)
  const wmaFull = calculateWMA(data, period)
  const diff = data.map((_, i) => (wmaHalf[i] === null || wmaFull[i] === null ? 0 : 2 * wmaHalf[i]! - wmaFull[i]!))
  const hma = calculateWMA(diff, sqrt)
  return hma.map((v, i) => (i < period - 1 ? null : v))
}

export function calculateLSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const xSum = (period * (period - 1)) / 2
  const x2Sum = ((period - 1) * period * (2 * period - 1)) / 6
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
      continue
    }
    let ySum = 0
    let xySum = 0
    for (let j = 0; j < period; j++) {
      const y = data[i - period + 1 + j]
      ySum += y
      xySum += j * y
    }
    const slope = (period * xySum - xSum * ySum) / (period * x2Sum - xSum * xSum)
    const intercept = (ySum - slope * xSum) / period
    result.push(intercept + slope * (period - 1))
  }
  return result
}

export function calculateMcGinley(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[i])
      continue
    }
    const prev = result[i - 1] ?? data[i - 1]
    const ratio = prev === 0 ? 1 : data[i] / prev
    result.push(prev + (data[i] - prev) / (period * Math.pow(ratio, 4)))
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

export function calculateADR(data: OHLCV[], period: number = 14): (number | null)[] {
  return calculateSMA(data.map((d) => d.high - d.low), period)
}

export function calculateOBV(data: OHLCV[]): number[] {
  const result: number[] = []
  let obv = 0
  for (let i = 0; i < data.length; i++) {
    if (i > 0) {
      if (data[i].close > data[i - 1].close) obv += data[i].volume
      else if (data[i].close < data[i - 1].close) obv -= data[i].volume
    }
    result.push(obv)
  }
  return result
}

export function calculateVolumeDelta(data: OHLCV[]): number[] {
  return data.map((d) => d.close > d.open ? d.volume : d.close < d.open ? -d.volume : 0)
}

export function calculateStochastic(data: OHLCV[], period = 14, smoothK = 3, smoothD = 3) {
  const rawK: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      rawK.push(null)
      continue
    }
    const slice = data.slice(i - period + 1, i + 1)
    const high = Math.max(...slice.map((d) => d.high))
    const low = Math.min(...slice.map((d) => d.low))
    rawK.push(high === low ? 50 : ((data[i].close - low) / (high - low)) * 100)
  }
  const k = calculateSMA(rawK.map((v) => v ?? 0), smoothK).map((v, i) => (rawK[i] === null ? null : v))
  const d = calculateSMA(k.map((v) => v ?? 0), smoothD).map((v, i) => (k[i] === null ? null : v))
  return { k, d }
}

export function calculateCCI(data: OHLCV[], period = 20): (number | null)[] {
  const tp = data.map((d) => (d.high + d.low + d.close) / 3)
  const sma = calculateSMA(tp, period)
  return tp.map((value, i) => {
    if (i < period - 1 || sma[i] === null) return null
    const slice = tp.slice(i - period + 1, i + 1)
    const meanDev = slice.reduce((sum, v) => sum + Math.abs(v - sma[i]!), 0) / period
    return meanDev === 0 ? 0 : (value - sma[i]!) / (0.015 * meanDev)
  })
}

export function calculateAO(data: OHLCV[]): (number | null)[] {
  const median = data.map((d) => (d.high + d.low) / 2)
  const fast = calculateSMA(median, 5)
  const slow = calculateSMA(median, 34)
  return median.map((_, i) => (fast[i] === null || slow[i] === null ? null : fast[i]! - slow[i]!))
}

export function calculateBBP(data: OHLCV[], period = 13): { bull: (number | null)[]; bear: (number | null)[] } {
  const ema = calculateEMA(data.map((d) => d.close), period)
  return {
    bull: data.map((d, i) => (ema[i] === null ? null : d.high - ema[i]!)),
    bear: data.map((d, i) => (ema[i] === null ? null : d.low - ema[i]!)),
  }
}

export function calculateADX(data: OHLCV[], period = 14): (number | null)[] {
  const tr: number[] = []
  const plusDM: number[] = []
  const minusDM: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low)
      plusDM.push(0)
      minusDM.push(0)
      continue
    }
    const upMove = data[i].high - data[i - 1].high
    const downMove = data[i - 1].low - data[i].low
    tr.push(Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close)))
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }
  const atr = calculateEMA(tr, period)
  const plus = calculateEMA(plusDM, period)
  const minus = calculateEMA(minusDM, period)
  const dx = data.map((_, i) => {
    if (!atr[i] || plus[i] === null || minus[i] === null) return null
    const pdi = (plus[i]! / atr[i]!) * 100
    const mdi = (minus[i]! / atr[i]!) * 100
    return pdi + mdi === 0 ? 0 : (Math.abs(pdi - mdi) / (pdi + mdi)) * 100
  })
  return calculateEMA(dx.map((v) => v ?? 0), period).map((v, i) => (dx[i] === null ? null : v))
}

export function calculateDonchian(data: OHLCV[], period = 20) {
  return {
    upper: data.map((_, i) => i < period - 1 ? null : Math.max(...data.slice(i - period + 1, i + 1).map((d) => d.high))),
    lower: data.map((_, i) => i < period - 1 ? null : Math.min(...data.slice(i - period + 1, i + 1).map((d) => d.low))),
  }
}

export function calculateKeltner(data: OHLCV[], period = 20, multiplier = 2) {
  const mid = calculateEMA(data.map((d) => d.close), period)
  const atr = calculateATR(data, period)
  return {
    middle: mid,
    upper: mid.map((v, i) => (v === null || atr[i] === null ? null : v + atr[i]! * multiplier)),
    lower: mid.map((v, i) => (v === null || atr[i] === null ? null : v - atr[i]! * multiplier)),
  }
}

export function calculateEnvelope(data: number[], period = 20, percent = 1) {
  const mid = calculateSMA(data, period)
  return {
    middle: mid,
    upper: mid.map((v) => (v === null ? null : v * (1 + percent / 100))),
    lower: mid.map((v) => (v === null ? null : v * (1 - percent / 100))),
  }
}

export function calculateParabolicSAR(data: OHLCV[], step = 0.02, max = 0.2): (number | null)[] {
  if (data.length === 0) return []
  const result: (number | null)[] = [null]
  let long = true
  let af = step
  let ep = data[0].high
  let sar = data[0].low
  for (let i = 1; i < data.length; i++) {
    sar = sar + af * (ep - sar)
    if (long) {
      if (data[i].low < sar) {
        long = false
        sar = ep
        ep = data[i].low
        af = step
      } else if (data[i].high > ep) {
        ep = data[i].high
        af = Math.min(max, af + step)
      }
    } else {
      if (data[i].high > sar) {
        long = true
        sar = ep
        ep = data[i].high
        af = step
      } else if (data[i].low < ep) {
        ep = data[i].low
        af = Math.min(max, af + step)
      }
    }
    result.push(sar)
  }
  return result
}

export function calculateZigZag(data: OHLCV[], deviationPercent = 1): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null)
  if (data.length === 0) return result
  let pivotIndex = 0
  let pivotPrice = data[0].close
  let direction: 1 | -1 | 0 = 0
  result[0] = pivotPrice
  for (let i = 1; i < data.length; i++) {
    const price = data[i].close
    const change = ((price - pivotPrice) / pivotPrice) * 100
    if (direction >= 0 && change <= -deviationPercent) {
      result[pivotIndex] = pivotPrice
      direction = -1
      pivotIndex = i
      pivotPrice = price
    } else if (direction <= 0 && change >= deviationPercent) {
      result[pivotIndex] = pivotPrice
      direction = 1
      pivotIndex = i
      pivotPrice = price
    } else if ((direction >= 0 && price > pivotPrice) || (direction <= 0 && price < pivotPrice)) {
      result[pivotIndex] = null
      pivotIndex = i
      pivotPrice = price
      result[pivotIndex] = pivotPrice
    }
  }
  result[pivotIndex] = pivotPrice
  return result
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
