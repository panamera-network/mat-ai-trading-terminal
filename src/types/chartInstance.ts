import { Drawing, Indicator } from './index'
import { Symbol, Timeframe, ChartType } from './market'

export interface ChartInstance {
  id: string
  symbol: Symbol
  timeframe: Timeframe
  chartType: ChartType
  drawings: Drawing[]
  indicators: Indicator[]
  data: CandleData[]
  lastPrice: number | null
  dailyChange: number | null
  dailyChangePercent: number | null
  selectedDrawing?: string | null  // Tambah untuk drawing selection
  showVolume: boolean
  showGrid: boolean
}

export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface LayoutConfig {
  type: '1x1' | '1x2' | '1x3' | '2x2' | '2x3' | 'custom'
  charts: ChartInstance[]
  activeChartId: string | null
  syncCrosshair: boolean
  syncSymbol: boolean
  syncTimeframe: boolean
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  type: '1x1',
  charts: [],
  activeChartId: null,
  syncCrosshair: true,
  syncSymbol: false,
  syncTimeframe: false,
}

// Re-export untuk backward compatibility
export type { Drawing, Indicator }