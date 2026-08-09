import { CandleData, DepthSnapshot } from '@/types'
import { Symbol } from '@/types/market'
import { orderService } from '@/services/orderService'

interface MT5TickMessage {
  type: 'tick'
  symbol: string
  bid: string | number
  ask: string | number
  last?: string | number
  volume?: string | number
  time?: string | number
  time_msc?: string | number
}

interface MT5BarMessage {
  type: 'bar'
  symbol: string
  timeframe: string
  time: string | number
  open: string | number
  high: string | number
  low: string | number
  close: string | number
  tick_volume?: string | number
  real_volume?: string | number
  spread?: string | number
}

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
  tickCount: number
  isRunning: boolean
  driveOrders: boolean
}

const BRIDGE_URL = 'http://localhost:5556'
const MAX_TICKS_PER_POLL = 500

export class MT5Feed {
  private subscriptions = new Map<string, MT5Subscription>()
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private statusInterval: ReturnType<typeof setInterval> | null = null
  private bridgeConnected = false
  private lastBridgeTickAt = 0
  private pollInFlight = false

  connect(symbol: Symbol, timeframe: string, callbacks: {
    onCandle: (data: CandleData) => void
    onDepth?: (data: DepthSnapshot) => void
    onError?: (err: Error) => void
    onConnect?: () => void
    driveOrders?: boolean
  }): string {
    const id = `${symbol.id}_${timeframe}_${Math.random().toString(36).slice(2, 9)}`

    this.subscriptions.set(id, {
      symbol,
      timeframe,
      currentPrice: 0,
      currentBid: 0,
      currentAsk: 0,
      currentSpread: 0,
      currentCandle: null,
      onCandle: callbacks.onCandle,
      onDepth: callbacks.onDepth || null,
      tickCount: 0,
      isRunning: false,
      driveOrders: callbacks.driveOrders ?? true,
    })

    callbacks.onConnect?.()
    this.startPolling(callbacks.onError)
    return id
  }

  disconnect(id: string) {
    this.subscriptions.delete(id)
    if (this.subscriptions.size === 0) this.stopPolling()
  }

