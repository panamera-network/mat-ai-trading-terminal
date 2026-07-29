import { IChartApi, LineSeries, Time } from 'lightweight-charts'
import { OHLCV } from '@/types'
import { calculateVolumeProfile } from '@/utils/indicators'

export class VolumeProfileRuntime {
  private pocSeries: any = null
  private vahSeries: any = null
  private valSeries: any = null

  constructor(private readonly chart: IChartApi) {}

  setVolumeProfile(data: OHLCV[], visible: boolean, bins = 50) {
    this.cleanup()
    if (!visible || data.length === 0) return

    try {
      this.chart.timeScale()
    } catch {
      return
    }

    const profile = calculateVolumeProfile(data, bins)
    if (!profile) return

    const { poc, vah, val } = profile
    const firstTime = data[0]?.time as Time
    const lastTime = data[data.length - 1]?.time as Time

    if (!firstTime || !lastTime) return

    try {
      const pocSeries = this.chart.addSeries(LineSeries, {
        color: '#2962FF',
        lineWidth: 2,
        title: `POC ${poc.toFixed(2)}`,
        priceScaleId: 'right',
        lastValueVisible: true,
      })
      pocSeries.setData([
        { time: firstTime, value: poc },
        { time: lastTime, value: poc },
      ])
      this.pocSeries = pocSeries

      const vahSeries = this.chart.addSeries(LineSeries, {
        color: '#26a69a',
        lineWidth: 1,
        lineStyle: 2,
        title: `VAH ${vah.toFixed(2)}`,
        priceScaleId: 'right',
        lastValueVisible: true,
      })
      vahSeries.setData([
        { time: firstTime, value: vah },
        { time: lastTime, value: vah },
      ])
      this.vahSeries = vahSeries

      const valSeries = this.chart.addSeries(LineSeries, {
        color: '#ef5350',
        lineWidth: 1,
        lineStyle: 2,
        title: `VAL ${val.toFixed(2)}`,
        priceScaleId: 'right',
        lastValueVisible: true,
      })
      valSeries.setData([
        { time: firstTime, value: val },
        { time: lastTime, value: val },
      ])
      this.valSeries = valSeries
    } catch (e) {
      console.warn('VolumeProfileIndicator: chart disposed during creation', e)
    }
  }

  cleanup() {
    if (this.pocSeries) {
      try { this.chart.removeSeries(this.pocSeries) } catch {}
      this.pocSeries = null
    }
    if (this.vahSeries) {
      try { this.chart.removeSeries(this.vahSeries) } catch {}
      this.vahSeries = null
    }
    if (this.valSeries) {
      try { this.chart.removeSeries(this.valSeries) } catch {}
      this.valSeries = null
    }
  }
}
