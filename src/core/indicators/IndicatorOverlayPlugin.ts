import { IChartApi, ISeriesApi, LineData, LineSeries, LineWidth, Time } from 'lightweight-charts'
import { CandleData, Indicator } from '@/types'
import { ChartPlugin, ChartPluginContext } from '@/core/chart/ChartPlugin'
import {
  calculateBollinger,
  calculateDEMA,
  calculateDonchian,
  calculateEMA,
  calculateEnvelope,
  calculateHMA,
  calculateKeltner,
  calculateLSMA,
  calculateMcGinley,
  calculateParabolicSAR,
  calculateSMA,
  calculateTEMA,
  calculateVWAP,
  calculateZigZag,
} from '@/utils/indicators'

function toLineWidth(width: number | undefined, fallback: LineWidth): LineWidth {
  return (width ?? fallback) as unknown as LineWidth
}

export class IndicatorOverlayPlugin implements ChartPlugin {
  readonly id = 'indicator-overlay'

  private chart: IChartApi | null = null
  private getData: () => readonly CandleData[] = () => []
  private indicators: Indicator[] = []
  private seriesList: ISeriesApi<'Line'>[] = []

  initialize(context: ChartPluginContext) {
    this.chart = context.chart
    this.getData = context.getData
  }

  setIndicators(indicators: Indicator[]) {
    this.indicators = indicators
    this.render()
  }

  setData() {
    this.render()
  }

  onBar() {
    this.render()
  }

  destroy() {
    this.cleanup()
    this.chart = null
    this.getData = () => []
    this.indicators = []
  }

  private cleanup() {
    if (!this.chart) return
    for (const series of this.seriesList) {
      try { this.chart.removeSeries(series) } catch {}
    }
    this.seriesList = []
  }

