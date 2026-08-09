import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  SeriesType,
  Time,
  HistogramData,
  LogicalRange,
  MouseEventParams,
} from 'lightweight-charts'
import { CandleData, ChartType } from '@/types'
import { ChartPlugin, ChartPluginContext } from '@/core/chart/ChartPlugin'

export interface TradingChartControllerOptions {
  chartType: ChartType
}

export interface TradingChartRuntimeUnsafe {
  chart: IChartApi
  mainSeries: ISeriesApi<SeriesType>
  volumeSeries: ISeriesApi<'Histogram'>
}

export type TradingChartBarSource = 'live' | 'replay' | 'backtest'

export interface TradingChartCrosshairPosition {
  time: Time
  price: number
}

export type TradingChartCrosshairMoveHandler = (position: TradingChartCrosshairPosition | null) => void
export type TradingChartVisibleRangeHandler = (range: LogicalRange | null) => void

export class TradingChartController {
  private chart: IChartApi | null = null
  private mainSeries: ISeriesApi<SeriesType> | null = null
  private volumeSeries: ISeriesApi<'Histogram'> | null = null
  private resizeObserver: ResizeObserver | null = null
  private windowResizeHandler: (() => void) | null = null
  private chartType: ChartType
  private candles: CandleData[] = []
  private plugins = new Map<string, ChartPlugin>()
  private interactionLocks = new Set<string>()

  constructor(
    private readonly container: HTMLElement,
    options: TradingChartControllerOptions
  ) {
    this.chartType = options.chartType
  }

  initialize() {
    if (this.chart) return

    const chart = createChart(this.container, {
      layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2B2B43' },
      timeScale: { borderColor: '#2B2B43' },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    })

    this.chart = chart
    this.mainSeries = this.createMainSeries(this.chartType)
    this.volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    this.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    this.attachResize()
  }

  setSeriesType(type: ChartType) {
    if (!this.chart || type === this.chartType) return
    if (this.mainSeries) {
      this.chart.removeSeries(this.mainSeries)
      this.mainSeries = null
    }
    this.chartType = type
    this.mainSeries = this.createMainSeries(type)
    this.applyDataToSeries()
    const context = this.getPluginContext()
    if (context) {
      this.plugins.forEach((plugin) => plugin.onSeriesChange?.(context))
    }
    this.plugins.forEach((plugin) => plugin.setData?.(this.candles))
  }

  setData(candles: CandleData[], mode: 'replace' | 'merge' = 'replace') {
    if (!this.mainSeries) return

    if (mode === 'replace') {
      this.candles = normalizeChartData(candles)
    } else {
      this.candles = normalizeChartData([...this.candles, ...candles])
    }

    this.applyDataToSeries()
  }

  updateBar(candle: CandleData, _source: TradingChartBarSource = 'live') {
    if (!this.mainSeries || !this.volumeSeries) return
    const normalizedTime = getTimeOrderValue(candle.time)
    if (normalizedTime === null) return

    const nextCandle = { ...candle, time: normalizedTime }
    const last = this.candles[this.candles.length - 1]
    const lastTime = getTimeOrderValue(last?.time)

    if (lastTime !== null && normalizedTime < lastTime) return
    if (lastTime !== null && normalizedTime === lastTime) {
      this.candles = [...this.candles.slice(0, -1), nextCandle]
    } else {
      this.candles = [...this.candles, nextCandle]
    }

    const formatted = formatCandleForChartType(nextCandle, this.chartType, this.candles)
    this.mainSeries.update(formatted as any)
    this.volumeSeries.update(formatVolumeBar(nextCandle))
    this.plugins.forEach((plugin) => plugin.onBar?.(nextCandle, this.candles))
  }

  clearData() {
    this.candles = []
    this.mainSeries?.setData([])
    this.volumeSeries?.setData([])
    this.plugins.forEach((plugin) => plugin.setData?.(this.candles))
  }

  getData(): readonly CandleData[] {
    return this.candles
  }

