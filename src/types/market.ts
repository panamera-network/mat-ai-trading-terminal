export type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W'
export type ChartType = 'candlestick' | 'line' | 'area' | 'heikin-ashi'
export type Exchange = 'binance' | 'mt5'

export interface Symbol {
  id: string           // 'BTCUSDT' | 'EURUSD'
  name: string         // display name
  base: string
  quote: string
  exchange: Exchange
  pipSize: number      // 0.01 for JPY pairs, 0.0001 for others
  pipValue: number     // $ per pip per lot
  lotSize: number      // 100000 for forex standard lot
  tickSize: number
  digits: number       // 5 for forex, 2 for crypto usually
}

export interface SymbolInfo {
  name: string
  digits: number
  pipSize: number
  type: 'forex' | 'crypto' | 'indices'
}

export const FOREX_PAIRS: Symbol[] = [
  { id: 'EURUSD', name: 'EUR/USD', base: 'EUR', quote: 'USD', exchange: 'mt5', pipSize: 0.0001, pipValue: 10, lotSize: 100000, tickSize: 0.00001, digits: 5 },
  { id: 'GBPUSD', name: 'GBP/USD', base: 'GBP', quote: 'USD', exchange: 'mt5', pipSize: 0.0001, pipValue: 10, lotSize: 100000, tickSize: 0.00001, digits: 5 },
  { id: 'USDJPY', name: 'USD/JPY', base: 'USD', quote: 'JPY', exchange: 'mt5', pipSize: 0.01, pipValue: 1000, lotSize: 100000, tickSize: 0.001, digits: 3 },
  { id: 'AUDUSD', name: 'AUD/USD', base: 'AUD', quote: 'USD', exchange: 'mt5', pipSize: 0.0001, pipValue: 10, lotSize: 100000, tickSize: 0.00001, digits: 5 },
  { id: 'USDCAD', name: 'USD/CAD', base: 'USD', quote: 'CAD', exchange: 'mt5', pipSize: 0.0001, pipValue: 8, lotSize: 100000, tickSize: 0.00001, digits: 5 },
  { id: 'XAUUSD', name: 'XAU/USD', base: 'XAU', quote: 'USD', exchange: 'mt5', pipSize: 0.01, pipValue: 1, lotSize: 100, tickSize: 0.01, digits: 2 },
]

export const CRYPTO_PAIRS: Symbol[] = [
  { id: 'BTCUSDT', name: 'BTC/USDT', base: 'BTC', quote: 'USDT', exchange: 'binance', pipSize: 0.01, pipValue: 0.01, lotSize: 1, tickSize: 0.01, digits: 2 },
  { id: 'ETHUSDT', name: 'ETH/USDT', base: 'ETH', quote: 'USDT', exchange: 'binance', pipSize: 0.01, pipValue: 0.01, lotSize: 1, tickSize: 0.01, digits: 2 },
  { id: 'SOLUSDT', name: 'SOL/USDT', base: 'SOL', quote: 'USDT', exchange: 'binance', pipSize: 0.001, pipValue: 0.001, lotSize: 1, tickSize: 0.001, digits: 3 },
]

export const ALL_SYMBOLS = [...FOREX_PAIRS, ...CRYPTO_PAIRS]
