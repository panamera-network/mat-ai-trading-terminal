import { Indicator } from '@/types'

export type IndicatorInput =
  | { id: string; label: string; type: 'number'; defaultValue: number; min?: number; step?: number }
  | { id: string; label: string; type: 'boolean'; defaultValue: boolean }
  | { id: string; label: string; type: 'select'; defaultValue: string; options: string[] }
  | { id: string; label: string; type: 'color'; defaultValue: string }

export interface IndicatorRegistryItem {
  id: string
  name: string
  shortName: string
  category: string
  type: Indicator['type']
  inputs: IndicatorInput[]
}

const colorInput = (defaultValue: string): IndicatorInput => ({
  id: 'color',
  label: 'Color',
  type: 'color',
  defaultValue,
})

const widthInput: IndicatorInput = { id: 'width', label: 'Width', type: 'number', defaultValue: 2, min: 1, step: 1 }
const periodInput = (defaultValue = 14): IndicatorInput => ({ id: 'period', label: 'Period', type: 'number', defaultValue, min: 1, step: 1 })

export const INDICATOR_REGISTRY: IndicatorRegistryItem[] = [
  { id: 'vwap', name: 'VWAP', shortName: 'VWAP', category: 'Volume', type: 'overlay', inputs: [colorInput('#fdd835'), widthInput] },
  { id: 'volume-profile', name: 'Volume Profile', shortName: 'VP', category: 'Volume', type: 'volume-profile', inputs: [{ id: 'bins', label: 'Rows', type: 'number', defaultValue: 50, min: 10, step: 5 }] },
  { id: 'obv', name: 'On Balance Volume', shortName: 'OBV', category: 'Volume', type: 'panel', inputs: [colorInput('#60a5fa')] },
  { id: 'volume-delta', name: 'Volume Delta', shortName: 'Vol Delta', category: 'Volume', type: 'panel', inputs: [] },

  { id: 'adr', name: 'Average Day Range', shortName: 'ADR', category: 'Volatility', type: 'panel', inputs: [periodInput(14), colorInput('#f59e0b')] },

  { id: 'rsi', name: 'RSI', shortName: 'RSI', category: 'Oscillators', type: 'panel', inputs: [periodInput(14), colorInput('#60a5fa')] },
  { id: 'stoch', name: 'Stochastic', shortName: 'Stoch', category: 'Oscillators', type: 'panel', inputs: [periodInput(14), { id: 'smoothK', label: 'Smooth K', type: 'number', defaultValue: 3, min: 1, step: 1 }, { id: 'smoothD', label: 'Smooth D', type: 'number', defaultValue: 3, min: 1, step: 1 }] },
  { id: 'stoch-rsi', name: 'Stochastic RSI', shortName: 'StochRSI', category: 'Oscillators', type: 'panel', inputs: [periodInput(14), { id: 'stochPeriod', label: 'Stoch Period', type: 'number', defaultValue: 14, min: 1, step: 1 }] },
  { id: 'cci', name: 'CCI', shortName: 'CCI', category: 'Oscillators', type: 'panel', inputs: [periodInput(20), colorInput('#a78bfa')] },
  { id: 'ao', name: 'Awesome Oscillator', shortName: 'AO', category: 'Oscillators', type: 'panel', inputs: [] },

  { id: 'macd', name: 'MACD', shortName: 'MACD', category: 'Momentum', type: 'panel', inputs: [{ id: 'fast', label: 'Fast', type: 'number', defaultValue: 12, min: 1, step: 1 }, { id: 'slow', label: 'Slow', type: 'number', defaultValue: 26, min: 1, step: 1 }, { id: 'signal', label: 'Signal', type: 'number', defaultValue: 9, min: 1, step: 1 }] },
  { id: 'bbp', name: 'Bull Bear Power', shortName: 'BBP', category: 'Momentum', type: 'panel', inputs: [periodInput(13)] },

  { id: 'adx', name: 'ADX', shortName: 'ADX', category: 'Trend', type: 'panel', inputs: [periodInput(14)] },
  { id: 'auto-trend', name: 'Auto Trend Detector', shortName: 'Auto Trend', category: 'Trend', type: 'overlay', inputs: [periodInput(5)] },
  { id: 'key-levels', name: 'Auto Key Levels', shortName: 'Key Levels', category: 'Trend', type: 'overlay', inputs: [periodInput(5)] },
  { id: 'zigzag', name: 'Zig Zag', shortName: 'ZigZag', category: 'Trend', type: 'overlay', inputs: [{ id: 'deviation', label: 'Deviation %', type: 'number', defaultValue: 1, min: 0.1, step: 0.1 }] },
  { id: 'sar', name: 'Parabolic SAR', shortName: 'SAR', category: 'Trend', type: 'overlay', inputs: [{ id: 'step', label: 'Step', type: 'number', defaultValue: 0.02, min: 0.001, step: 0.001 }, { id: 'max', label: 'Max', type: 'number', defaultValue: 0.2, min: 0.01, step: 0.01 }] },

  { id: 'bb', name: 'Bollinger Bands', shortName: 'BB', category: 'Channels & Bands', type: 'overlay', inputs: [periodInput(20), { id: 'multiplier', label: 'Multiplier', type: 'number', defaultValue: 2, min: 0.1, step: 0.1 }] },
  { id: 'kc', name: 'Keltner Channels', shortName: 'KC', category: 'Channels & Bands', type: 'overlay', inputs: [periodInput(20), { id: 'multiplier', label: 'ATR Mult', type: 'number', defaultValue: 2, min: 0.1, step: 0.1 }] },
  { id: 'dc', name: 'Donchian Channels', shortName: 'DC', category: 'Channels & Bands', type: 'overlay', inputs: [periodInput(20)] },
  { id: 'env', name: 'Envelope', shortName: 'Env', category: 'Channels & Bands', type: 'overlay', inputs: [periodInput(20), { id: 'percent', label: 'Percent', type: 'number', defaultValue: 1, min: 0.1, step: 0.1 }] },

  { id: 'sma', name: 'SMA', shortName: 'SMA', category: 'Moving Averages', type: 'overlay', inputs: [periodInput(20), colorInput('#60a5fa'), widthInput] },
  { id: 'ema', name: 'EMA', shortName: 'EMA', category: 'Moving Averages', type: 'overlay', inputs: [periodInput(20), colorInput('#f59e0b'), widthInput] },
  { id: 'dema', name: 'DEMA', shortName: 'DEMA', category: 'Moving Averages', type: 'overlay', inputs: [periodInput(20), colorInput('#22d3ee'), widthInput] },
  { id: 'tema', name: 'TEMA', shortName: 'TEMA', category: 'Moving Averages', type: 'overlay', inputs: [periodInput(20), colorInput('#a78bfa'), widthInput] },
  { id: 'mac', name: 'MA Cross', shortName: 'MAC', category: 'Moving Averages', type: 'overlay', inputs: [{ id: 'fast', label: 'Fast', type: 'number', defaultValue: 9, min: 1, step: 1 }, { id: 'slow', label: 'Slow', type: 'number', defaultValue: 21, min: 1, step: 1 }] },
  { id: 'hma', name: 'HMA', shortName: 'HMA', category: 'Moving Averages', type: 'overlay', inputs: [periodInput(20), colorInput('#34d399'), widthInput] },
  { id: 'lsma', name: 'LSMA', shortName: 'LSMA', category: 'Moving Averages', type: 'overlay', inputs: [periodInput(25), colorInput('#f472b6'), widthInput] },
  { id: 'md', name: 'McGinley Dynamic', shortName: 'MD', category: 'Moving Averages', type: 'overlay', inputs: [periodInput(14), colorInput('#c084fc'), widthInput] },
]

export function getIndicatorDefaults(item: IndicatorRegistryItem): Record<string, number | boolean | string> {
  return Object.fromEntries(item.inputs.map((input) => [input.id, input.defaultValue]))
}

export const INDICATOR_CATEGORIES = Array.from(new Set(INDICATOR_REGISTRY.map((item) => item.category)))