  subscribeCrosshairMove(handler: TradingChartCrosshairMoveHandler): () => void {
    if (!this.chart || !this.mainSeries) return () => undefined

    const chart = this.chart
    const listener = (param: MouseEventParams<Time>) => {
      const mainSeries = this.mainSeries
      if (!param.point || !param.time) {
        handler(null)
        return
      }
      if (!mainSeries) {
        handler(null)
        return
      }

      const price = getCrosshairSeriesPrice(param.seriesData.get(mainSeries))
      handler(price === null ? null : { time: param.time, price })
    }

    chart.subscribeCrosshairMove(listener)
    return () => chart.unsubscribeCrosshairMove(listener)
  }

  subscribeVisibleLogicalRangeChange(handler: TradingChartVisibleRangeHandler): () => void {
    if (!this.chart) return () => undefined
    const timeScale = this.chart.timeScale()
    timeScale.subscribeVisibleLogicalRangeChange(handler)
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(handler)
  }

  setExternalCrosshair(position: TradingChartCrosshairPosition) {
    if (!this.chart || !this.mainSeries) return
    this.chart.setCrosshairPosition(position.price, position.time, this.mainSeries)
  }

  clearExternalCrosshair() {
    this.chart?.clearCrosshairPosition()
  }

  setVisibleLogicalRange(range: LogicalRange) {
    this.chart?.timeScale().setVisibleLogicalRange(range)
  }

  use(plugin: ChartPlugin) {
    if (this.plugins.has(plugin.id)) return
    const context = this.getPluginContext()
    if (!context) return
    this.plugins.set(plugin.id, plugin)
    plugin.initialize(context)
    plugin.setData?.(this.candles)
  }

  removePlugin(pluginId: string) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return
    plugin.destroy()
    this.plugins.delete(pluginId)
  }

  applyTheme() {
    this.chart?.applyOptions({
      layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      rightPriceScale: { borderColor: '#2B2B43' },
      timeScale: { borderColor: '#2B2B43' },
    })
    this.plugins.forEach((plugin) => plugin.onThemeChange?.())
  }

  resize() {
    if (!this.chart) return
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.chart.applyOptions({
      width,
      height,
    })
    this.plugins.forEach((plugin) => plugin.onResize?.({ width, height }))
  }

  /**
   * Unsafe adapter escape hatch for legacy React features during migration.
   * Normal consumers should use controller methods or future plugin contexts.
   */
  getUnsafeLightweightRuntime(): TradingChartRuntimeUnsafe | null {
    if (!this.chart || !this.mainSeries || !this.volumeSeries) return null
    return {
      chart: this.chart,
      mainSeries: this.mainSeries,
      volumeSeries: this.volumeSeries,
    }
  }

  destroy() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler)
      this.windowResizeHandler = null
    }
    this.plugins.forEach((plugin) => plugin.destroy())
    this.plugins.clear()
    this.chart?.remove()
    this.chart = null
    this.mainSeries = null
    this.volumeSeries = null
    this.candles = []
    this.interactionLocks.clear()
  }

  private createMainSeries(type: ChartType): ISeriesApi<SeriesType> {
    if (!this.chart) throw new Error('TradingChartController must be initialized before creating a series')

    switch (type) {
      case 'candlestick':
        return this.chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        }) as ISeriesApi<SeriesType>
      case 'line':
        return this.chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2 }) as ISeriesApi<SeriesType>
      case 'area':
        return this.chart.addSeries(AreaSeries, {
          lineColor: '#2962FF', topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.05)',
        }) as ISeriesApi<SeriesType>
      case 'heikin-ashi':
        return this.chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        }) as ISeriesApi<SeriesType>
      default:
        return this.chart.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        }) as ISeriesApi<SeriesType>
    }
  }

  private attachResize() {
    this.windowResizeHandler = () => this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    window.addEventListener('resize', this.windowResizeHandler)
    this.resize()
  }

  private applyDataToSeries() {
    if (!this.mainSeries || !this.volumeSeries) return
    this.mainSeries.setData(formatDataForChartType(this.candles, this.chartType) as any)
    this.volumeSeries.setData(formatVolumeData(this.candles))
  }

  private getPluginContext(): ChartPluginContext | null {
    if (!this.chart || !this.mainSeries) return null
    return {
      chart: this.chart,
      mainSeries: this.mainSeries,
      getData: () => this.candles,
      requestInteractionLock: (reason) => this.requestInteractionLock(reason),
    }
  }

  private requestInteractionLock(reason = 'plugin'): () => void {
    const lockId = `${reason}-${Math.random().toString(36).slice(2)}`
    this.interactionLocks.add(lockId)
    this.applyInteractionLockState()

    let released = false
    return () => {
      if (released) return
      released = true
      this.interactionLocks.delete(lockId)
      this.applyInteractionLockState()
    }
  }

  private applyInteractionLockState() {
    const enabled = this.interactionLocks.size > 0
    this.chart?.applyOptions({
      handleScroll: {
        mouseWheel: !enabled,
        pressedMouseMove: !enabled,
        horzTouchDrag: !enabled,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: !enabled,
        mouseWheel: !enabled,
        pinch: !enabled,
      },
    })
  }
}

