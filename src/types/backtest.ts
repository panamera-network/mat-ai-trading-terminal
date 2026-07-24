import { CandleData } from '@/types'
import { Symbol } from '@/types/market'
import { Order, Position, Trade } from '@/types/order'

export interface HistoricalCandle extends CandleData {
  bid: { open: number; high: number; low: number; close: number }
  ask: { open: number; high: number; low: number; close: number }
  spread: number
}

export interface BacktestConfig {
  symbol: Symbol
  timeframe: string
  startDate: Date
  endDate: Date
  initialBalance: number
  spread: number | 'variable'
  commission: number
  slippage: number // pips
}

export interface BacktestState {
  isPlaying: boolean
  isComplete: boolean
  cursor: number
  totalCandles: number
  speed: number // 0.5, 1, 2, 5, 10
  currentCandle: HistoricalCandle | null
  currentDate: Date | null
}

export interface BacktestResult {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  profitFactor: number
  maxDrawdown: number
  maxDrawdownPercent: number
  totalReturn: number
  totalReturnPercent: number
  sharpeRatio: number
  equityCurve: { time: number; equity: number }[]
  trades: Trade[]
  orders: Order[]
  finalBalance: number
}

export interface BacktestSession {
  config: BacktestConfig
  data: HistoricalCandle[]
  state: BacktestState
  result: BacktestResult | null
}
