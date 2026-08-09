import { CandleData, Symbol, Timeframe } from '@/types'
import { normalizeTradingCandle } from '@/core/feed/tradingFeed'
import { prepareCandles } from '@/core/mtf/MTFAggregationEngine'

const BRIDGE_URL = 'http://localhost:5556'
const HISTORY_CACHE_TTL_MS = 15000
const HISTORY_COUNT_BY_TIMEFRAME: Record<Timeframe, number> = {
  '1m': 1000,
  '5m': 800,
  '15m': 800,
  '30m': 500,
  '1H': 500,
  '4H': 300,
  '1D': 250,
  '1W': 250,
}

interface BridgeHistoryCacheEntry {
  candles: CandleData[]
  fetchedAt: number
}

interface BridgeHistoryResponse {
  ok: boolean
  candles?: CandleData[]
  code?: string
  message?: string
}

const historyCache = new Map<string, BridgeHistoryCacheEntry>()
const inFlightHistory = new Map<string, Promise<CandleData[]>>()

interface BridgeHistoryRange {
  from: number
  to: number
}

export function requestBridgeHistory(
  symbol: Symbol,
  timeframe: Timeframe,
  count = getBridgeHistoryCount(timeframe)
): Promise<CandleData[]> {
  if (symbol.exchange !== 'mt5') return Promise.resolve([])

  const boundedCount = Math.min(Math.max(1, Math.floor(count)), 1000)
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
      const body = await res.json().catch(() => null) as BridgeHistoryResponse | null
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

export function requestBridgeHistoryRange(
  symbol: Symbol,
  timeframe: Timeframe,
  range: BridgeHistoryRange
): Promise<CandleData[]> {
  if (symbol.exchange !== 'mt5') return Promise.resolve([])

  const from = Math.floor(range.from)
  const to = Math.floor(range.to)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0 || from > to) {
    return Promise.resolve([])
  }

  const key = `${symbol.exchange}:${symbol.id.toUpperCase()}:${timeframe}:range:${from}:${to}`
  const cached = historyCache.get(key)
  if (cached && Date.now() - cached.fetchedAt <= HISTORY_CACHE_TTL_MS) {
    return Promise.resolve(cached.candles)
  }

  const existing = inFlightHistory.get(key)
  if (existing) return existing

  const request = fetch(
    `${BRIDGE_URL}/history?symbol=${encodeURIComponent(symbol.id)}&timeframe=${encodeURIComponent(timeframe)}&from=${from}&to=${to}`
  )
    .then(async (res) => {
      const body = await res.json().catch(() => null) as BridgeHistoryResponse | null
      if (!res.ok || !body?.ok) throw new Error(body?.message || `History range request failed: ${res.status}`)
      const normalized = normalizeHistoryCandles(body.candles ?? [])
      historyCache.set(key, { candles: normalized, fetchedAt: Date.now() })
      return normalized
    })
    .finally(() => {
      inFlightHistory.delete(key)
    })

  inFlightHistory.set(key, request)
  return request
}

export function getBridgeHistoryCount(timeframe: Timeframe): number {
  return HISTORY_COUNT_BY_TIMEFRAME[timeframe] ?? 100
}

function normalizeHistoryCandles(candles: readonly CandleData[]): CandleData[] {
  const normalized = candles
    .map((candle) => normalizeTradingCandle(candle))
    .filter((candle): candle is CandleData => candle !== null)
  return prepareCandles(normalized).candles
}
