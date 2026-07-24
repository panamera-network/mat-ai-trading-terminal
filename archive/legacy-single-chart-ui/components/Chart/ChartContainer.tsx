import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time, BarData, AreaData } from 'lightweight-charts'
import { OHLCV, DrawingType } from '@/types'
import { useChartStore } from '@/stores/chartStore'
import DrawingOverlay from '../DrawingLayer/DrawingOverlay'
import IndicatorOverlay from './IndicatorOverlay'
import IndicatorPanel from '../Panels/IndicatorPanel'
import VolumeProfileIndicator from './VolumeProfileIndicator'
import { generateMockData } from '@/utils/mockData'

interface ChartContainerProps {
  symbol: string
  timeframe: string
  activeTool: string
}

export default function ChartContainer({ symbol, timeframe, activeTool }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [data, setData] = useState<OHLCV[]>([])
  const [ready, setReady] = useState(false)

  const { indicators, settings } = useChartStore()
  const panelIndicators = indicators.filter(i => i.type === 'panel' && i.visible)
  const overlayIndicators = indicators.filter(i => i.type === 'overlay' && i.visible)
  const volumeProfileIndicator = indicators.find(i => i.type === 'volume-profile' && i.visible)

  // Generate data
  useEffect(() => {
    const mockData = generateMockData(symbol, timeframe, 500)
    setData(mockData)
  }, [symbol, timeframe])

  // Create chart and set data
  useEffect(() => {
    const container = containerRef.current
    if (!container || data.length === 0) return

    // Remove old chart if exists
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      candleSeriesRef.current = null
    }

    // Create new chart
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39', style: 1 },
        horzLines: { color: '#2a2e39', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 2,
          labelBackgroundColor: '#758696',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 2,
          labelBackgroundColor: '#758696',
        },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    // Create main series based on chart type
    let mainSeries: ISeriesApi<any>

    switch (settings.chartType) {
      case 'bar': {
        const series = chart.addBarSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
        })
        const barData: BarData[] = data.map(d => ({
          time: d.time as Time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
        series.setData(barData)
        mainSeries = series
        break
      }

      case 'line': {
        const series = chart.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        })
        const lineData: LineData[] = data.map(d => ({
          time: d.time as Time,
          value: d.close,
        }))
        series.setData(lineData)
        mainSeries = series
        break
      }

      case 'area': {
        const series = chart.addAreaSeries({
          lineColor: '#2962FF',
          topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.05)',
          lineWidth: 2,
        })
        const areaData: AreaData[] = data.map(d => ({
          time: d.time as Time,
          value: d.close,
        }))
        series.setData(areaData)
        mainSeries = series
        break
      }

      case 'candlestick':
      default: {
        const series = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderUpColor: '#26a69a',
          borderDownColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        })
        const candleData: CandlestickData[] = data.map(d => ({
          time: d.time as Time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }))
        series.setData(candleData)
        candleSeriesRef.current = series
        mainSeries = series
      }
    }

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.85, bottom: 0 },
    })
    const volumeData: HistogramData[] = data.map(d => ({
      time: d.time as Time,
      value: d.volume,
      color: d.close >= d.open ? '#26a69a80' : '#ef535080',
    }))
    volumeSeries.setData(volumeData)

    chart.timeScale().fitContent()

    chartRef.current = chart
    setReady(true)

    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight,
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      setReady(false)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
      candleSeriesRef.current = null
    }
  }, [data, settings.chartType])

  if (data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chart-bg">
        <div className="text-gray-500 text-sm">Loading {symbol} {timeframe}...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div 
        className="relative bg-chart-bg" 
        style={{ height: panelIndicators.length > 0 ? `calc(100% - ${panelIndicators.length * 120}px)` : '100%' }}
      >
        <div ref={containerRef} className="absolute inset-0" />

        {ready && chartRef.current && (
          <DrawingOverlay 
            chart={chartRef.current}
            candleSeries={candleSeriesRef.current}
            activeTool={activeTool as DrawingType}
          />
        )}

        {ready && chartRef.current && candleSeriesRef.current && volumeProfileIndicator && (
          <VolumeProfileIndicator
            chart={chartRef.current}
            candleSeries={candleSeriesRef.current}
            data={data}
            visible={true}
            bins={(volumeProfileIndicator.params.bins as number) || 50}
          />
        )}

        {ready && chartRef.current && candleSeriesRef.current && (
          <IndicatorOverlay
            chart={chartRef.current}
            candleSeries={candleSeriesRef.current}
            data={data}
            indicators={overlayIndicators}
          />
        )}

        <div className="absolute top-2 left-12 px-2 py-1 bg-chart-panel/80 rounded text-xs font-medium text-gray-400 pointer-events-none z-20">
          {symbol} &middot; {timeframe} &middot; {settings.chartType}
        </div>
      </div>

      {panelIndicators.length > 0 && (
        <div className="border-t border-chart-border flex-shrink-0">
          {panelIndicators.map((ind) => (
            <div key={ind.id} className="h-[120px] border-b border-chart-border last:border-b-0">
              <IndicatorPanel data={data} indicator={ind} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}