import { CandleData, DepthSnapshot } from '@/types'
import { Symbol } from '@/types/market'

const WS_BASE = 'wss://stream.binance.com:9443/ws'

interface BinanceSubscription {
  ws: WebSocket | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  heartbeatTimer: ReturnType<typeof setInterval> | null
  symbol: string
  timeframe: string
  onCandle: ((data: CandleData) => void) | null
  onDepth: ((data: DepthSnapshot) => void) | null
  onError: ((err: Error) => void) | null
  onConnect: (() => void) | null
  isConnected: boolean
  closedByCaller: boolean
}

// Each connect() gets its own independent WebSocket, keyed by the returned
// subscription id, so multiple chart tiles can stream different symbols/
// timeframes at once instead of one connect() tearing down another's socket.
export class BinanceFeed {
  private subscriptions = new Map<string, BinanceSubscription>()

  connect(symbol: Symbol, timeframe: string, callbacks: {
    onCandle: (data: CandleData) => void
    onDepth?: (data: DepthSnapshot) => void
    onError?: (err: Error) => void
    onConnect?: () => void
  }): string {
    const id = `${symbol.id}_${timeframe}_${Math.random().toString(36).slice(2, 9)}`

    const sub: BinanceSubscription = {
      ws: null,
      reconnectTimer: null,
      heartbeatTimer: null,
      symbol: symbol.id.toLowerCase(),
      timeframe: this.mapTimeframe(timeframe),
      onCandle: callbacks.onCandle,
      onDepth: callbacks.onDepth || null,
      onError: callbacks.onError || null,
      onConnect: callbacks.onConnect || null,
      isConnected: false,
      closedByCaller: false,
    }

    this.subscriptions.set(id, sub)
    this.openSocket(id, symbol)
    return id
  }

  private openSocket(id: string, symbol: Symbol) {
    const sub = this.subscriptions.get(id)
    if (!sub) return

    sub.ws = new WebSocket(`${WS_BASE}/${sub.symbol}@kline_${sub.timeframe}`)

    sub.ws.onopen = () => {
      sub.isConnected = true
      this.startHeartbeat(id)
      sub.onConnect?.()
      if (sub.onDepth) this.subscribeDepth(id)
    }

    sub.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.e === 'kline') {
          const k = msg.k
          const candle: CandleData = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          }
          sub.onCandle?.(candle)
        }
      } catch (err) {
        sub.onError?.(err as Error)
      }
    }

    sub.ws.onerror = () => {
      sub.onError?.(new Error('WebSocket error'))
    }

    sub.ws.onclose = () => {
      sub.isConnected = false
      this.stopHeartbeat(id)
      if (!sub.closedByCaller) this.scheduleReconnect(id, symbol)
    }
  }

  private subscribeDepth(id: string) {
    const sub = this.subscriptions.get(id)
    if (!sub?.ws || sub.ws.readyState !== WebSocket.OPEN) return
    sub.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: [`${sub.symbol}@depth20@100ms`],
      id: Date.now(),
    }))
  }

  private mapTimeframe(tf: string): string {
    const map: Record<string, string> = {
      '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w',
    }
    return map[tf] || '1h'
  }

  private startHeartbeat(id: string) {
    const sub = this.subscriptions.get(id)
    if (!sub) return
    sub.heartbeatTimer = setInterval(() => {
      if (sub.ws?.readyState === WebSocket.OPEN) {
        sub.ws.send(JSON.stringify({ ping: Date.now() }))
      }
    }, 30000)
  }

  private stopHeartbeat(id: string) {
    const sub = this.subscriptions.get(id)
    if (!sub?.heartbeatTimer) return
    clearInterval(sub.heartbeatTimer)
    sub.heartbeatTimer = null
  }

  private scheduleReconnect(id: string, symbol: Symbol) {
    const sub = this.subscriptions.get(id)
    if (!sub || sub.reconnectTimer) return
    sub.reconnectTimer = setTimeout(() => {
      sub.reconnectTimer = null
      this.openSocket(id, symbol)
    }, 3000)
  }

  disconnect(id: string) {
    const sub = this.subscriptions.get(id)
    if (!sub) return
    sub.closedByCaller = true
    this.stopHeartbeat(id)
    if (sub.reconnectTimer) {
      clearTimeout(sub.reconnectTimer)
      sub.reconnectTimer = null
    }
    if (sub.ws) {
      sub.ws.close()
      sub.ws = null
    }
    this.subscriptions.delete(id)
  }

  getConnectionStatus(id: string) {
    return this.subscriptions.get(id)?.isConnected ?? false
  }
}

export const binanceFeed = new BinanceFeed()
