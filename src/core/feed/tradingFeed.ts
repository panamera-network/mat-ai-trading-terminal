import { CandleData, Timeframe } from '@/types'
import { Symbol } from '@/types/market'
import { binanceFeed } from '@/services/binanceFeed'
import { mt5Feed } from '@/services/mt5Feed'

export type FeedConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface FeedSubscriptionRequest {
  chartId: string
  symbol: Symbol
  timeframe: Timeframe
}

export interface HistoricalFeedRequest extends FeedSubscriptionRequest {
  limit?: number
}

export interface FeedHandlers {
  onHistoricalCandles?: (candles: CandleData[]) => void
  onLiveCandle: (candle: CandleData) => void
  onConnectionState?: (state: FeedConnectionState) => void
  onError?: (error: Error) => void
}

export interface TradingFeed {
  connect?: () => Promise<void> | void
  disconnect?: () => Promise<void> | void
  subscribe: (request: FeedSubscriptionRequest, handlers: FeedHandlers) => () => void
  getHistoricalCandles?: (request: HistoricalFeedRequest) => Promise<CandleData[]>
  getCurrentPrices?: () => { bid: number; ask: number; mid: number; spread: number }
}

interface LegacyFeed {
  connect: (
    symbol: Symbol,
    timeframe: string,
    callbacks: {
      onCandle: (data: CandleData) => void
      onError?: (error: Error) => void
      onConnect?: () => void
    }
  ) => string
  disconnect: (id: string) => void
  getConnectionStatus: (id: string) => boolean
  getCurrentPrices?: (id: string) => { bid: number; ask: number; mid: number; spread: number }
}

export function createTradingFeed(symbol: Symbol): TradingFeed {
  if (symbol.exchange === 'binance') return createLegacyFeedAdapter(binanceFeed)
  return createLegacyFeedAdapter(mt5Feed)
}

function createLegacyFeedAdapter(feed: LegacyFeed): TradingFeed {
  let activeSubscriptionId: string | null = null

  return {
    subscribe: (request, handlers) => {
      handlers.onConnectionState?.('connecting')
      let active = true

      const subscriptionId = feed.connect(request.symbol, request.timeframe, {
        onCandle: (candle) => {
          if (!active) return
          const normalized = normalizeTradingCandle(candle)
          if (!normalized) return
          handlers.onLiveCandle(normalized)
        },
        onConnect: () => {
          if (!active) return
          handlers.onConnectionState?.('connected')
        },
        onError: (error) => {
          if (!active) return
          handlers.onConnectionState?.('error')
          handlers.onError?.(error)
        },
      })
      activeSubscriptionId = subscriptionId

      return () => {
        active = false
        feed.disconnect(subscriptionId)
        if (activeSubscriptionId === subscriptionId) activeSubscriptionId = null
        handlers.onConnectionState?.('disconnected')
      }
    },

    getCurrentPrices: () => {
      if (!activeSubscriptionId) return { bid: 0, ask: 0, mid: 0, spread: 0 }
      const subscriptionId = activeSubscriptionId
      return feed.getCurrentPrices?.(subscriptionId) ?? { bid: 0, ask: 0, mid: 0, spread: 0 }
    },
  }
}

export function normalizeTradingCandle(raw: CandleData): CandleData | null {
  const time = normalizeEpochSeconds(raw.time)
  const open = Number(raw.open)
  const high = Number(raw.high)
  const low = Number(raw.low)
  const close = Number(raw.close)
  const volume = Number(raw.volume ?? 0)

  if (time === null || ![open, high, low, close, volume].every(Number.isFinite)) return null

  return {
    ...raw,
    time,
    open,
    high,
    low,
    close,
    volume,
  }
}

function normalizeEpochSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
  }

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return normalizeEpochSeconds(numeric)
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000)
  }

  if (value && typeof value === 'object') {
    const maybeDate = value as { year?: unknown; month?: unknown; day?: unknown }
    if (
      typeof maybeDate.year === 'number' &&
      typeof maybeDate.month === 'number' &&
      typeof maybeDate.day === 'number'
    ) {
      return Date.UTC(maybeDate.year, maybeDate.month - 1, maybeDate.day) / 1000
    }
  }

  return null
}
