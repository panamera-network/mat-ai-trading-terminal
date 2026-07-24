import { DepthSnapshot, DepthUpdate } from '@/types/depth'
import { Symbol } from '@/types/market'

export class DepthFeed {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private symbol: string = ''
  private onSnapshot: ((data: DepthSnapshot) => void) | null = null
  private onUpdate: ((data: DepthUpdate) => void) | null = null
  private onError: ((err: Error) => void) | null = null
  private buffer: DepthUpdate[] = []
  private lastUpdateId = 0
  private isSnapshotLoaded = false

  connect(symbol: Symbol, callbacks: {
    onSnapshot: (data: DepthSnapshot) => void
    onUpdate?: (data: DepthUpdate) => void
    onError?: (err: Error) => void
  }) {
    this.symbol = symbol.id.toLowerCase()
    this.onSnapshot = callbacks.onSnapshot
    this.onUpdate = callbacks.onUpdate || null
    this.onError = callbacks.onError || null
    this.buffer = []
    this.lastUpdateId = 0
    this.isSnapshotLoaded = false

    this.disconnect()

    // For crypto: Binance depth stream
    if (symbol.exchange === 'binance') {
      this.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${this.symbol}@depth20@100ms`)

      this.ws.onopen = () => {
        this.isSnapshotLoaded = true
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.lastUpdateId) {
            // Snapshot
            const snapshot: DepthSnapshot = {
              symbol: symbol.id,
              bids: msg.bids.map(([p, s]: [string, string]) => ({
                price: parseFloat(p),
                size: parseFloat(s),
                cumulativeSize: 0,
                isBid: true,
              })),
              asks: msg.asks.map(([p, s]: [string, string]) => ({
                price: parseFloat(p),
                size: parseFloat(s),
                cumulativeSize: 0,
                isBid: false,
              })),
              lastPrice: 0,
              lastUpdateId: msg.lastUpdateId,
            }
            this.calculateCumulative(snapshot)
            this.onSnapshot?.(snapshot)
          }
        } catch (err) {
          this.onError?.(err as Error)
        }
      }

      this.ws.onclose = () => {
        this.scheduleReconnect(symbol, callbacks)
      }
    }
    // For forex: MT5 depth is handled by MT5Feed directly
  }

  private calculateCumulative(snapshot: DepthSnapshot) {
    let cumBid = 0
    for (const b of snapshot.bids) { cumBid += b.size; b.cumulativeSize = cumBid }
    let cumAsk = 0
    for (const a of snapshot.asks) { cumAsk += a.size; a.cumulativeSize = cumAsk }
  }

  private scheduleReconnect(symbol: Symbol, callbacks: any) {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(symbol, callbacks)
    }, 3000)
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const depthFeed = new DepthFeed()
