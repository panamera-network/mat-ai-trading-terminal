import { useEffect, useRef } from 'react'
import { createChart, LineData, HistogramData, Time } from 'lightweight-charts'
import { OHLCV, Indicator } from '@/types'
import { calculateRSI, calculateMACD } from '@/utils/indicators'

interface IndicatorPanelProps {
  data: OHLCV[]
  indicator: Indicator
}

export default function IndicatorPanel({ data, indicator }: IndicatorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

  const closes = data.map((d) => d.close)

  useEffect(() => {
    if (!containerRef.current || !indicator.visible) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#1e222d' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2B2B43', style: 1 },
        horzLines: { color: '#2B2B43', style: 1 },
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
      timeScale: {
        borderColor: '#2B2B43',
        visible: false,
      },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false },
    })

    chartRef.current = chart
    const params = indicator.params

    switch (indicator.name) {
      case 'RSI': {
        const period = (params.period as number) || 14
        const rsiValues = calculateRSI(closes, period)

        const lineData: LineData[] = data
          .map((d, i) => ({ time: d.time as Time, value: rsiValues[i] ?? undefined }))
          .filter((d) => d.value !== undefined) as LineData[]

        const rsiSeries = chart.addLineSeries({
          color: (params.color as string) || '#2962FF',
          lineWidth: 2,
          title: `RSI ${period}`,
          priceScaleId: 'right',
        })
        rsiSeries.setData(lineData)

        const obSeries = chart.addLineSeries({
          color: '#ef5350', lineWidth: 1, lineStyle: 2, lastValueVisible: false, title: '',
        })
        obSeries.setData(data.map((d) => ({ time: d.time as Time, value: 70 })))

        const osSeries = chart.addLineSeries({
          color: '#26a69a', lineWidth: 1, lineStyle: 2, lastValueVisible: false, title: '',
        })
        osSeries.setData(data.map((d) => ({ time: d.time as Time, value: 30 })))

        chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
        break
      }

      case 'MACD': {
        const fast = (params.fast as number) || 12
        const slow = (params.slow as number) || 26
        const signal = (params.signal as number) || 9

        const macdResult = calculateMACD(closes, fast, slow, signal)

        const macdData: LineData[] = data
          .map((d, i) => ({ time: d.time as Time, value: macdResult.macd[i] ?? undefined }))
          .filter((d) => d.value !== undefined) as LineData[]
        const macdSeries = chart.addLineSeries({ color: '#2962FF', lineWidth: 2, title: 'MACD' })
        macdSeries.setData(macdData)

        const signalData: LineData[] = data
          .map((d, i) => ({ time: d.time as Time, value: macdResult.signal[i] ?? undefined }))
          .filter((d) => d.value !== undefined) as LineData[]
        const signalSeries = chart.addLineSeries({ color: '#fb8c00', lineWidth: 2, title: 'Signal' })
        signalSeries.setData(signalData)

        const histData: HistogramData[] = data.map((d, i) => ({
          time: d.time as Time,
          value: macdResult.histogram[i] ?? 0,
          color: (macdResult.histogram[i] ?? 0) >= 0 ? '#26a69a' : '#ef5350',
        }))
        const histSeries = chart.addHistogramSeries({ priceScaleId: '' })
        histSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        histSeries.setData(histData)
        break
      }

    }

    chart.timeScale().fitContent()

    return () => {
      chart.remove()
      chartRef.current = null
    }
  }, [data, indicator, closes])

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-0.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
        {indicator.name} {indicator.params.period ? `(${indicator.params.period})` : ''}
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  )
}
