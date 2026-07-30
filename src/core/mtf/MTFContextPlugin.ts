import { CandleData, Timeframe } from '@/types'
import { ChartPlugin, ChartPluginContext } from '@/core/chart/ChartPlugin'
import {
  createEmptyMTFContextColumn,
  MTFContextColumn,
  MTFContextStatus,
} from '@/core/mtf/MTFContextModel'
import { prepareCandles } from '@/core/mtf/MTFAggregationEngine'

export interface MTFContextPluginSnapshot {
  enabled: boolean
  timeframes: readonly Timeframe[]
  columns: readonly MTFContextColumn[]
}

/**
 * Disabled-by-default MTF runtime foundation.
 *
 * Slice 1 intentionally performs no rendering, no chart option updates and no
 * feed subscriptions. Later slices can attach a primitive renderer to the state
 * owned here without involving React in the chart runtime.
 */
export class MTFContextPlugin implements ChartPlugin {
  readonly id = 'mtf-context'

  private initialized = false
  private enabled = false
  private timeframes: Timeframe[] = []
  private columns = new Map<Timeframe, MTFContextColumn>()

  initialize(_context: ChartPluginContext) {
    this.initialized = true
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  setTimeframes(timeframes: readonly Timeframe[]) {
    const nextTimeframes = Array.from(new Set(timeframes))
    const nextSet = new Set(nextTimeframes)

    for (const timeframe of this.columns.keys()) {
      if (!nextSet.has(timeframe)) this.columns.delete(timeframe)
    }

    for (const timeframe of nextTimeframes) {
      if (!this.columns.has(timeframe)) {
        this.columns.set(timeframe, createEmptyMTFContextColumn(timeframe))
      }
    }

    this.timeframes = nextTimeframes
  }

  setContextData(timeframe: Timeframe, candles: readonly CandleData[]) {
    if (!this.timeframes.includes(timeframe)) return

    const prepared = prepareCandles(candles)
    const last = prepared.candles[prepared.candles.length - 1] ?? null
    const previous = prepared.candles[prepared.candles.length - 2] ?? null
    const status: MTFContextStatus = last ? 'ready' : 'unavailable'

    this.columns.set(timeframe, {
      timeframe,
      candle: last,
      previousCandle: previous,
      isPartial: false,
      status,
      updatedAt: Date.now(),
    })
  }

  updateContextBar(timeframe: Timeframe, candle: CandleData) {
    if (!this.timeframes.includes(timeframe)) return
    const prepared = prepareCandles([candle])
    const next = prepared.candles[0]
    if (!next) return

    const current = this.columns.get(timeframe) ?? createEmptyMTFContextColumn(timeframe)
    const currentTime = current.candle?.time ?? null

    if (currentTime !== null && next.time < currentTime) return

    const previousCandle = currentTime !== null && next.time > currentTime
      ? current.candle
      : current.previousCandle

    this.columns.set(timeframe, {
      timeframe,
      candle: next,
      previousCandle,
      isPartial: true,
      status: 'incomplete',
      updatedAt: Date.now(),
    })
  }

  setStatus(timeframe: Timeframe, status: MTFContextStatus) {
    if (!this.timeframes.includes(timeframe)) return
    const current = this.columns.get(timeframe) ?? createEmptyMTFContextColumn(timeframe)
    this.columns.set(timeframe, {
      ...current,
      status,
      updatedAt: Date.now(),
    })
  }

  setData() {
    // Reserved for future replay-aware aggregation. Slice 1 has no renderer.
  }

  onBar() {
    // Reserved for future replay-aware aggregation. Slice 1 has no renderer.
  }

  getSnapshot(): MTFContextPluginSnapshot {
    return {
      enabled: this.enabled,
      timeframes: this.timeframes,
      columns: this.timeframes.map((timeframe) =>
        this.columns.get(timeframe) ?? createEmptyMTFContextColumn(timeframe)
      ),
    }
  }

  destroy() {
    this.initialized = false
    this.enabled = false
    this.timeframes = []
    this.columns.clear()
  }

  isInitialized(): boolean {
    return this.initialized
  }
}
