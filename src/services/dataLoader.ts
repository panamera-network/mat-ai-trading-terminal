import { HistoricalCandle } from '@/types/backtest'
import { Symbol } from '@/types/market'

/**
 * Parse CSV historical data
 * Expected columns: time,open,high,low,close,volume
 * Optional: bid_open,bid_high,bid_low,bid_close,ask_open,ask_high,ask_low,ask_close,spread
 */
export function parseHistoricalCSV(csv: string, symbol: Symbol): HistoricalCandle[] {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())

  const candles: HistoricalCandle[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    if (values.length < 6) continue

    const getValue = (name: string) => {
      const idx = headers.indexOf(name.toLowerCase())
      return idx >= 0 ? parseFloat(values[idx]) : undefined
    }

    const time = new Date(values[0]).getTime() / 1000
    const open = getValue('open') || 0
    const high = getValue('high') || 0
    const low = getValue('low') || 0
    const close = getValue('close') || 0
    const volume = getValue('volume') || 0

    // If bid/ask data exists, use it. Otherwise derive from mid + spread
    const hasBidAsk = headers.includes('bid_open') || headers.includes('bid_close')

    let bidOpen: number, bidHigh: number, bidLow: number, bidClose: number
    let askOpen: number, askHigh: number, askLow: number, askClose: number
    let spread: number

    if (hasBidAsk) {
      bidOpen = getValue('bid_open') || open
      bidHigh = getValue('bid_high') || high
      bidLow = getValue('bid_low') || low
      bidClose = getValue('bid_close') || close
      askOpen = getValue('ask_open') || open
      askHigh = getValue('ask_high') || high
      askLow = getValue('ask_low') || low
      askClose = getValue('ask_close') || close
      spread = askClose - bidClose
    } else {
      // Derive spread from symbol defaults
      const defaultSpread = getDefaultSpread(symbol.id)
      spread = getValue('spread') || defaultSpread

      bidOpen = open - spread / 2
      bidHigh = high - spread / 2
      bidLow = low - spread / 2
      bidClose = close - spread / 2
      askOpen = open + spread / 2
      askHigh = high + spread / 2
      askLow = low + spread / 2
      askClose = close + spread / 2
    }

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
      bid: { open: bidOpen, high: bidHigh, low: bidLow, close: bidClose },
      ask: { open: askOpen, high: askHigh, low: askLow, close: askClose },
      spread,
    })
  }

  return candles.sort((a, b) => a.time - b.time)
}

/**
 * Generate mock historical data for testing
 */
export function generateMockData(
  symbol: Symbol,
  timeframe: string,
  days: number = 30
): HistoricalCandle[] {
  const candles: HistoricalCandle[] = []
  const now = Date.now()
  const tfMs = timeframeToMs(timeframe)
  const seedPrice = getSeedPrice(symbol.id)
  const volatility = getVolatility(symbol.id)
  const spread = getDefaultSpread(symbol.id)

  let price = seedPrice

  for (let i = days * 24 * 60 * 60 * 1000 / tfMs; i >= 0; i--) {
    const time = Math.floor((now - i * tfMs) / 1000)

    // Random walk with trend
    const trend = Math.sin(i / 50) * volatility * 0.5
    const noise = (Math.random() - 0.5) * volatility * 2
    const change = trend + noise

    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.random() * volatility
    const low = Math.min(open, close) - Math.random() * volatility
    const volume = Math.random() * 1000 + 100

    price = close

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
      bid: {
        open: open - spread / 2,
        high: high - spread / 2,
        low: low - spread / 2,
        close: close - spread / 2,
      },
      ask: {
        open: open + spread / 2,
        high: high + spread / 2,
        low: low + spread / 2,
        close: close + spread / 2,
      },
      spread,
    })
  }

  return candles
}

function timeframeToMs(tf: string): number {
  const map: Record<string, number> = {
    '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
    '1H': 3600000, '4H': 14400000, '1D': 86400000, '1W': 604800000,
  }
  return map[tf] || 3600000
}

function getSeedPrice(symbolId: string): number {
  const prices: Record<string, number> = {
    'EURUSD': 1.08542, 'GBPUSD': 1.27415, 'USDJPY': 157.832,
    'AUDUSD': 0.66892, 'USDCAD': 1.36450, 'XAUUSD': 2435.80,
    'BTCUSDT': 65000, 'ETHUSDT': 3500, 'SOLUSDT': 150,
  }
  return prices[symbolId] || 1.0
}

function getVolatility(symbolId: string): number {
  const vols: Record<string, number> = {
    'EURUSD': 0.0003, 'GBPUSD': 0.0004, 'USDJPY': 0.04,
    'AUDUSD': 0.0003, 'USDCAD': 0.0003, 'XAUUSD': 1.0,
    'BTCUSDT': 200, 'ETHUSDT': 15, 'SOLUSDT': 2,
  }
  return vols[symbolId] || 0.0001
}

function getDefaultSpread(symbolId: string): number {
  const spreads: Record<string, number> = {
    'EURUSD': 0.00015, 'GBPUSD': 0.00020, 'USDJPY': 0.015,
    'AUDUSD': 0.00018, 'USDCAD': 0.00025, 'XAUUSD': 0.15,
    'BTCUSDT': 0.5, 'ETHUSDT': 0.05, 'SOLUSDT': 0.01,
  }
  return spreads[symbolId] || 0.0001
}

export function exportResultsToCSV(result: any): string {
  const headers = 'time,equity\n'
  const rows = result.equityCurve?.map((e: any) => `${e.time},${e.equity}`).join('\n') || ''
  return headers + rows
}
