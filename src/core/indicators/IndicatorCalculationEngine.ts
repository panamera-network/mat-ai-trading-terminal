import { Indicator, OHLCV } from '@/types'
import {
  calculateADX,
  calculateADR,
  calculateAO,
  calculateBBP,
  calculateBollinger,
  calculateCCI,
  calculateDEMA,
  calculateDonchian,
  calculateEMA,
  calculateEnvelope,
  calculateHMA,
  calculateKeltner,
  calculateLSMA,
  calculateMACD,
  calculateMcGinley,
  calculateOBV,
  calculateParabolicSAR,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateTEMA,
  calculateVWAP,
  calculateVolumeDelta,
  calculateZigZag,
} from '@/utils/indicators'

export type IndicatorOutputKind = 'line' | 'histogram'
export type IndicatorLineStyle = 0 | 1 | 2 | 3 | 4

export interface IndicatorCalculationOutput {
  id: string
  title: string
  kind: IndicatorOutputKind
  color: string
  width?: number
  lineStyle?: IndicatorLineStyle
  values: Array<number | null>
}

export interface IndicatorCalculationResult {
  outputs: IndicatorCalculationOutput[]
}

export function getIndicatorSourceId(indicator: Indicator): string {
  return (indicator.params.sourceId as string | undefined) ?? indicator.name.toLowerCase()
}

