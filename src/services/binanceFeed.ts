import { CandleData, DepthSnapshot, DepthUpdate } from '@/types'
import { Symbol } from '@/types/market'

const WS_BASE = 'wss://stream.binance.com:9443/ws'

export class BinanceFeed {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private symbol: string = ''
  private timeframe: string = ''
  private onCandle: ((data: CandleData) => void) | null = null
  private onDepth: ((data: DepthSnapshot) => void) | null = null
  private onError: ((err: Error) => void) | null = null
  private onConnect: (() => void) | null = null
  private isConnected = false

  connect(symbol: Symbol, timeframe: string, callbacks: {
    onCandle: (data: CandleData) => void
    onDepth?: (data: DepthSnapshot) => void
    onError?: (err: Error) => void
    onConnect?: () => void
  }) {
    this.symbol = symbol.id.toLowerCase()
    this.timeframe = this.mapTimeframe(timeframe)
    this.onCandle = callbacks.onCandle
    this.onDepth = callbacks.onDepth || null
    this.onError = callbacks.onError || null
    this.onConnect = callbacks.onConnect || null

    this.disconnect()
    this.ws = new WebSocket(`${WS_BASE}/${this.symbol}@kline_${this.timeframe}`)

    this.ws.onopen = () => {
      this.isConnected = true
      this.startHeartbeat()
      this.onConnect?.()

      // Subscribe to depth if requested
      if (this.onDepth) {
        this.subscribeDepth()
      }
    }

    this.ws.onmessage = (event) => {
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
          this.onCandle?.(candle)
        }
      } catch (err) {
        this.onError?.(err as Error)
      }
    }

    this.ws.onerror = (err) => {
      this.onError?.(new Error('WebSocket error'))
    }

    this.ws.onclose = () => {
      this.isConnected = false
      this.stopHeartbeat()
      this.scheduleReconnect(symbol, timeframe, callbacks)
    }
  }

  private subscribeDepth() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const depthStream = `${this.symbol}@depth20@100ms`
    this.ws.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params: [depthStream],
      id: Date.now(),
    }))
  }

  private mapTimeframe(tf: string): string {
    const map: Record<string, string> = {
      '1m': '1m', '5m': '5m', '15m': '15m',
      '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w',
    }
    return map[tf] || '1h'
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: Date.now() }))
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(symbol: Symbol, timeframe: string, callbacks: any) {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(symbol, timeframe, callbacks)
    }, 3000)
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
  }

  getConnectionStatus() {
    return this.isConnected
  }
}

export const binanceFeed = new BinanceFeed()
