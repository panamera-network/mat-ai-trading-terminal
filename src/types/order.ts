export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected'
export type OrderTIF = 'GTC' | 'IOC' | 'FOK'

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  status: OrderStatus
  price: number | null        // null for market
  stopPrice: number | null     // for stop/stop_limit
  slPrice: number | null       // Stop Loss price
  tpPrice: number | null       // Take Profit price
  size: number                 // lots for forex, coins for crypto
  filled: number
  tif: OrderTIF
  createdAt: Date
  filledAt: Date | null
  avgFillPrice: number | null
  commission: number
  slippage: number             // pips
}

export interface Position {
  id: string
  symbol: string
  side: OrderSide
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnL: number        // in quote currency
  unrealizedPnLPips: number
  realizedPnL: number
  openTime: Date
  slPrice: number | null       // Current SL on position
  tpPrice: number | null       // Current TP on position
}

export interface Trade {
  id: string
  orderId: string
  symbol: string
  side: OrderSide
  price: number
  size: number
  commission: number
  timestamp: Date
  exitReason?: 'manual' | 'sl' | 'tp' | 'strategy'  // Why the trade closed
}

export interface OrderBookEntry {
  price: number
  size: number
  total: number
}
