import { CandleData, Timeframe } from '@/types'
import {
  MTFAggregationOptions,
  MTFAggregationResult,
  MTFBoundaryResolver,
} from '@/core/mtf/MTFContextModel'

const SECONDS_BY_TIMEFRAME: Partial<Record<Timeframe, number>> = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '30m': 30 * 60,
  '1H': 60 * 60,
  '4H': 4 * 60 * 60,
  '1D': 24 * 60 * 60,
  '1W': 7 * 24 * 60 * 60,
}

const WEEK_SECONDS = 7 * 24 * 60 * 60
const MONDAY_UTC_EPOCH = Date.UTC(1970, 0, 5) / 1000

/**
 * Default deterministic resolver for local fallback and tests.
 *
 * This resolver uses UTC calendar boundaries. It is not a claim that H4, D1 or
 * W1 candles match every MT5 broker session. Future MT5 context feed integration
 * should prefer broker-supplied higher-timeframe candles or provide a broker
 * aligned boundary resolver.
 */
export const utcMTFBoundaryResolver: MTFBoundaryResolver = {
  getBucketStart(timestamp, targetTimeframe) {
    if (!Number.isFinite(timestamp)) return null

    switch (targetTimeframe) {
      case '1m':
      case '5m':
      case '15m':
      case '30m':
      case '1H':
      case '4H': {
        const seconds = SECONDS_BY_TIMEFRAME[targetTimeframe]
        return seconds ? Math.floor(timestamp / seconds) * seconds : null
      }
      case '1D': {
        const date = new Date(timestamp * 1000)
        return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000
      }
      case '1W':
        return MONDAY_UTC_EPOCH + Math.floor((timestamp - MONDAY_UTC_EPOCH) / WEEK_SECONDS) * WEEK_SECONDS
      default:
        return null
    }
  },
}

interface PreparedInput {
  candles: CandleData[]
  invalidInputCount: number
  duplicateInputCount: number
}

interface BucketState {
  time: number
  candles: CandleData[]
}

export function aggregateMTFCandles(
  candles: readonly CandleData[],
  targetTimeframe: Timeframe,
  options: MTFAggregationOptions = {}
): MTFAggregationResult {
  const prepared = prepareCandles(candles)
  if (prepared.candles.length === 0) {
    return {
      candles: [],
      status: 'unavailable',
      missingInputDetected: false,
      partialBucketTime: null,
      invalidInputCount: prepared.invalidInputCount,
      duplicateInputCount: prepared.duplicateInputCount,
    }
  }

  const boundaryResolver = options.boundaryResolver ?? utcMTFBoundaryResolver
  const buckets = new Map<number, BucketState>()

  for (const candle of prepared.candles) {
    const bucketStart = boundaryResolver.getBucketStart(candle.time, targetTimeframe)
    if (bucketStart === null) continue
    const bucket = buckets.get(bucketStart) ?? { time: bucketStart, candles: [] }
    bucket.candles.push(candle)
    buckets.set(bucketStart, bucket)
  }

  if (buckets.size === 0) {
    return {
      candles: [],
      status: 'unavailable',
      missingInputDetected: false,
      partialBucketTime: null,
      invalidInputCount: prepared.invalidInputCount,
      duplicateInputCount: prepared.duplicateInputCount,
    }
  }

  const expectedSourceCount = getExpectedSourceCount(options.sourceTimeframe, targetTimeframe)
  const targetSeconds = getTimeframeSeconds(targetTimeframe)
  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => a.time - b.time)
  const partialBucketTime = sortedBuckets[sortedBuckets.length - 1]?.time ?? null
  const currentTime = options.currentTime ?? prepared.candles[prepared.candles.length - 1]?.time
  const aggregated = sortedBuckets.map((bucket) => aggregateBucket(bucket))
  const missingInputDetected = detectMissingInput(sortedBuckets, expectedSourceCount)
  const activeBucketIncomplete = partialBucketTime !== null && (
    (targetSeconds === null ? currentTime >= partialBucketTime : currentTime < partialBucketTime + targetSeconds) ||
    options.partialInputTime != null
  )
  const status = missingInputDetected || activeBucketIncomplete ? 'incomplete' : 'ready'

  return {
    candles: aggregated,
    status,
    missingInputDetected,
    partialBucketTime,
    invalidInputCount: prepared.invalidInputCount,
    duplicateInputCount: prepared.duplicateInputCount,
  }
}

export function prepareCandles(candles: readonly CandleData[]): PreparedInput {
  const byTime = new Map<number, CandleData>()
  let invalidInputCount = 0
  let duplicateInputCount = 0

  for (const candle of candles) {
    if (!isValidCandle(candle)) {
      invalidInputCount += 1
      continue
    }

    if (byTime.has(candle.time)) duplicateInputCount += 1
    byTime.set(candle.time, { ...candle })
  }

  return {
    candles: Array.from(byTime.values()).sort((a, b) => a.time - b.time),
    invalidInputCount,
    duplicateInputCount,
  }
}

export function getTimeframeSeconds(timeframe: Timeframe): number | null {
  return SECONDS_BY_TIMEFRAME[timeframe] ?? null
}

export function getExpectedSourceCount(
  sourceTimeframe: Timeframe | undefined,
  targetTimeframe: Timeframe
): number | null {
  if (!sourceTimeframe) return null
  const sourceSeconds = getTimeframeSeconds(sourceTimeframe)
  const targetSeconds = getTimeframeSeconds(targetTimeframe)
  if (!sourceSeconds || !targetSeconds || sourceSeconds >= targetSeconds) return null
  if (targetSeconds % sourceSeconds !== 0) return null
  if (targetTimeframe === '1D' || targetTimeframe === '1W') return null
  return targetSeconds / sourceSeconds
}

function aggregateBucket(bucket: BucketState): CandleData {
  const source = bucket.candles
  const first = source[0]
  const last = source[source.length - 1]

  return {
    time: bucket.time,
    open: first.open,
    high: Math.max(...source.map((candle) => candle.high)),
    low: Math.min(...source.map((candle) => candle.low)),
    close: last.close,
    volume: source.reduce((sum, candle) => sum + candle.volume, 0),
  }
}

function detectMissingInput(buckets: BucketState[], expectedSourceCount: number | null): boolean {
  if (expectedSourceCount === null) return buckets.length > 0
  return buckets.some((bucket, index) => {
    const isActiveBucket = index === buckets.length - 1
    return !isActiveBucket && bucket.candles.length < expectedSourceCount
  })
}

function isValidCandle(candle: CandleData): boolean {
  return Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    candle.high >= candle.low
}