  getConnectionStatus(id: string) {
    const sub = this.subscriptions.get(id)
    return Boolean(sub?.isRunning)
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

  private startPolling(onError?: (err: Error) => void) {
    if (!this.statusInterval) {
      this.checkBridgeStatus()
      this.statusInterval = setInterval(() => this.checkBridgeStatus(), 1000)
    }

    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => this.pollLatest(onError), 150)
    }
  }

  private stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval)
    if (this.statusInterval) clearInterval(this.statusInterval)
    this.pollInterval = null
    this.statusInterval = null
    this.bridgeConnected = false
    this.lastBridgeTickAt = 0
  }

  private async checkBridgeStatus() {
    try {
      const res = await fetch(`${BRIDGE_URL}/status`)
      if (!res.ok) throw new Error(`Bridge status ${res.status}`)
      const data = await res.json()
      this.bridgeConnected = Boolean(data.connected)
      this.updateRunningState()
    } catch {
      this.bridgeConnected = false
      this.updateRunningState()
    }
  }

  private async pollLatest(onError?: (err: Error) => void) {
    if (this.pollInFlight) return
    this.pollInFlight = true
    try {
      const res = await fetch(`${BRIDGE_URL}/latest`)
      if (!res.ok) throw new Error(`Bridge latest ${res.status}`)
      const data = await res.json()
      const ticks = Array.isArray(data.ticks) ? data.ticks.slice(-MAX_TICKS_PER_POLL) : []
      const bars = Array.isArray(data.bars) ? data.bars : []

      for (const tick of ticks) this.handleTick(tick)
      for (const bar of bars) this.handleBar(bar)

      if (ticks.length > 0 || bars.length > 0) {
        this.lastBridgeTickAt = Date.now()
        this.bridgeConnected = true
        this.updateRunningState()
      }
    } catch (err) {
      this.bridgeConnected = false
      this.updateRunningState()
      onError?.(err instanceof Error ? err : new Error('MT5 bridge polling failed'))
    } finally {
      this.pollInFlight = false
    }
  }

  private handleTick(rawTick: MT5TickMessage) {
    const symbolId = String(rawTick.symbol || '').toUpperCase()
    const bid = toNumber(rawTick.bid)
    const ask = toNumber(rawTick.ask)
    if (!symbolId || !Number.isFinite(bid) || !Number.isFinite(ask)) return

    const mid = Number.isFinite(toNumber(rawTick.last)) && toNumber(rawTick.last) > 0
      ? toNumber(rawTick.last)
      : (bid + ask) / 2
    const spread = Math.abs(ask - bid)
    const tickTime = parseMt5Time(rawTick.time_msc ?? rawTick.time) ?? Math.floor(Date.now() / 1000)
    const volume = Math.max(0, toNumber(rawTick.volume) || 1)

    for (const sub of this.subscriptions.values()) {
      if (sub.symbol.id.toUpperCase() !== symbolId) continue
      this.applyTickToSubscription(sub, tickTime, mid, bid, ask, spread, volume)
    }
  }

  private handleBar(rawBar: MT5BarMessage) {
    const symbolId = String(rawBar.symbol || '').toUpperCase()
    const candle = normalizeBar(rawBar)
    if (!symbolId || !candle) return

    for (const sub of this.subscriptions.values()) {
      if (sub.symbol.id.toUpperCase() !== symbolId) continue
      if (this.normalizeTimeframe(rawBar.timeframe) !== this.normalizeTimeframe(sub.timeframe)) continue

      const spread = toNumber(rawBar.spread)
      sub.currentPrice = candle.close
      sub.currentBid = candle.close - (Number.isFinite(spread) ? spread : sub.currentSpread) / 2
      sub.currentAsk = candle.close + (Number.isFinite(spread) ? spread : sub.currentSpread) / 2
      sub.currentSpread = Math.abs(sub.currentAsk - sub.currentBid)
      sub.currentCandle = candle
      sub.onCandle?.({ ...candle })
      this.driveOrders(sub)
    }
  }

  private applyTickToSubscription(
    sub: MT5Subscription,
    tickTime: number,
    price: number,
    bid: number,
    ask: number,
    spread: number,
    volume: number
  ) {
    const tfSeconds = this.timeframeToSeconds(sub.timeframe)
    const candleTime = Math.floor(tickTime / tfSeconds) * tfSeconds
    const current = sub.currentCandle

    sub.currentPrice = price
    sub.currentBid = bid
    sub.currentAsk = ask
    sub.currentSpread = spread
    sub.tickCount++

    let nextCandle: CandleData
    if (!current || candleTime > Number(current.time)) {
      nextCandle = {
        time: candleTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
      }
      sub.currentCandle = nextCandle
    } else if (candleTime === Number(current.time)) {
      current.high = Math.max(current.high, price)
      current.low = Math.min(current.low, price)
      current.close = price
      current.volume = (current.volume || 0) + volume
      nextCandle = current
    } else {
      return
    }

    sub.isRunning = true
    sub.onCandle?.({ ...nextCandle })
    this.driveOrders(sub)
  }

  private driveOrders(sub: MT5Subscription) {
    if (!sub.driveOrders) return
    orderService.checkPendingOrders(sub.symbol, sub.currentBid, sub.currentAsk, sub.currentSpread)
    orderService.updatePositions(sub.symbol, sub.currentBid, sub.currentAsk)
  }

  private updateRunningState() {
    const bridgeLive = this.bridgeConnected && Date.now() - this.lastBridgeTickAt < 3000
    for (const sub of this.subscriptions.values()) {
      sub.isRunning = bridgeLive
    }
  }

  private timeframeToSeconds(tf: string): number {
    const map: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1H': 3600,
      '4H': 14400,
      '1D': 86400,
      '1W': 604800,
    }
    return map[tf] || 3600
  }

  private normalizeTimeframe(tf: string): string {
    return tf.toLowerCase()
  }
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value)
  return Number.NaN
}

function parseMt5Time(value: unknown): number | null {
  if (typeof value === 'number') {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
  }
  if (typeof value !== 'string' || value.trim() === '') return null

  const numeric = Number(value)
  if (Number.isFinite(numeric)) return parseMt5Time(numeric)

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`)
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000)
}

function normalizeBar(rawBar: MT5BarMessage): CandleData | null {
  const time = parseMt5Time(rawBar.time)
  const open = toNumber(rawBar.open)
  const high = toNumber(rawBar.high)
  const low = toNumber(rawBar.low)
  const close = toNumber(rawBar.close)
  if (time === null || ![open, high, low, close].every(Number.isFinite)) return null

  const realVolume = toNumber(rawBar.real_volume)
  const tickVolume = toNumber(rawBar.tick_volume)
  return {
    time,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(realVolume) && realVolume > 0 ? realVolume : (Number.isFinite(tickVolume) ? tickVolume : 0),
  }
}

export const mt5Feed = new MT5Feed()
