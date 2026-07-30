import { IChartApi, ISeriesApi, LineData, LineSeries, LineWidth, Time } from 'lightweight-charts'
import { CandleData, Indicator } from '@/types'
import { ChartPlugin, ChartPluginContext } from '@/core/chart/ChartPlugin'
import { calculateIndicator, IndicatorCalculationOutput } from '@/core/indicators/IndicatorCalculationEngine'

interface OverlayOutputRuntime {
  kind: IndicatorCalculationOutput['kind']
  series: ISeriesApi<'Line'>
}

interface OverlayIndicatorRuntime {
  indicator: Indicator
  outputs: Map<string, OverlayOutputRuntime>
}

function toLineWidth(width: number | undefined, fallback: LineWidth): LineWidth {
  return (width ?? fallback) as unknown as LineWidth
}

function toLineData(data: readonly CandleData[], values: Array<number | null>): LineData[] {
  return data
    .map((d, i) => ({ time: d.time as Time, value: values[i] ?? undefined }))
    .filter((d) => d.value !== undefined && !Number.isNaN(d.value)) as LineData[]
}

export class IndicatorOverlayPlugin implements ChartPlugin {
  readonly id = 'indicator-overlay'

  private chart: IChartApi | null = null
  private getData: () => readonly CandleData[] = () => []
  private indicators: Indicator[] = []
  private runtimes = new Map<string, OverlayIndicatorRuntime>()

  initialize(context: ChartPluginContext) {
    this.chart = context.chart
    this.getData = context.getData
  }

  setIndicators(indicators: Indicator[]) {
    this.indicators = indicators
    this.syncRuntimes()
  }

  setData() {
    this.applyAll()
  }

  onBar() {
    this.applyAll()
  }

  destroy() {
    this.removeAllRuntimes()
    this.chart = null
    this.getData = () => []
    this.indicators = []
  }

  private syncRuntimes() {
    if (!this.chart) return

    const visibleIds = new Set(
      this.indicators
        .filter((indicator) => indicator.visible)
        .map((indicator) => indicator.id)
    )

    for (const [instanceId, runtime] of this.runtimes) {
      if (!visibleIds.has(instanceId)) this.removeRuntime(runtime)
    }

    for (const indicator of this.indicators.filter((i) => i.visible)) {
      const runtime = this.runtimes.get(indicator.id) ?? this.createRuntime(indicator)
      runtime.indicator = indicator
      this.applyRuntime(runtime)
    }
  }

  private createRuntime(indicator: Indicator): OverlayIndicatorRuntime {
    const runtime: OverlayIndicatorRuntime = { indicator, outputs: new Map() }
    this.runtimes.set(indicator.id, runtime)
    return runtime
  }

  private applyAll() {
    this.syncRuntimes()
  }

  private applyRuntime(runtime: OverlayIndicatorRuntime) {
    const chart = this.chart
    const data = this.getData()
    if (!chart || data.length === 0) {
      this.clearRuntimeData(runtime)
      return
    }

    try { chart.timeScale() } catch { return }

    let result
    try {
      result = calculateIndicator(data, runtime.indicator)
    } catch (e) {
      console.warn('IndicatorOverlay: error calculating indicator', e)
      return
    }

    const activeOutputIds = new Set(result.outputs.map((output) => output.id))
    for (const [outputId, outputRuntime] of runtime.outputs) {
      if (!activeOutputIds.has(outputId)) this.removeOutput(runtime, outputId, outputRuntime)
    }

    for (const output of result.outputs) {
      if (output.kind !== 'line') continue
      const outputRuntime = this.ensureOutputRuntime(runtime, output)
      outputRuntime.series.applyOptions({
        color: output.color,
        lineWidth: toLineWidth(output.width, 2),
        lineStyle: output.lineStyle ?? 0,
        title: output.title,
        priceScaleId: 'right',
        lastValueVisible: true,
      })
      outputRuntime.series.setData(toLineData(data, output.values))
    }
  }

  private ensureOutputRuntime(
    runtime: OverlayIndicatorRuntime,
    output: IndicatorCalculationOutput
  ): OverlayOutputRuntime {
    const existing = runtime.outputs.get(output.id)
    if (existing && existing.kind === output.kind) return existing

    if (existing) this.removeOutput(runtime, output.id, existing)

    const series = this.chart!.addSeries(LineSeries, {
      color: output.color,
      lineWidth: toLineWidth(output.width, 2),
      lineStyle: output.lineStyle ?? 0,
      title: output.title,
      priceScaleId: 'right',
      lastValueVisible: true,
    })
    const outputRuntime = { kind: output.kind, series }
    runtime.outputs.set(output.id, outputRuntime)
    return outputRuntime
  }

  private clearRuntimeData(runtime: OverlayIndicatorRuntime) {
    for (const outputRuntime of runtime.outputs.values()) outputRuntime.series.setData([])
  }

  private removeRuntime(runtime: OverlayIndicatorRuntime) {
    for (const [outputId, outputRuntime] of runtime.outputs) {
      this.removeOutput(runtime, outputId, outputRuntime)
    }
    this.runtimes.delete(runtime.indicator.id)
  }

  private removeOutput(
    runtime: OverlayIndicatorRuntime,
    outputId: string,
    outputRuntime: OverlayOutputRuntime
  ) {
    try { this.chart?.removeSeries(outputRuntime.series) } catch {}
    runtime.outputs.delete(outputId)
  }

  private removeAllRuntimes() {
    for (const runtime of this.runtimes.values()) this.removeRuntime(runtime)
    this.runtimes.clear()
  }
}