export function calculateIndicator(
  data: readonly OHLCV[],
  indicator: Indicator
): IndicatorCalculationResult {
  const candles = data as OHLCV[]
  const params = indicator.params
  const closes = candles.map((d) => d.close)
  const sourceId = getIndicatorSourceId(indicator)
  const line = (
    id: string,
    values: Array<number | null>,
    title: string,
    color: string,
    width = 2,
    lineStyle: IndicatorLineStyle = 0
  ): IndicatorCalculationOutput => ({
    id,
    title,
    kind: 'line',
    color,
    width,
    lineStyle,
    values,
  })
  const histogram = (
    id: string,
    values: Array<number | null>,
    title: string
  ): IndicatorCalculationOutput => ({
    id,
    title,
    kind: 'histogram',
    color: '#26a69a',
    values,
  })
  const hLine = (value: number, color: string) =>
    line(`hline-${value}`, candles.map(() => value), '', color, 1)

  switch (sourceId) {
    case 'sma':
    case 'SMA': {
      const period = (params.period as number) || 20
      return { outputs: [line('sma', calculateSMA(closes, period), `SMA ${period}`, (params.color as string) || '#60a5fa', params.width as number)] }
    }
    case 'ema':
    case 'EMA': {
      const period = (params.period as number) || 20
      return { outputs: [line('ema', calculateEMA(closes, period), `EMA ${period}`, (params.color as string) || '#f59e0b', params.width as number)] }
    }
    case 'dema': {
      const period = (params.period as number) || 20
      return { outputs: [line('dema', calculateDEMA(closes, period), `DEMA ${period}`, (params.color as string) || '#22d3ee', params.width as number)] }
    }
    case 'tema': {
      const period = (params.period as number) || 20
      return { outputs: [line('tema', calculateTEMA(closes, period), `TEMA ${period}`, (params.color as string) || '#a78bfa', params.width as number)] }
    }
    case 'hma': {
      const period = (params.period as number) || 20
      return { outputs: [line('hma', calculateHMA(closes, period), `HMA ${period}`, (params.color as string) || '#34d399', params.width as number)] }
    }
    case 'lsma': {
      const period = (params.period as number) || 25
      return { outputs: [line('lsma', calculateLSMA(closes, period), `LSMA ${period}`, (params.color as string) || '#f472b6', params.width as number)] }
    }
    case 'md': {
      const period = (params.period as number) || 14
      return { outputs: [line('md', calculateMcGinley(closes, period), `MD ${period}`, (params.color as string) || '#c084fc', params.width as number)] }
    }
    case 'mac': {
      const fast = (params.fast as number) || 9
      const slow = (params.slow as number) || 21
      return {
        outputs: [
          line('fast', calculateEMA(closes, fast), `EMA ${fast}`, '#22d3ee', 2),
          line('slow', calculateEMA(closes, slow), `EMA ${slow}`, '#f97316', 2),
        ],
      }
    }
    case 'vwap':
    case 'VWAP':
      return { outputs: [line('vwap', calculateVWAP(candles), 'VWAP', (params.color as string) || '#fdd835', params.width as number)] }
    case 'bb':
    case 'Bollinger Bands': {
      const period = (params.period as number) || 20
      const bb = calculateBollinger(closes, period, (params.multiplier as number) || 2)
      return {
        outputs: [
          line('upper', bb.upper, `BB Upper ${period}`, '#a78bfa', 1, 2),
          line('middle', bb.middle, `BB Mid ${period}`, '#e5e7eb', 1),
          line('lower', bb.lower, `BB Lower ${period}`, '#a78bfa', 1, 2),
        ],
      }
    }
    case 'kc': {
      const kc = calculateKeltner(candles, (params.period as number) || 20, (params.multiplier as number) || 2)
      return {
        outputs: [
          line('upper', kc.upper, 'KC Upper', '#38bdf8', 1, 2),
          line('middle', kc.middle, 'KC Mid', '#38bdf8', 1),
          line('lower', kc.lower, 'KC Lower', '#38bdf8', 1, 2),
        ],
      }
    }
    case 'dc': {
      const dc = calculateDonchian(candles, (params.period as number) || 20)
      return { outputs: [line('upper', dc.upper, 'DC Upper', '#22c55e', 1, 2), line('lower', dc.lower, 'DC Lower', '#ef4444', 1, 2)] }
    }
    case 'env': {
      const env = calculateEnvelope(closes, (params.period as number) || 20, (params.percent as number) || 1)
      return {
        outputs: [
          line('upper', env.upper, 'Env Upper', '#fb7185', 1, 2),
          line('middle', env.middle, 'Env Mid', '#fb7185', 1),
          line('lower', env.lower, 'Env Lower', '#fb7185', 1, 2),
        ],
      }
    }
    case 'sar':
      return { outputs: [line('sar', calculateParabolicSAR(candles, (params.step as number) || 0.02, (params.max as number) || 0.2), 'SAR', '#fbbf24', 1)] }
    case 'zigzag':
      return { outputs: [line('zigzag', calculateZigZag(candles, (params.deviation as number) || 1), 'ZigZag', '#f472b6', 2)] }
    case 'key-levels': {
      const period = (params.period as number) || 5
      const recent = candles.slice(-Math.max(20, period * 6))
      const high = Math.max(...recent.map((d) => d.high))
      const low = Math.min(...recent.map((d) => d.low))
      return { outputs: [line('high', candles.map(() => high), 'Key High', '#22c55e', 1, 2), line('low', candles.map(() => low), 'Key Low', '#ef4444', 1, 2)] }
    }
    case 'auto-trend': {
      const period = (params.period as number) || 5
      const pivots = candles
        .map((d, i) => ({ d, i }))
        .filter(({ i }) => i >= period && i < candles.length - period)
        .filter(({ d, i }) => d.low === Math.min(...candles.slice(i - period, i + period + 1).map((x) => x.low)))
        .slice(-2)
      if (pivots.length !== 2) return { outputs: [] }
      const values: Array<number | null> = new Array(candles.length).fill(null)
      const [a, b] = pivots
      const slope = (b.d.low - a.d.low) / (b.i - a.i)
      for (let i = a.i; i < candles.length; i++) values[i] = a.d.low + slope * (i - a.i)
      return { outputs: [line('auto-trend', values, 'Auto Trend', '#22d3ee', 2)] }
    }
    case 'rsi':
    case 'RSI': {
      const period = (params.period as number) || 14
      return { outputs: [line('rsi', calculateRSI(closes, period), `RSI ${period}`, (params.color as string) || '#60a5fa'), hLine(70, '#ef5350'), hLine(30, '#26a69a')] }
    }
    case 'stoch': {
      const stoch = calculateStochastic(candles, (params.period as number) || 14, (params.smoothK as number) || 3, (params.smoothD as number) || 3)
      return { outputs: [line('k', stoch.k, '%K', '#60a5fa'), line('d', stoch.d, '%D', '#f59e0b'), hLine(80, '#ef5350'), hLine(20, '#26a69a')] }
    }
    case 'stoch-rsi': {
      const rsi = calculateRSI(closes, (params.period as number) || 14).map((v) => v ?? 0)
      const synthetic = rsi.map((v, i) => ({ time: candles[i].time, open: v, high: v, low: v, close: v, volume: candles[i].volume }))
      const stoch = calculateStochastic(synthetic, (params.stochPeriod as number) || 14, 3, 3)
      return { outputs: [line('k', stoch.k, 'StochRSI K', '#a78bfa'), line('d', stoch.d, 'StochRSI D', '#f59e0b'), hLine(80, '#ef5350'), hLine(20, '#26a69a')] }
    }
    case 'cci': {
      const period = (params.period as number) || 20
      return { outputs: [line('cci', calculateCCI(candles, period), `CCI ${period}`, (params.color as string) || '#a78bfa'), hLine(100, '#ef5350'), hLine(-100, '#26a69a')] }
    }
    case 'ao':
      return { outputs: [histogram('ao', calculateAO(candles), 'AO')] }
    case 'macd':
    case 'MACD': {
      const macd = calculateMACD(closes, (params.fast as number) || 12, (params.slow as number) || 26, (params.signal as number) || 9)
      return { outputs: [line('macd', macd.macd, 'MACD', '#60a5fa'), line('signal', macd.signal, 'Signal', '#f59e0b'), histogram('histogram', macd.histogram, 'Histogram')] }
    }
    case 'bbp': {
      const bbp = calculateBBP(candles, (params.period as number) || 13)
      return { outputs: [line('bull', bbp.bull, 'Bull Power', '#26a69a'), line('bear', bbp.bear, 'Bear Power', '#ef5350'), hLine(0, '#787B86')] }
    }
    case 'adx': {
      const period = (params.period as number) || 14
      return { outputs: [line('adx', calculateADX(candles, period), `ADX ${period}`, '#fbbf24'), hLine(25, '#787B86')] }
    }
    case 'obv':
      return { outputs: [line('obv', calculateOBV(candles), 'OBV', (params.color as string) || '#60a5fa')] }
    case 'volume-delta':
      return { outputs: [histogram('volume-delta', calculateVolumeDelta(candles), 'Volume Delta'), hLine(0, '#787B86')] }
    case 'adr': {
      const period = (params.period as number) || 14
      return { outputs: [line('adr', calculateADR(candles, period), `ADR ${period}`, (params.color as string) || '#f59e0b')] }
    }
    default:
      return { outputs: [] }
  }
}
