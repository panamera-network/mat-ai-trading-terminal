export interface StrategyScript {
  id: string
  name: string
  code: string
  symbol: string
  timeframe: string
  isActive: boolean
  createdAt: Date
}

export interface StrategyState {
  variables: Record<string, any>
  lastCandle: any | null
  indicators: Record<string, number[]>
}

export interface StrategyContext {
  symbol: string
  candle: any
  bid: number
  ask: number
  spread: number
  position: any | null
  balance: number
  equity: number
}

export interface StrategyAction {
  type: 'buy' | 'sell' | 'close' | 'modify_sl' | 'modify_tp' | 'log'
  size?: number
  slPips?: number
  tpPips?: number
  slPrice?: number
  tpPrice?: number
  message?: string
}

export interface StrategyResult {
  actions: StrategyAction[]
  logs: string[]
  errors: string[]
  state: StrategyState
}
