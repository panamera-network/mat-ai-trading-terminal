import { useEffect, useRef } from 'react'
import { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts'
import { OHLCV, Indicator } from '@/types'
import { calculateSMA, calculateEMA, calculateBollinger, calculateVWAP } from '@/utils/indicators'

interface IndicatorOverlayProps {
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick'> | null
  data: OHLCV[]
  indicators: Indicator[]
}

export default function IndicatorOverlay({ chart, candleSeries, data, indicators }: IndicatorOverlayProps) {
  const seriesListRef = useRef<any[]>([])
  const prevKeyRef = useRef<string>('')

  useEffect(() => {
    const cleanup = () => {
      if (!chart) return
      for (const series of seriesListRef.current) {
        try { chart.removeSeries(series) } catch {}
      }
      seriesListRef.current = []
    }

    if (!chart || data.length === 0) {
      cleanup()
      return cleanup
    }

    // Check chart valid
    try { chart.timeScale() } catch { return cleanup }

    const visibleIndicators = indicators.filter(i => i.visible)
    const indicatorsKey = visibleIndicators.map(i => `${i.id}-${i.name}-${JSON.stringify(i.params)}`).join('|')

    if (prevKeyRef.current === indicatorsKey) return cleanup
    prevKeyRef.current = indicatorsKey

    cleanup()

    const closes = data.map(d => d.close)

    for (const indicator of visibleIndicators) {
      const params = indicator.params

      try {
        switch (indicator.name) {
          case 'SMA': {
            const period = (params.period as number) || 20
            const smaValues = calculateSMA(closes, period)
            const lineData: LineData[] = []
            for (let i = 0; i < data.length; i++) {
              if (smaValues[i] !== null) {
                lineData.push({ time: data[i].time as Time, value: smaValues[i]! })
              }
            }
            const lineSeries = chart.addLineSeries({
              color: (params.color as string) || '#2962FF',
              lineWidth: (params.width as number) || 2,
              title: `SMA ${period}`,
              priceScaleId: 'right',
            })
            lineSeries.setData(lineData)
            seriesListRef.current.push(lineSeries)
            break
          }

          case 'EMA': {
            const period = (params.period as number) || 20
            const emaValues = calculateEMA(closes, period)
            const lineData: LineData[] = []
            for (let i = 0; i < data.length; i++) {
              if (emaValues[i] !== null) {
                lineData.push({ time: data[i].time as Time, value: emaValues[i]! })
              }
            }
            const lineSeries = chart.addLineSeries({
              color: (params.color as string) || '#fb8c00',
              lineWidth: (params.width as number) || 2,
              title: `EMA ${period}`,
              priceScaleId: 'right',
            })
            lineSeries.setData(lineData)
            seriesListRef.current.push(lineSeries)
            break
          }

          case 'Bollinger Bands': {
            const period = (params.period as number) || 20
            const multiplier = (params.multiplier as number) || 2
            const bb = calculateBollinger(closes, period, multiplier)
            const bbConfigs = [
              { values: bb.upper, color: '#ab47bc', width: 1, style: 2 as const, title: `BB Upper ${period}` },
              { values: bb.middle, color: '#fff', width: 2, style: 0 as const, title: `BB Middle ${period}` },
              { values: bb.lower, color: '#ab47bc', width: 1, style: 2 as const, title: `BB Lower ${period}` },
            ]
            for (const config of bbConfigs) {
              const lineData: LineData[] = []
              for (let i = 0; i < data.length; i++) {
                if (config.values[i] !== null) {
                  lineData.push({ time: data[i].time as Time, value: config.values[i]! })
                }
              }
              const lineSeries = chart.addLineSeries({
                color: config.color,
                lineWidth: config.width,
                lineStyle: config.style,
                title: config.title,
                priceScaleId: 'right',
                lastValueVisible: false,
              })
              lineSeries.setData(lineData)
              seriesListRef.current.push(lineSeries)
            }
            break
          }

          case 'VWAP': {
            const vwapValues = calculateVWAP(data)
            const lineData: LineData[] = []
            for (let i = 0; i < data.length; i++) {
              if (vwapValues[i] !== null) {
                lineData.push({ time: data[i].time as Time, value: vwapValues[i]! })
              }
            }
            const lineSeries = chart.addLineSeries({
              color: (params.color as string) || '#fdd835',
              lineWidth: (params.width as number) || 2,
              title: 'VWAP',
              priceScaleId: 'right',
            })
            lineSeries.setData(lineData)
            seriesListRef.current.push(lineSeries)
            break
          }
        }
      } catch (e) {
        console.warn('IndicatorOverlay: error creating series', e)
      }
    }

    return cleanup
  }, [chart, data, indicators])

  return null
}