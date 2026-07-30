import { CandleData, Timeframe } from '@/types'

export type MTFContextStatus =
  | 'ready'
  | 'loading'
  | 'unavailable'
  | 'stale'
  | 'incomplete'

export interface MTFContextColumn {
  timeframe: Timeframe
  candle: CandleData | null
  previousCandle: CandleData | null
  isPartial: boolean
  status: MTFContextStatus
  updatedAt: number | null
}

export interface MTFTimeframeConfig {
  timeframe: Timeframe
  enabled: boolean
}

export interface MTFBoundaryResolver {
  getBucketStart(timestamp: number, targetTimeframe: Timeframe): number | null
}

export interface MTFAggregationOptions {
  sourceTimeframe?: Timeframe
  boundaryResolver?: MTFBoundaryResolver
  currentTime?: number
  partialInputTime?: number | null
}

export interface MTFAggregationResult {
  candles: CandleData[]
  status: Extract<MTFContextStatus, 'ready' | 'incomplete' | 'unavailable'>
  missingInputDetected: boolean
  partialBucketTime: number | null
  invalidInputCount: number
  duplicateInputCount: number
}

export const MTF_CONTEXT_TIMEFRAMES: readonly Timeframe[] = [
  '15m',
  '1H',
  '4H',
  '1D',
  '1W',
]

export function createEmptyMTFContextColumn(timeframe: Timeframe): MTFContextColumn {
  return {
    timeframe,
    candle: null,
    previousCandle: null,
    isPartial: false,
    status: 'unavailable',
    updatedAt: null,
  }
}
