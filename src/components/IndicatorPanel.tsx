import { useEffect, useRef } from 'react'
import { createChart, LineData, HistogramData, HistogramSeries, LineSeries, Time } from 'lightweight-charts'
import { OHLCV, Indicator } from '@/types'
import {
  calculateADX,
  calculateADR,
  calculateAO,
  calculateBBP,
  calculateCCI,
  calculateMACD,
  calculateOBV,
  calculateRSI,
  calculateStochastic,
  calculateVolumeDelta,
} from '@/utils/indicators'

interface IndicatorPanelProps {
  data: OHLCV[]
  indicator: Indicator
}

export default function IndicatorPanel({ data, indicator }: IndicatorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

  useEffect(() => {
    if (!containerRef.current || !indicator.visible) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43', style: 1 }, horzLines: { color: '#2B2B43', style: 1 } },
      rightPriceScale: { borderColor: '#2B2B43' },
      timeScale: { borderColor: '#2B2B43', visible: false },
      handleScroll: { vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: false },
    })

    chartRef.current = chart
    const params = indicator.params
    const sourceId = (params.sourceId as string | undefined) ?? indicator.name.toLowerCase()
    const closes = data.map((d) => d.close)

    const addLine = (values: (number | null)[] | number[], title: string, color: string, width = 2) => {
      const lineData: LineData[] = data
        .map((d, i) => ({ time: d.time as Time, value: values[i] ?? undefined }))
        .filter((d) => d.value !== undefined && !Number.isNaN(d.value)) as LineData[]
      const series = chart.addSeries(LineSeries, { color, lineWidth: width as any, title })
      series.setData(lineData)
    }

    const addHistogram = (values: (number | null)[] | number[], title: string) => {
      const histData: HistogramData[] = data.map((d, i) => ({
        time: d.time as Time,
        value: values[i] ?? 0,
        color: (values[i] ?? 0) >= 0 ? '#26a69a' : '#ef5350',
      }))
      const series = chart.addSeries(HistogramSeries, { priceScaleId: '', title })
      series.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      series.setData(histData)
    }

    const addHLine = (value: number, color: string) => {
      addLine(data.map(() => value), '', color, 1)
    }

    switch (sourceId) {
      case 'rsi':
      case 'RSI': {
        addLine(calculateRSI(closes, (params.period as number) || 14), `RSI ${params.period || 14}`, (params.color as string) || '#60a5fa')
        addHLine(70, '#ef5350')
        addHLine(30, '#26a69a')
        chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } })
        break
      }
      case 'stoch': {
        const stoch = calculateStochastic(data, (params.period as number) || 14, (params.smoothK as number) || 3, (params.smoothD as number) || 3)
        addLine(stoch.k, '%K', '#60a5fa')
        addLine(stoch.d, '%D', '#f59e0b')
        addHLine(80, '#ef5350')
        addHLine(20, '#26a69a')
        break
      }
      case 'stoch-rsi': {
        const rsi = calculateRSI(closes, (params.period as number) || 14).map((v) => v ?? 0)
        const synthetic = rsi.map((v, i) => ({ time: data[i].time, open: v, high: v, low: v, close: v, volume: data[i].volume }))
        const stoch = calculateStochastic(synthetic, (params.stochPeriod as number) || 14, 3, 3)
        addLine(stoch.k, 'StochRSI K', '#a78bfa')
        addLine(stoch.d, 'StochRSI D', '#f59e0b')
        addHLine(80, '#ef5350')
        addHLine(20, '#26a69a')
        break
      }
      case 'cci':
        addLine(calculateCCI(data, (params.period as number) || 20), `CCI ${params.period || 20}`, (params.color as string) || '#a78bfa')
        addHLine(100, '#ef5350')
        addHLine(-100, '#26a69a')
        break
      case 'ao':
        addHistogram(calculateAO(data), 'AO')
        break
      case 'macd':
      case 'MACD': {
        const macd = calculateMACD(closes, (params.fast as number) || 12, (params.slow as number) || 26, (params.signal as number) || 9)
        addLine(macd.macd, 'MACD', '#60a5fa')
        addLine(macd.signal, 'Signal', '#f59e0b')
        addHistogram(macd.histogram, 'Histogram')
        break
      }
      case 'bbp': {
        const bbp = calculateBBP(data, (params.period as number) || 13)
        addLine(bbp.bull, 'Bull Power', '#26a69a')
        addLine(bbp.bear, 'Bear Power', '#ef5350')
        addHLine(0, '#787B86')
        break
      }
      case 'adx':
        addLine(calculateADX(data, (params.period as number) || 14), `ADX ${params.period || 14}`, '#fbbf24')
        addHLine(25, '#787B86')
        break
      case 'obv':
        addLine(calculateOBV(data), 'OBV', (params.color as string) || '#60a5fa')
        break
      case 'volume-delta':
        addHistogram(calculateVolumeDelta(data), 'Volume Delta')
        addHLine(0, '#787B86')
        break
      case 'adr':
        addLine(calculateADR(data, (params.period as number) || 14), `ADR ${params.period || 14}`, (params.color as string) || '#f59e0b')
        break
    }

    chart.timeScale().fitContent()

    return () => {
      chart.remove()
      chartRef.current = null
    }
  }, [data, indicator])

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-2 py-0.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
        {indicator.name}
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  )
}
