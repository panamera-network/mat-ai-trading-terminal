import { useEffect, useRef } from 'react'
import { IChartApi, ISeriesApi, LineSeries, Time } from 'lightweight-charts'
import { OHLCV } from '@/types'
import { calculateVolumeProfile } from '@/utils/indicators'

interface VolumeProfileIndicatorProps {
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick'> | null
  data: OHLCV[]
  visible: boolean
  bins?: number
}

export default function VolumeProfileIndicator({
  chart, candleSeries, data, visible, bins = 50,
}: VolumeProfileIndicatorProps) {
  const seriesRef = useRef<{
    pocSeries: any
    vahSeries: any
    valSeries: any
  }>({ pocSeries: null, vahSeries: null, valSeries: null })

  useEffect(() => {
    const cleanup = () => {
      if (!chart) return
      if (seriesRef.current.pocSeries) {
        try { chart.removeSeries(seriesRef.current.pocSeries) } catch {}
        seriesRef.current.pocSeries = null
      }
      if (seriesRef.current.vahSeries) {
        try { chart.removeSeries(seriesRef.current.vahSeries) } catch {}
        seriesRef.current.vahSeries = null
      }
      if (seriesRef.current.valSeries) {
        try { chart.removeSeries(seriesRef.current.valSeries) } catch {}
        seriesRef.current.valSeries = null
      }
    }

    if (!visible || !chart || data.length === 0) {
      cleanup()
      return cleanup
    }

    try {
      chart.timeScale()
    } catch {
      return cleanup
    }

    cleanup()

    const profile = calculateVolumeProfile(data, bins)
    if (!profile) return cleanup

    const { poc, vah, val } = profile
    const firstTime = data[0]?.time as Time
    const lastTime = data[data.length - 1]?.time as Time

    if (!firstTime || !lastTime) return cleanup

    try {
      const pocSeries = chart.addSeries(LineSeries, {
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
      seriesRef.current.pocSeries = pocSeries

      const vahSeries = chart.addSeries(LineSeries, {
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
      seriesRef.current.vahSeries = vahSeries

      const valSeries = chart.addSeries(LineSeries, {
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
      seriesRef.current.valSeries = valSeries
    } catch (e) {
      console.warn('VolumeProfileIndicator: chart disposed during creation', e)
    }

    return cleanup
  }, [chart, data, visible, bins])

  return null
}
