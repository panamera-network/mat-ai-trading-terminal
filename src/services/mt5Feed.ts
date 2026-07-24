import { CandleData, DepthSnapshot } from '@/types'
import { Symbol, FOREX_PAIRS } from '@/types/market'
import { orderService } from '@/services/orderService'

// Mock MT5 forex feed — simulates realistic forex price action with spread
export class MT5Feed {
  private interval: ReturnType<typeof setInterval> | null = null
  private symbol: Symbol | null = null
  private currentPrice = 0
  private currentBid = 0
  private currentAsk = 0
  private currentSpread = 0
  private currentCandle: CandleData | null = null
  private onCandle: ((data: CandleData) => void) | null = null
  private onDepth: ((data: DepthSnapshot) => void) | null = null
  private onConnect: (() => void) | null = null
  private tickCount = 0
  private isRunning = false

  connect(symbol: Symbol, timeframe: string, callbacks: {
    onCandle: (data: CandleData) => void
    onDepth?: (data: DepthSnapshot) => void
    onError?: (err: Error) => void
    onConnect?: () => void
  }) {
    this.symbol = symbol
    this.onCandle = callbacks.onCandle
    this.onDepth = callbacks.onDepth || null
    this.onConnect = callbacks.onConnect || null

    // Seed realistic starting price
    const seedPrices: Record<string, number> = {
      'EURUSD': 1.08542, 'GBPUSD': 1.27415, 'USDJPY': 157.832,
      'AUDUSD': 0.66892, 'USDCAD': 1.36450, 'XAUUSD': 2435.80,
    }
    this.currentPrice = seedPrices[symbol.id] || 1.0
    this.currentSpread = this.getSpread(symbol.id)
    this.currentBid = this.currentPrice - this.currentSpread / 2
    this.currentAsk = this.currentPrice + this.currentSpread / 2

    // Seed initial candle (using mid price)
    const now = Math.floor(Date.now() / 1000)
    const tfSeconds = this.timeframeToSeconds(timeframe)
    const candleTime = Math.floor(now / tfSeconds) * tfSeconds

    this.currentCandle = {
      time: candleTime,
      open: this.currentPrice,
      high: this.currentPrice,
      low: this.currentPrice - this.currentSpread,
      close: this.currentPrice,
      volume: 0,
    }

    this.isRunning = true
    this.onConnect?.()

    // Simulate ticks every 200-500ms
    this.interval = setInterval(() => {
      this.simulateTick(timeframe)
    }, 200 + Math.random() * 300)
  }

  private simulateTick(timeframe: string) {
    if (!this.symbol || !this.currentCandle) return

    const symbol = this.symbol
    const spread = this.getSpread(symbol.id)
    const volatility = this.getVolatility(symbol.id)

    // Random walk with slight trend bias
    const trend = Math.sin(this.tickCount / 100) * volatility * 0.3
    const noise = (Math.random() - 0.5) * volatility
    const newMid = this.currentPrice + trend + noise

    // Variable spread (wider during volatile times)
    const spreadMultiplier = 1 + Math.abs(noise) / volatility * 0.5
    const currentSpread = spread * spreadMultiplier

    const bid = newMid - currentSpread / 2
    const ask = newMid + currentSpread / 2

    this.currentPrice = newMid
    this.currentBid = bid
    this.currentAsk = ask
    this.currentSpread = currentSpread

    const tfSeconds = this.timeframeToSeconds(timeframe)
    const now = Math.floor(Date.now() / 1000)
    const candleTime = Math.floor(now / tfSeconds) * tfSeconds

    // New candle or update current
    if (candleTime > this.currentCandle.time) {
      // Emit completed candle
      this.onCandle?.({ ...this.currentCandle })

      // Start new candle
      this.currentCandle = {
        time: candleTime,
        open: newMid,
        high: newMid,
        low: newMid,
        close: newMid,
        volume: Math.random() * 100 + 10,
      }
    } else {
      // Update current candle (mid price)
      this.currentCandle.high = Math.max(this.currentCandle.high, newMid)
      this.currentCandle.low = Math.min(this.currentCandle.low, newMid)
      this.currentCandle.close = newMid
      this.currentCandle.volume += Math.random() * 5

      // Emit updated candle
      this.onCandle?.({ ...this.currentCandle })
    }

    this.tickCount++

    // Check pending orders on every tick (spread-aware)
    orderService.checkPendingOrders(symbol, bid, ask, currentSpread)
    orderService.updatePositions(symbol, bid, ask)

    // Emit depth every 5 ticks
    if (this.tickCount % 5 === 0 && this.onDepth) {
      this.onDepth(this.generateDepth(symbol.id, bid, ask, currentSpread))
    }
  }

  private generateDepth(symbolId: string, bid: number, ask: number, spread: number): DepthSnapshot {
    const levels = 10
    const bids = []
    const asks = []

    for (let i = 0; i < levels; i++) {
      const bidPrice = bid - i * spread * 2
      const askPrice = ask + i * spread * 2
      const bidSize = Math.round((Math.random() * 50 + 10) * (1 - i * 0.05))
      const askSize = Math.round((Math.random() * 50 + 10) * (1 - i * 0.05))

      bids.push({ price: bidPrice, size: bidSize, cumulativeSize: 0, isBid: true })
      asks.push({ price: askPrice, size: askSize, cumulativeSize: 0, isBid: false })
    }

    // Calculate cumulative
    let cumBid = 0
    for (const b of bids) { cumBid += b.size; b.cumulativeSize = cumBid }
    let cumAsk = 0
    for (const a of asks) { cumAsk += a.size; a.cumulativeSize = cumAsk }

    return {
      symbol: symbolId,
      bids,
      asks,
      lastPrice: (bid + ask) / 2,
      lastUpdateId: this.tickCount,
    }
  }

  private getSpread(symbolId: string): number {
    const spreads: Record<string, number> = {
      'EURUSD': 0.00015, 'GBPUSD': 0.00020, 'USDJPY': 0.015,
      'AUDUSD': 0.00018, 'USDCAD': 0.00025, 'XAUUSD': 0.15,
    }
    return spreads[symbolId] || 0.0001
  }

  private getVolatility(symbolId: string): number {
    const vols: Record<string, number> = {
      'EURUSD': 0.00015, 'GBPUSD': 0.00020, 'USDJPY': 0.02,
      'AUDUSD': 0.00018, 'USDCAD': 0.00015, 'XAUUSD': 0.5,
    }
    return vols[symbolId] || 0.0001
  }

  private timeframeToSeconds(tf: string): number {
    const map: Record<string, number> = {
      '1m': 60, '5m': 300, '15m': 900,
      '1H': 3600, '4H': 14400, '1D': 86400, '1W': 604800,
    }
    return map[tf] || 3600
  }

  disconnect() {
    this.isRunning = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  getConnectionStatus() {
    return this.isRunning
  }

  getCurrentPrices() {
    return {
      bid: this.currentBid,
      ask: this.currentAsk,
      mid: this.currentPrice,
      spread: this.currentSpread,
    }
  }
}

export const mt5Feed = new MT5Feed()
