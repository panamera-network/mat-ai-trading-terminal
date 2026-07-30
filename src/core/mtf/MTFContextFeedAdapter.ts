import { CandleData, Symbol, Timeframe } from '@/types'
import {
  createTradingFeed,
  FeedConnectionState,
  normalizeTradingCandle,
  TradingFeed,
} from '@/core/feed/tradingFeed'
import { MTFContextStatus } from '@/core/mtf/MTFContextModel'
import { prepareCandles } from '@/core/mtf/MTFAggregationEngine'
import { requestMTFHistory } from '@/core/mtf/MTFHistoryClient'

export interface MTFContextRequest {
  chartId: string
  symbol: Symbol
  timeframes: readonly Timeframe[]
}

export interface MTFContextHandlers {
  onHistorical: (timeframe: Timeframe, candles: readonly CandleData[]) => void
  onLiveCandle: (timeframe: Timeframe, candle: CandleData) => void
  onStatus: (timeframe: Timeframe, status: MTFContextStatus) => void
  onError?: (timeframe: Timeframe | null, error: unknown) => void
}

export interface MTFContextFeed {
  subscribe(request: MTFContextRequest, handlers: MTFContextHandlers): () => void
}

interface SharedTimeframeSubscription {
  key: string
  symbol: Symbol
  timeframe: Timeframe
  feed: TradingFeed
  unsubscribe: () => void
  consumers: Map<string, MTFContextHandlers>
  lastCandle: CandleData | null
  lastUpdatedAt: number | null
  state: FeedConnectionState
}

/**
 * Controlled MTF feed adapter.
 *
 * Current MT5 frontend transport exposes live bars through the existing singleton
 * `mt5Feed` `/latest` owner, but no non-destructive HTTP history response path.
 * This adapter therefore does not add another `/latest` poller and treats direct
 * history as unavailable until a safe broker-history response path is added.
 */
export class SharedMTFContextFeedAdapter implements MTFContextFeed {
  private subscriptions = new Map<string, SharedTimeframeSubscription>()

  subscribe(request: MTFContextRequest, handlers: MTFContextHandlers): () => void {
    const consumerId = `${request.chartId}:${Math.random().toString(36).slice(2)}`
    const keys: string[] = []

    for (const timeframe of request.timeframes) {
      if (request.symbol.exchange !== 'mt5') {
        handlers.onHistorical(timeframe, [])
        handlers.onStatus(timeframe, 'unavailable')
        continue
      }

      const key = getSubscriptionKey(request.symbol, timeframe)
      keys.push(key)
      const subscription = this.ensureSubscription(key, request.symbol, timeframe)
      subscription.consumers.set(consumerId, handlers)

      handlers.onStatus(timeframe, 'loading')
      if (subscription.lastCandle) {
        handlers.onHistorical(timeframe, [subscription.lastCandle])
      }
      this.requestInitialHistory(subscription, consumerId, handlers)
    }

    return () => {
      for (const key of keys) {
        const subscription = this.subscriptions.get(key)
        if (!subscription) continue
        subscription.consumers.delete(consumerId)
        if (subscription.consumers.size === 0) {
          subscription.unsubscribe()
          this.subscriptions.delete(key)
        }
      }
    }
  }

  private ensureSubscription(
    key: string,
    symbol: Symbol,
    timeframe: Timeframe
  ): SharedTimeframeSubscription {
    const existing = this.subscriptions.get(key)
    if (existing) return existing

    const feed = createTradingFeed(symbol)
    const subscription: SharedTimeframeSubscription = {
      key,
      symbol,
      timeframe,
      feed,
      unsubscribe: () => undefined,
      consumers: new Map(),
      lastCandle: null,
      lastUpdatedAt: null,
      state: 'connecting',
    }

    subscription.unsubscribe = feed.subscribe({
      chartId: `mtf:${key}`,
      symbol,
      timeframe,
      driveOrders: false,
    }, {
      onLiveCandle: (rawCandle) => {
        const candle = normalizeTradingCandle(rawCandle)
        if (!candle) return
        subscription.lastCandle = candle
        subscription.lastUpdatedAt = Date.now()
        this.broadcastLive(subscription, candle)
      },
      onConnectionState: (state) => {
        subscription.state = state
        this.broadcastStatus(subscription, mapConnectionStateToStatus(state, subscription.lastCandle))
      },
      onError: (error) => {
        this.broadcastStatus(subscription, subscription.lastCandle ? 'stale' : 'unavailable')
        this.broadcastError(subscription, error)
      },
    })

    this.subscriptions.set(key, subscription)
    return subscription
  }

  private requestInitialHistory(
    subscription: SharedTimeframeSubscription,
    consumerId: string,
    handlers: MTFContextHandlers
  ) {
    requestMTFHistory(subscription.symbol, subscription.timeframe, 10)
      .then((candles) => {
        if (subscription.consumers.get(consumerId) !== handlers) return
        if (candles.length === 0) {
          handlers.onStatus(subscription.timeframe, subscription.lastCandle ? 'stale' : 'unavailable')
          return
        }

        const latestHistory = candles[candles.length - 1]
        if (subscription.lastCandle && latestHistory.time < subscription.lastCandle.time) {
          handlers.onHistorical(subscription.timeframe, [subscription.lastCandle])
          handlers.onStatus(subscription.timeframe, 'incomplete')
          return
        }

        subscription.lastCandle = latestHistory
        subscription.lastUpdatedAt = Date.now()
        handlers.onHistorical(subscription.timeframe, candles)
        handlers.onStatus(subscription.timeframe, 'ready')
      })
      .catch((error) => {
        if (subscription.consumers.get(consumerId) !== handlers) return
        handlers.onStatus(subscription.timeframe, subscription.lastCandle ? 'stale' : 'unavailable')
        handlers.onError?.(subscription.timeframe, error)
      })
  }

  private broadcastLive(subscription: SharedTimeframeSubscription, candle: CandleData) {
    const prepared = prepareCandles([candle])
    const normalized = prepared.candles[0]
    if (!normalized) return

    for (const handlers of subscription.consumers.values()) {
      handlers.onLiveCandle(subscription.timeframe, normalized)
      handlers.onStatus(subscription.timeframe, 'incomplete')
    }
  }

  private broadcastStatus(subscription: SharedTimeframeSubscription, status: MTFContextStatus) {
    for (const handlers of subscription.consumers.values()) {
      handlers.onStatus(subscription.timeframe, status)
    }
  }

  private broadcastError(subscription: SharedTimeframeSubscription, error: unknown) {
    for (const handlers of subscription.consumers.values()) {
      handlers.onError?.(subscription.timeframe, error)
    }
  }
}

export const mtfContextFeedAdapter = new SharedMTFContextFeedAdapter()

function getSubscriptionKey(symbol: Symbol, timeframe: Timeframe): string {
  return `${symbol.exchange}:${symbol.id.toUpperCase()}:${timeframe}`
}

function mapConnectionStateToStatus(
  state: FeedConnectionState,
  lastCandle: CandleData | null
): MTFContextStatus {
  if (state === 'connected') return lastCandle ? 'incomplete' : 'loading'
  if (state === 'connecting') return lastCandle ? 'stale' : 'loading'
  if (state === 'disconnected' || state === 'error') return lastCandle ? 'stale' : 'unavailable'
  return 'unavailable'
}