function formatDataForChartType(data: CandleData[], type: ChartType): any[] {
  switch (type) {
    case 'candlestick':
      return data.map((d) => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close }))
    case 'line':
      return data.map((d) => ({ time: d.time as Time, value: d.close }))
    case 'area':
      return data.map((d) => ({ time: d.time as Time, value: d.close }))
    case 'heikin-ashi':
      return calculateHeikinAshi(data)
    default:
      return data.map((d) => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close }))
  }
}

function getTimeOrderValue(time: unknown): number | null {
  if (typeof time === 'number') return time
  if (typeof time === 'string') {
    const parsed = Date.parse(time)
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000)
  }
  if (time && typeof time === 'object') {
    const maybeDate = time as { year?: unknown; month?: unknown; day?: unknown }
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

function normalizeChartData<T extends { time: unknown }>(data: T[]): CandleData[] {
  const byTime = new Map<number, CandleData>()
  for (const item of data) {
    const orderTime = getTimeOrderValue(item.time)
    if (orderTime === null) continue
    byTime.set(orderTime, { ...(item as unknown as CandleData), time: orderTime })
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item)
}

function formatVolumeData(data: CandleData[]): HistogramData[] {
  return data.map((d) => ({
    time: d.time as Time,
    value: d.volume,
    color: d.close >= d.open ? '#26a69a80' : '#ef535080',
  }))
}

function formatVolumeBar(candle: CandleData): HistogramData {
  return {
    time: candle.time as Time,
    value: candle.volume,
    color: candle.close >= candle.open ? '#26a69a80' : '#ef535080',
  }
}

function formatCandleForChartType(candle: CandleData, type: ChartType, allData: CandleData[]): any {
  switch (type) {
    case 'candlestick':
      return { time: candle.time as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close }
    case 'line': case 'area':
      return { time: candle.time as Time, value: candle.close }
    case 'heikin-ashi':
      const ha = calculateHeikinAshi([...allData.slice(-2), candle])
      return ha[ha.length - 1]
    default:
      return { time: candle.time as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close }
  }
}

function calculateHeikinAshi(data: CandleData[]): any[] {
  const ha: any[] = []
  let prevHA: any = null
  for (const candle of data) {
    const close = (candle.open + candle.high + candle.low + candle.close) / 4
    const open = prevHA ? (prevHA.open + prevHA.close) / 2 : (candle.open + candle.close) / 2
    const high = Math.max(candle.high, open, close)
    const low = Math.min(candle.low, open, close)
    const haCandle = { time: candle.time as Time, open, high, low, close }
    ha.push(haCandle)
    prevHA = haCandle
  }
  return ha
}

function getCrosshairSeriesPrice(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const item = data as { close?: unknown; value?: unknown }
  if (typeof item.close === 'number') return item.close
  if (typeof item.value === 'number') return item.value
  return null
}
