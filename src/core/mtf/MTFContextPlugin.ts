import { CandleData, Timeframe } from '@/types'
import { ChartPlugin, ChartPluginContext } from '@/core/chart/ChartPlugin'
import {
  createEmptyMTFContextColumn,
  MTFContextColumn,
  MTFContextStatus,
} from '@/core/mtf/MTFContextModel'
import { prepareCandles } from '@/core/mtf/MTFAggregationEngine'
import {
  DEFAULT_MTF_RENDER_THEME,
  MTFContextPrimitive,
  MTFRenderTheme,
} from '@/core/mtf/MTFContextPrimitive'

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
  private context: ChartPluginContext | null = null
  private primitive: MTFContextPrimitive | null = null

  initialize(context: ChartPluginContext) {
    this.context = context
    this.initialized = true
  }

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) this.attachRenderer()
    else this.detachRenderer()
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
    this.syncPrimitive()
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
    this.syncPrimitive()
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
    this.syncPrimitive()
  }

  setStatus(timeframe: Timeframe, status: MTFContextStatus) {
    if (!this.timeframes.includes(timeframe)) return
    const current = this.columns.get(timeframe) ?? createEmptyMTFContextColumn(timeframe)
    this.columns.set(timeframe, {
      ...current,
      status,
      updatedAt: Date.now(),
    })
    this.syncPrimitive()
  }

  setData() {
    // Reserved for future replay-aware aggregation. Slice 2 renders only injected context data.
  }

  onBar() {
    // Reserved for future replay-aware aggregation. Slice 2 renders only injected context data.
  }

  onThemeChange(theme?: Partial<MTFRenderTheme>) {
    this.primitive?.setTheme(theme ?? DEFAULT_MTF_RENDER_THEME)
  }

  onResize() {
    this.primitive?.resize()
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
    this.detachRenderer()
    this.initialized = false
    this.enabled = false
    this.timeframes = []
    this.columns.clear()
    this.context = null
  }

  isInitialized(): boolean {
    return this.initialized
  }

  private attachRenderer() {
    if (!this.context || this.primitive) return
    this.primitive = new MTFContextPrimitive()
    this.context.mainSeries.attachPrimitive(this.primitive)
    this.syncPrimitive()
  }

  private detachRenderer() {
    if (!this.context || !this.primitive) {
      this.primitive = null
      return
    }

    try { this.context.mainSeries.detachPrimitive(this.primitive) } catch {}
    this.primitive = null
  }

  private syncPrimitive() {
    if (!this.enabled) return
    this.attachRenderer()
    this.primitive?.setColumns(this.getSnapshot().columns)
  }
}
