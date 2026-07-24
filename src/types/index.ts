// Barrel export for all types
export * from './market'
export * from './depth'
export * from './order'
export * from './chartInstance'
export * from './backtest'
export * from './strategy'
export * from './alerts'

import type { ChartType, Timeframe } from './market'

export interface OHLCV {
  time: number | string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface VolumeProfile {
  priceLevels: number[]
  volumes: number[]
  poc: number
  vah: number
  val: number
  totalVolume: number
}

// Drawing types — unified
export type DrawingType = 
  | 'cursor'
  | 'trendline'
  | 'horizontal'
  | 'vertical'
  | 'ray'
  | 'extended'
  | 'parallel'
  | 'fibonacci'
  | 'fibonacciExtension'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'measure'
  | 'magnet'

export interface DrawingPoint {
  time: number
  price: number
}

export interface Drawing {
  id: string
  type: DrawingType
  points: DrawingPoint[]
  color?: string
  style?: 'solid' | 'dashed' | 'dotted'
  width?: number
  text?: string
  locked?: boolean
}

// ChartSettings
export interface ChartSettings {
  chartType: ChartType
  timeframe: Timeframe
  showVolume: boolean
  showGrid: boolean
  showCrosshair: boolean
  magnetMode: boolean
}

// Symbol, ChartType and Timeframe are canonically defined in ./market
// (re-exported via `export * from './market'` above) — do not redeclare here.

// Indicator — unified (was IndicatorConfig)
export interface Indicator {
  id: string
  name: string
  type: 'overlay' | 'panel' | 'volume-profile'
  params: Record<string, number | boolean | string>
  visible: boolean
}

// Trade
export interface Trade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  entry: number
  stopLoss?: number
  takeProfit?: number
  size: number
  status: 'open' | 'closed'
  pnl?: number
}

// CommandAction untuk undo/redo
export type CommandAction = 
  | { type: 'ADD_DRAWING'; drawing: Drawing }
  | { type: 'REMOVE_DRAWING'; drawing: Drawing }
  | { type: 'UPDATE_DRAWING'; id: string; prev: Partial<Drawing>; next: Partial<Drawing> }
  | { type: 'ADD_INDICATOR'; indicator: Indicator }
  | { type: 'REMOVE_INDICATOR'; indicator: Indicator }