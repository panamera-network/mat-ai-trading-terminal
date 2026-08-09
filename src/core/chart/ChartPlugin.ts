import { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts'
import { CandleData } from '@/types'

export interface ChartPluginContext {
  chart: IChartApi
  mainSeries: ISeriesApi<SeriesType>
  getData: () => readonly CandleData[]
  requestInteractionLock: (reason?: string) => () => void
}

export interface ChartPlugin {
  readonly id: string
  initialize: (context: ChartPluginContext) => void
  onSeriesChange?: (context: ChartPluginContext) => void
  setData?: (candles: readonly CandleData[]) => void
  onBar?: (candle: CandleData, candles: readonly CandleData[]) => void
  onThemeChange?: () => void
  onResize?: (size: { width: number; height: number }) => void
  destroy: () => void
}
