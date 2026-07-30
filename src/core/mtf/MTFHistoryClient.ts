import { CandleData, Symbol, Timeframe } from '@/types'
import { normalizeTradingCandle } from '@/core/feed/tradingFeed'
import { prepareCandles } from '@/core/mtf/MTFAggregationEngine'

const BRIDGE_URL = 'http://localhost:5556'
const HISTORY_COUNT = 10
const HISTORY_CACHE_TTL_MS = 15000

interface MTFHistoryCacheEntry {
  candles: CandleData[]
  fetchedAt: number
}

interface MTFHistoryResponse {
  ok: boolean
  candles?: CandleData[]
  code?: string
  message?: string
}

const historyCache = new Map<string, MTFHistoryCacheEntry>()
const inFlightHistory = new Map<string, Promise<CandleData[]>>()

export function requestMTFHistory(
  symbol: Symbol,
  timeframe: Timeframe,
  count = HISTORY_COUNT
): Promise<CandleData[]> {
  if (symbol.exchange !== 'mt5') return Promise.resolve([])

  const boundedCount = Math.min(Math.max(1, Math.floor(count)), 100)
  const key = `${symbol.exchange}:${symbol.id.toUpperCase()}:${timeframe}`
  const cached = historyCache.get(key)
  if (cached && Date.now() - cached.fetchedAt <= HISTORY_CACHE_TTL_MS && cached.candles.length >= boundedCount) {
    return Promise.resolve(cached.candles.slice(-boundedCount))
  }

  const existing = inFlightHistory.get(key)
  if (existing) return existing.then((candles) => candles.slice(-boundedCount))

  const request = fetch(
    `${BRIDGE_URL}/history?symbol=${encodeURIComponent(symbol.id)}&timeframe=${encodeURIComponent(timeframe)}&count=${boundedCount}`
  )
    .then(async (res) => {
      const body = await res.json().catch(() => null) as MTFHistoryResponse | null
      if (!res.ok || !body?.ok) throw new Error(body?.message || `History request failed: ${res.status}`)
      const normalized = normalizeHistoryCandles(body.candles ?? [])
      historyCache.set(key, { candles: normalized, fetchedAt: Date.now() })
      return normalized
    })
    .finally(() => {
      inFlightHistory.delete(key)
    })

  inFlightHistory.set(key, request)
  return request.then((candles) => candles.slice(-boundedCount))
}

function normalizeHistoryCandles(candles: readonly CandleData[]): CandleData[] {
  const normalized = candles
    .map((candle) => normalizeTradingCandle(candle))
    .filter((candle): candle is CandleData => candle !== null)
  return prepareCandles(normalized).candles
}
