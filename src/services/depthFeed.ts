import { DepthSnapshot, DepthUpdate } from '@/types/depth'
import { Symbol } from '@/types/market'

interface DepthSubscription {
  ws: WebSocket | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  symbol: string
  onSnapshot: ((data: DepthSnapshot) => void) | null
  onUpdate: ((data: DepthUpdate) => void) | null
  onError: ((err: Error) => void) | null
  closedByCaller: boolean
}

// Each connect() gets its own independent WebSocket, keyed by the returned
// subscription id, so multiple DOM panels can track different symbols at once.
export class DepthFeed {
  private subscriptions = new Map<string, DepthSubscription>()

  connect(symbol: Symbol, callbacks: {
    onSnapshot: (data: DepthSnapshot) => void
    onUpdate?: (data: DepthUpdate) => void
    onError?: (err: Error) => void
  }): string {
    const id = `${symbol.id}_${Math.random().toString(36).slice(2, 9)}`

    const sub: DepthSubscription = {
      ws: null,
      reconnectTimer: null,
      symbol: symbol.id.toLowerCase(),
      onSnapshot: callbacks.onSnapshot,
      onUpdate: callbacks.onUpdate || null,
      onError: callbacks.onError || null,
      closedByCaller: false,
    }

    this.subscriptions.set(id, sub)

    // For forex: MT5 depth is handled by MT5Feed directly, nothing to open here.
    if (symbol.exchange === 'binance') {
      this.openSocket(id, symbol)
    }

    return id
  }

  private openSocket(id: string, symbol: Symbol) {
    const sub = this.subscriptions.get(id)
    if (!sub) return

    sub.ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sub.symbol}@depth20@100ms`)

    sub.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.lastUpdateId) {
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
          sub.onSnapshot?.(snapshot)
        }
      } catch (err) {
        sub.onError?.(err as Error)
      }
    }

    sub.ws.onclose = () => {
      if (!sub.closedByCaller) this.scheduleReconnect(id, symbol)
    }
  }

  private calculateCumulative(snapshot: DepthSnapshot) {
    let cumBid = 0
    for (const b of snapshot.bids) { cumBid += b.size; b.cumulativeSize = cumBid }
    let cumAsk = 0
    for (const a of snapshot.asks) { cumAsk += a.size; a.cumulativeSize = cumAsk }
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
}

export const depthFeed = new DepthFeed()
