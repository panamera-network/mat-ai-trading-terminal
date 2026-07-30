import {
  createChart,
  HistogramData,
  HistogramSeries,
  LineData,
  LineSeries,
  Time,
} from 'lightweight-charts'
import { Indicator, OHLCV } from '@/types'
import { calculateIndicator, IndicatorCalculationOutput } from '@/core/indicators/IndicatorCalculationEngine'

type PanelChart = ReturnType<typeof createChart>
type PanelSeries = ReturnType<PanelChart['addSeries']>

interface PanelOutputRuntime {
  kind: IndicatorCalculationOutput['kind']
  series: PanelSeries
}

function toLineData(data: readonly OHLCV[], values: Array<number | null>): LineData[] {
  return data
    .map((d, i) => ({ time: d.time as Time, value: values[i] ?? undefined }))
    .filter((d) => d.value !== undefined && !Number.isNaN(d.value)) as LineData[]
}

function toHistogramData(data: readonly OHLCV[], values: Array<number | null>): HistogramData[] {
  return data.map((d, i) => {
    const value = values[i] ?? 0
    return {
      time: d.time as Time,
      value,
      color: value >= 0 ? '#26a69a' : '#ef5350',
    }
  })
}

export class IndicatorPanelRuntime {
  private chart: PanelChart | null = null
  private outputs = new Map<string, PanelOutputRuntime>()

  constructor(private readonly container: HTMLElement) {}

  setIndicator(data: OHLCV[], indicator: Indicator) {
    if (!indicator.visible) {
      this.clearOutputs()
      return
    }

    const chart = this.ensureChart()
    let result
    try {
      result = calculateIndicator(data, indicator)
    } catch (e) {
      console.warn('IndicatorPanel: error calculating indicator', e)
      return
    }

    const activeOutputIds = new Set(result.outputs.map((output) => output.id))
    for (const [outputId, outputRuntime] of this.outputs) {
      if (!activeOutputIds.has(outputId)) this.removeOutput(outputId, outputRuntime)
    }

    for (const output of result.outputs) {
      const runtime = this.ensureOutputRuntime(output)
      if (output.kind === 'histogram') {
        runtime.series.setData(toHistogramData(data, output.values))
      } else {
        runtime.series.applyOptions({
          color: output.color,
          lineWidth: (output.width ?? 2) as any,
          title: output.title,
        } as any)
        runtime.series.setData(toLineData(data, output.values))
      }
    }

    if (indicator.params.sourceId === 'rsi' || indicator.name.toLowerCase() === 'rsi') {
      chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
    }

    chart.timeScale().fitContent()
  }

  destroy() {
    if (!this.chart) return
    this.chart.remove()
    this.chart = null
    this.outputs.clear()
  }

  private ensureChart() {
    if (this.chart) return this.chart

    this.chart = createChart(this.container, {
      layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43', style: 1 }, horzLines: { color: '#2B2B43', style: 1 } },
      rightPriceScale: { borderColor: '#2B2B43' },
      timeScale: { borderColor: '#2B2B43', visible: false },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false },
    })

    return this.chart
  }

  private ensureOutputRuntime(output: IndicatorCalculationOutput): PanelOutputRuntime {
    const existing = this.outputs.get(output.id)
    if (existing && existing.kind === output.kind) return existing

    if (existing) this.removeOutput(output.id, existing)

    const chart = this.ensureChart()
    const series = output.kind === 'histogram'
      ? chart.addSeries(HistogramSeries, { priceScaleId: '', title: output.title })
      : chart.addSeries(LineSeries, {
          color: output.color,
          lineWidth: (output.width ?? 2) as any,
          title: output.title,
        })

    if (output.kind === 'histogram') {
      series.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    }

    const runtime = { kind: output.kind, series }
    this.outputs.set(output.id, runtime)
    return runtime
  }

  private clearOutputs() {
    for (const runtime of this.outputs.values()) runtime.series.setData([])
  }

  private removeOutput(outputId: string, runtime: PanelOutputRuntime) {
    try { this.chart?.removeSeries(runtime.series as any) } catch {}
    this.outputs.delete(outputId)
  }
}
