import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  SeriesType,
} from 'lightweight-charts'
import { ChartType } from '@/types'

export interface TradingChartControllerOptions {
  chartType: ChartType
}

export interface TradingChartRuntimeUnsafe {
  chart: IChartApi
  mainSeries: ISeriesApi<SeriesType>
  volumeSeries: ISeriesApi<'Histogram'>
}

export class TradingChartController {
  private chart: IChartApi | null = null
  private mainSeries: ISeriesApi<SeriesType> | null = null
  private volumeSeries: ISeriesApi<'Histogram'> | null = null
  private resizeObserver: ResizeObserver | null = null
  private windowResizeHandler: (() => void) | null = null
  private chartType: ChartType

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
  }

  applyTheme() {
    this.chart?.applyOptions({
      layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      rightPriceScale: { borderColor: '#2B2B43' },
      timeScale: { borderColor: '#2B2B43' },
    })
  }

  resize() {
    if (!this.chart) return
    this.chart.applyOptions({
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    })
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
    this.chart?.remove()
    this.chart = null
    this.mainSeries = null
    this.volumeSeries = null
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
}
