import { CandleData, DepthSnapshot } from '@/types'
import { Symbol } from '@/types/market'
import { orderService } from '@/services/orderService'

interface MT5Subscription {
  symbol: Symbol
  timeframe: string
  currentPrice: number
  currentBid: number
  currentAsk: number
  currentSpread: number
  currentCandle: CandleData | null
  onCandle: ((data: CandleData) => void) | null
  onDepth: ((data: DepthSnapshot) => void) | null
  interval: ReturnType<typeof setInterval> | null
  tickCount: number
  isRunning: boolean
  driveOrders: boolean
}

// Mock MT5 forex feed — simulates realistic forex price action with spread.
// Each connect() call gets its own independent subscription (own ticker interval,
// own price state) so multiple chart tiles can track different symbols/timeframes
// at once instead of fighting over one shared connection.
export class MT5Feed {
  private subscriptions = new Map<string, MT5Subscription>()

  connect(symbol: Symbol, timeframe: string, callbacks: {
    onCandle: (data: CandleData) => void
    onDepth?: (data: DepthSnapshot) => void
    onError?: (err: Error) => void
    onConnect?: () => void
    // Whether this subscription's simulated ticks should drive orderService's
    // position/pending-order checks. Only one subscription per symbol should
    // do this (the chart tile actually trading it) — secondary subscriptions
    // (multi-timeframe glances, depth-only feeds) run their own independent
    // random walk and would otherwise fight over the same position's P&L.
    driveOrders?: boolean
  }): string {
    const id = `${symbol.id}_${timeframe}_${Math.random().toString(36).slice(2, 9)}`

    const seedPrices: Record<string, number> = {
      'EURUSD': 1.08542, 'GBPUSD': 1.27415, 'USDJPY': 157.832,
      'AUDUSD': 0.66892, 'USDCAD': 1.36450, 'XAUUSD': 2435.80,
    }
    const currentPrice = seedPrices[symbol.id] || 1.0
    const currentSpread = this.getSpread(symbol.id)
    const currentBid = currentPrice - currentSpread / 2
    const currentAsk = currentPrice + currentSpread / 2

    const now = Math.floor(Date.now() / 1000)
    const tfSeconds = this.timeframeToSeconds(timeframe)
    const candleTime = Math.floor(now / tfSeconds) * tfSeconds

    const sub: MT5Subscription = {
      symbol,
      timeframe,
      currentPrice,
      currentBid,
      currentAsk,
      currentSpread,
      currentCandle: {
        time: candleTime,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice - currentSpread,
        close: currentPrice,
        volume: 0,
      },
      onCandle: callbacks.onCandle,
      onDepth: callbacks.onDepth || null,
      interval: null,
      tickCount: 0,
      isRunning: true,
      driveOrders: callbacks.driveOrders ?? true,
    }

    this.subscriptions.set(id, sub)
    callbacks.onConnect?.()

    sub.interval = setInterval(() => {
      this.simulateTick(id)
    }, 200 + Math.random() * 300)

    return id
  }

  private simulateTick(id: string) {
    const sub = this.subscriptions.get(id)
    if (!sub || !sub.currentCandle) return

    const { symbol, timeframe } = sub
    const spread = this.getSpread(symbol.id)
    const volatility = this.getVolatility(symbol.id)

    const trend = Math.sin(sub.tickCount / 100) * volatility * 0.3
    const noise = (Math.random() - 0.5) * volatility
    const newMid = sub.currentPrice + trend + noise

    const spreadMultiplier = 1 + Math.abs(noise) / volatility * 0.5
    const currentSpread = spread * spreadMultiplier

    const bid = newMid - currentSpread / 2
    const ask = newMid + currentSpread / 2

    sub.currentPrice = newMid
    sub.currentBid = bid
    sub.currentAsk = ask
    sub.currentSpread = currentSpread

    const tfSeconds = this.timeframeToSeconds(timeframe)
    const now = Math.floor(Date.now() / 1000)
    const candleTime = Math.floor(now / tfSeconds) * tfSeconds

    if (candleTime > sub.currentCandle.time) {
      sub.onCandle?.({ ...sub.currentCandle })

      sub.currentCandle = {
        time: candleTime,
        open: newMid,
        high: newMid,
        low: newMid,
        close: newMid,
        volume: Math.random() * 100 + 10,
      }
    } else {
      sub.currentCandle.high = Math.max(sub.currentCandle.high, newMid)
      sub.currentCandle.low = Math.min(sub.currentCandle.low, newMid)
      sub.currentCandle.close = newMid
      sub.currentCandle.volume += Math.random() * 5

      sub.onCandle?.({ ...sub.currentCandle })
    }

    sub.tickCount++

    if (sub.driveOrders) {
      orderService.checkPendingOrders(symbol, bid, ask, currentSpread)
      orderService.updatePositions(symbol, bid, ask)
    }

    if (sub.tickCount % 5 === 0 && sub.onDepth) {
      sub.onDepth(this.generateDepth(symbol.id, bid, ask, currentSpread))
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

    let cumBid = 0
    for (const b of bids) { cumBid += b.size; b.cumulativeSize = cumBid }
    let cumAsk = 0
    for (const a of asks) { cumAsk += a.size; a.cumulativeSize = cumAsk }

    return {
      symbol: symbolId,
      bids,
      asks,
      lastPrice: (bid + ask) / 2,
      lastUpdateId: Date.now(),
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

  disconnect(id: string) {
    const sub = this.subscriptions.get(id)
    if (!sub) return
    if (sub.interval) clearInterval(sub.interval)
    this.subscriptions.delete(id)
  }

  getConnectionStatus(id: string) {
    return this.subscriptions.get(id)?.isRunning ?? false
  }

  getCurrentPrices(id: string) {
    const sub = this.subscriptions.get(id)
    if (!sub) return { bid: 0, ask: 0, mid: 0, spread: 0 }
    return {
      bid: sub.currentBid,
      ask: sub.currentAsk,
      mid: sub.currentPrice,
      spread: sub.currentSpread,
    }
  }
}

export const mt5Feed = new MT5Feed()