  private render() {
    const chart = this.chart
    const data = [...this.getData()]
    this.cleanup()
    if (!chart || data.length === 0) return

    try { chart.timeScale() } catch { return }

    const closes = data.map((d) => d.close)
    const visibleIndicators = this.indicators.filter((i) => i.visible)

    const addLine = (values: (number | null)[], title: string, color: string, width = 2, lineStyle: 0 | 1 | 2 | 3 | 4 = 0) => {
      const lineData: LineData[] = data
        .map((d, i) => ({ time: d.time as Time, value: values[i] ?? undefined }))
        .filter((d) => d.value !== undefined) as LineData[]
      if (lineData.length === 0) return
      const lineSeries = chart.addSeries(LineSeries, {
        color,
        lineWidth: toLineWidth(width, 2),
        lineStyle,
        title,
        priceScaleId: 'right',
        lastValueVisible: true,
      })
      lineSeries.setData(lineData)
      this.seriesList.push(lineSeries)
    }

    for (const indicator of visibleIndicators) {
      const params = indicator.params
      const sourceId = (params.sourceId as string | undefined) ?? indicator.name.toLowerCase()

      try {
        switch (sourceId) {
          case 'sma':
          case 'SMA':
            addLine(calculateSMA(closes, (params.period as number) || 20), `SMA ${params.period || 20}`, (params.color as string) || '#60a5fa', params.width as number)
            break
          case 'ema':
          case 'EMA':
            addLine(calculateEMA(closes, (params.period as number) || 20), `EMA ${params.period || 20}`, (params.color as string) || '#f59e0b', params.width as number)
            break
          case 'dema':
            addLine(calculateDEMA(closes, (params.period as number) || 20), `DEMA ${params.period || 20}`, (params.color as string) || '#22d3ee', params.width as number)
            break
          case 'tema':
            addLine(calculateTEMA(closes, (params.period as number) || 20), `TEMA ${params.period || 20}`, (params.color as string) || '#a78bfa', params.width as number)
            break
          case 'hma':
            addLine(calculateHMA(closes, (params.period as number) || 20), `HMA ${params.period || 20}`, (params.color as string) || '#34d399', params.width as number)
            break
          case 'lsma':
            addLine(calculateLSMA(closes, (params.period as number) || 25), `LSMA ${params.period || 25}`, (params.color as string) || '#f472b6', params.width as number)
            break
          case 'md':
            addLine(calculateMcGinley(closes, (params.period as number) || 14), `MD ${params.period || 14}`, (params.color as string) || '#c084fc', params.width as number)
            break
          case 'mac': {
            const fast = (params.fast as number) || 9
            const slow = (params.slow as number) || 21
            addLine(calculateEMA(closes, fast), `EMA ${fast}`, '#22d3ee', 2)
            addLine(calculateEMA(closes, slow), `EMA ${slow}`, '#f97316', 2)
            break
          }
          case 'vwap':
          case 'VWAP':
            addLine(calculateVWAP(data), 'VWAP', (params.color as string) || '#fdd835', params.width as number)
            break
          case 'bb':
          case 'Bollinger Bands': {
            const period = (params.period as number) || 20
            const bb = calculateBollinger(closes, period, (params.multiplier as number) || 2)
            addLine(bb.upper, `BB Upper ${period}`, '#a78bfa', 1, 2)
            addLine(bb.middle, `BB Mid ${period}`, '#e5e7eb', 1)
            addLine(bb.lower, `BB Lower ${period}`, '#a78bfa', 1, 2)
            break
          }
          case 'kc': {
            const kc = calculateKeltner(data, (params.period as number) || 20, (params.multiplier as number) || 2)
            addLine(kc.upper, 'KC Upper', '#38bdf8', 1, 2)
            addLine(kc.middle, 'KC Mid', '#38bdf8', 1)
            addLine(kc.lower, 'KC Lower', '#38bdf8', 1, 2)
            break
          }
          case 'dc': {
            const dc = calculateDonchian(data, (params.period as number) || 20)
            addLine(dc.upper, 'DC Upper', '#22c55e', 1, 2)
            addLine(dc.lower, 'DC Lower', '#ef4444', 1, 2)
            break
          }
          case 'env': {
            const env = calculateEnvelope(closes, (params.period as number) || 20, (params.percent as number) || 1)
            addLine(env.upper, 'Env Upper', '#fb7185', 1, 2)
            addLine(env.middle, 'Env Mid', '#fb7185', 1)
            addLine(env.lower, 'Env Lower', '#fb7185', 1, 2)
            break
          }
          case 'sar':
            addLine(calculateParabolicSAR(data, (params.step as number) || 0.02, (params.max as number) || 0.2), 'SAR', '#fbbf24', 1)
            break
          case 'zigzag':
            addLine(calculateZigZag(data, (params.deviation as number) || 1), 'ZigZag', '#f472b6', 2)
            break
          case 'key-levels': {
            const period = (params.period as number) || 5
            const recent = data.slice(-Math.max(20, period * 6))
            const high = Math.max(...recent.map((d) => d.high))
            const low = Math.min(...recent.map((d) => d.low))
            addLine(data.map(() => high), 'Key High', '#22c55e', 1, 2)
            addLine(data.map(() => low), 'Key Low', '#ef4444', 1, 2)
            break
          }
          case 'auto-trend': {
            const period = (params.period as number) || 5
            const pivots = data
              .map((d, i) => ({ d, i }))
              .filter(({ i }) => i >= period && i < data.length - period)
              .filter(({ d, i }) => d.low === Math.min(...data.slice(i - period, i + period + 1).map((x) => x.low)))
              .slice(-2)
            if (pivots.length === 2) {
              const values: (number | null)[] = new Array(data.length).fill(null)
              const [a, b] = pivots
              const slope = (b.d.low - a.d.low) / (b.i - a.i)
              for (let i = a.i; i < data.length; i++) values[i] = a.d.low + slope * (i - a.i)
              addLine(values, 'Auto Trend', '#22d3ee', 2)
            }
            break
          }
        }
      } catch (e) {
        console.warn('IndicatorOverlay: error creating series', e)
      }
    }
  }
}
