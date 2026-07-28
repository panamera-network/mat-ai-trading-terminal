import { useRef, useEffect, useState, useCallback } from 'react'
import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  Time,
  HistogramData,
} from 'lightweight-charts'
import { X } from 'lucide-react'
import { useLayoutStore } from '@/stores/layoutStore'
import { useBacktestStore } from '@/stores/backtestStore'
import { useRealtimeFeed } from '@/hooks/useRealtimeFeed'
import { useSyncCrosshair } from '@/hooks/useSyncCrosshair'
import { useStrategyRunner } from '@/hooks/useStrategyRunner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useOrderStore } from '@/stores/orderStore'
import { alertsService } from '@/services/alertsService'
import { ChartType } from '@/types'
import type { ChartPanelToggles } from '@/components/TradingTerminal'
import OrderPanel from './OrderPanel'
import DOMPanel from './DOMPanel'
import StrategyPanel from './StrategyPanel'
import PositionLines from './PositionLines'
import ChartContextMenu from './ChartContextMenu'
import AlertsPanel from './AlertsPanel'
import PnLDashboard from './PnLDashboard'
import TradeJournal from './TradeJournal'
import MultiTimeframePanel from './MultiTimeframePanel'
import KeyboardHelpModal from './KeyboardHelpModal'
import IndicatorsModal from './IndicatorsModal'
import IndicatorOverlay from './IndicatorOverlay'
import IndicatorPanel from './IndicatorPanel'
import VolumeProfileIndicator from './VolumeProfileIndicator'
import PluginDrawingLayer from './PluginDrawingLayer'

interface ChartTileProps {
  chartId: string
  isActive: boolean
  activeTool: string
  onToolSelect: (tool: string) => void
  chartPanels: ChartPanelToggles
  onChartPanelClose: (panel: keyof ChartPanelToggles) => void
}

export default function ChartTile({ chartId, isActive, activeTool, onToolSelect, chartPanels, onChartPanelClose }: ChartTileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<any> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lastSeriesTimeRef = useRef<number | null>(null)
  const isDrawingInteractionRef = useRef(false)
  const followRealtimeRef = useRef(true)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null)
  const [mainSeries, setMainSeries] = useState<ISeriesApi<any> | null>(null)
  const [chartContainer, setChartContainer] = useState<HTMLDivElement | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const chart = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)!)
  const updateChart = useLayoutStore((s) => s.updateChart)
  const setActiveChart = useLayoutStore((s) => s.setActiveChart)
  const removeChart = useLayoutStore((s) => s.removeChart)

  const isBacktestMode = useBacktestStore((s) => s.isBacktestMode)
  const backtestState = useBacktestStore((s) => s.state)
  const backtestData = useBacktestStore((s) => s.data)

  const { isConnected, getPrices } = useRealtimeFeed(chartId, chart.symbol, chart.timeframe)
  const prices = getPrices()

  const placeOrder = useOrderStore((s) => s.placeOrder)

  useSyncCrosshair(chartRef.current, chartId)

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node
    setChartContainer(node)
  }, [])

  const btCandle = isBacktestMode && backtestState?.currentCandle ? backtestState.currentCandle : null
  const bid = btCandle ? btCandle.bid.close : (prices?.bid || chart.lastPrice || 0)
  const ask = btCandle ? btCandle.ask.close : (prices?.ask || chart.lastPrice || 0)
  const spread = btCandle ? btCandle.spread : (prices?.spread || 0.00015)

  // Quick buy/sell for keyboard shortcuts
  const handleQuickBuy = useCallback(async () => {
    const currentPrice = (bid + ask) / 2
    await placeOrder({ symbol: chart.symbol, side: 'buy', type: 'market', size: 0.1, currentPrice, spread, bid, ask })
  }, [chart.symbol, bid, ask, spread, placeOrder])

  const handleQuickSell = useCallback(async () => {
    const currentPrice = (bid + ask) / 2
    await placeOrder({ symbol: chart.symbol, side: 'sell', type: 'market', size: 0.1, currentPrice, spread, bid, ask })
  }, [chart.symbol, bid, ask, spread, placeOrder])

  const handleClosePosition = useCallback(async () => {
    const position = useOrderStore.getState().positions.find((p) => p.symbol === chart.symbol.id)
    if (!position) return
    const currentPrice = (bid + ask) / 2
    await placeOrder({
      symbol: chart.symbol,
      side: position.side === 'buy' ? 'sell' : 'buy',
      type: 'market',
      size: position.size,
      currentPrice,
      spread,
      bid,
      ask,
    })
  }, [chart.symbol, bid, ask, spread, placeOrder])

  // Keyboard shortcuts
  useKeyboardShortcuts(
    chartId,
    chartRef,
    activeTool,
    onToolSelect,
    handleQuickBuy,
    handleQuickSell,
    handleClosePosition
  )

  // Show help on ? key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowHelp((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Chart type switching
  const createSeries = useCallback((chartApi: IChartApi, type: ChartType) => {
    if (seriesRef.current) {
      chartApi.removeSeries(seriesRef.current)
      seriesRef.current = null
      lastSeriesTimeRef.current = null
    }
    switch (type) {
      case 'candlestick':
        return chartApi.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        })
      case 'line':
        return chartApi.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2 })
      case 'area':
        return chartApi.addSeries(AreaSeries, {
          lineColor: '#2962FF', topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.05)',
        })
      case 'heikin-ashi':
        return chartApi.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        })
      default:
        return chartApi.addSeries(CandlestickSeries, {
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        })
    }
  }, [])

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return
    const chartApi = createChart(containerRef.current, {
      layout: { background: { color: '#1e222d' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2B2B43' },
      timeScale: { borderColor: '#2B2B43' },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    })
    const series = createSeries(chartApi, chart.chartType)
    chartRef.current = chartApi
    seriesRef.current = series
    setChartApi(chartApi)
    setMainSeries(series)

    const volumeSeries = chartApi.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    volumeSeriesRef.current = volumeSeries

    const handleResize = () => {
      if (containerRef.current) {
        chartApi.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
      }
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)
    window.addEventListener('resize', handleResize)
    handleResize()

    const updateFollowRealtime = () => {
      const scrollPosition = chartApi.timeScale().scrollPosition()
      followRealtimeRef.current = scrollPosition <= 1
    }
    chartApi.timeScale().subscribeVisibleLogicalRangeChange(updateFollowRealtime)

    return () => {
      chartApi.timeScale().unsubscribeVisibleLogicalRangeChange(updateFollowRealtime)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      chartApi.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      setChartApi(null)
      setMainSeries(null)
    }
  }, [chartId])

  // Handle chart type change
  useEffect(() => {
    if (!chartRef.current) return
    const series = createSeries(chartRef.current, chart.chartType)
    seriesRef.current = series
    setMainSeries(series)
    if (chart.data.length > 0) {
      const orderedData = normalizeChartData(chart.data)
      const formatted = formatDataForChartType(orderedData, chart.chartType)
      series.setData(formatted as any)
      volumeSeriesRef.current?.setData(formatVolumeData(orderedData))
      lastSeriesTimeRef.current = getTimeOrderValue(orderedData[orderedData.length - 1]?.time)
    }
  }, [chart.chartType])

  // Live mode: update from store
  useEffect(() => {
    if (isBacktestMode || !seriesRef.current || chart.data.length === 0) return
    const orderedData = normalizeChartData(chart.data)
    const lastCandle = orderedData[orderedData.length - 1]
    const lastTime = getTimeOrderValue(lastCandle?.time)
    if (lastTime === null) return

    if (lastSeriesTimeRef.current !== null && lastTime < lastSeriesTimeRef.current) {
      seriesRef.current.setData(formatDataForChartType(orderedData, chart.chartType) as any)
      volumeSeriesRef.current?.setData(formatVolumeData(orderedData))
    } else {
      const formatted = formatCandleForChartType(lastCandle, chart.chartType, orderedData)
      seriesRef.current.update(formatted as any)
      volumeSeriesRef.current?.update(formatVolumeBar(lastCandle))
    }
    lastSeriesTimeRef.current = lastTime
    if (chartRef.current && followRealtimeRef.current && !isDrawingInteractionRef.current) {
      chartRef.current.timeScale().scrollToRealTime()
    }

    // Check alerts on price update
    const bid = lastCandle.close - 0.0001
    const ask = lastCandle.close + 0.0001
    alertsService.checkAlerts(chart.symbol.id, bid, ask)
  }, [chart.data, isBacktestMode, chart.chartType, chart.symbol.id])

  // Backtest mode: display historical data
  useEffect(() => {
    if (!isBacktestMode || !seriesRef.current || !backtestState) return
    const cursor = backtestState.cursor
    const dataToShow = backtestData.slice(0, cursor + 1)
    if (dataToShow.length === 0) return
    const formatted = formatDataForChartType(dataToShow as any, chart.chartType)
    if (cursor < 5 || cursor % 10 === 0) {
      seriesRef.current.setData(formatted as any)
      volumeSeriesRef.current?.setData(formatVolumeData(dataToShow as any))
    } else {
      seriesRef.current.update(formatted[formatted.length - 1] as any)
      volumeSeriesRef.current?.update(formatVolumeBar(dataToShow[dataToShow.length - 1] as any))
    }

    // Check alerts in backtest
    if (backtestState.currentCandle) {
      const bc = backtestState.currentCandle
      alertsService.checkAlerts(chart.symbol.id, bc.bid.close, bc.ask.close)
    }
  }, [isBacktestMode, backtestState?.cursor, backtestData, chart.chartType, chart.symbol.id])

  // Volume / grid visibility toggles
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: chart.showVolume })
  }, [chart.showVolume])

  useEffect(() => {
    chartRef.current?.applyOptions({
      grid: {
        vertLines: { visible: chart.showGrid },
        horzLines: { visible: chart.showGrid },
      },
    })
  }, [chart.showGrid])

  const currentCandle = btCandle || (chart.data.length > 0 ? chart.data[chart.data.length - 1] : null)
  useStrategyRunner(chart.symbol, bid, ask, spread, currentCandle)

  const overlayIndicators = chart.indicators.filter((i) => i.type === 'overlay')
  const panelIndicators = chart.indicators.filter((i) => i.type === 'panel' && i.visible)
  const volumeProfileIndicator = chart.indicators.find((i) => i.type === 'volume-profile' && i.visible)

  return (
    <div className={`relative flex flex-col border ${isActive ? 'border-blue-500' : 'border-gray-800'} bg-chart-bg overflow-hidden`} onClick={() => setActiveChart(chartId)}>
      {/* Chart panel header */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#161a25] border-b border-gray-800 min-h-[30px]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-200">{chart.symbol.name}</span>
          <span className="text-[10px] text-gray-500">{chart.timeframe}</span>
          <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-blue-400' : 'bg-gray-700'}`} />
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isBacktestMode ? 'bg-purple-900/40 text-purple-300 border-purple-800' : 'bg-emerald-900/30 text-emerald-300 border-emerald-800'}`}>
            {isBacktestMode ? 'BT' : 'LIVE'}
          </span>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          {!isBacktestMode && <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />}
          {bid > 0 && ask > 0 && (
            <span className="text-[11px] font-mono whitespace-nowrap">
              <span className="text-emerald-400">{bid.toFixed(chart.symbol.digits)}</span>
              <span className="text-gray-600 mx-1">|</span>
              <span className="text-red-400">{ask.toFixed(chart.symbol.digits)}</span>
            </span>
          )}
          {currentCandle && (
            <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
              O <span className="text-gray-200">{currentCandle.open.toFixed(chart.symbol.digits)}</span>
              <span className="mx-1" />
              H <span className="text-emerald-300">{currentCandle.high.toFixed(chart.symbol.digits)}</span>
              <span className="mx-1" />
              L <span className="text-red-300">{currentCandle.low.toFixed(chart.symbol.digits)}</span>
              <span className="mx-1" />
              C <span className="text-gray-200">{currentCandle.close.toFixed(chart.symbol.digits)}</span>
            </span>
          )}
          {!isBacktestMode && (
            <button onClick={() => removeChart(chartId)} className="h-6 w-6 text-gray-500 hover:text-red-400 inline-flex items-center justify-center" title="Close chart">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chart + side panels */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div
            className="relative bg-chart-bg"
            style={{ height: panelIndicators.length > 0 ? `calc(100% - ${panelIndicators.length * 120}px)` : '100%' }}
          >
            <div ref={setContainerRef} className="absolute inset-0" />
            {chartApi && mainSeries && (
              <PluginDrawingLayer
                chart={chartApi}
                series={mainSeries as any}
                container={chartContainer}
                activeTool={activeTool as any}
                onToolSelect={onToolSelect}
                onDrawingInteractionChange={(isInteracting) => {
                  isDrawingInteractionRef.current = isInteracting
                }}
              />
            )}
            {chartApi && mainSeries && <PositionLines chart={chartApi} series={mainSeries as any} symbol={chart.symbol} />}
            <ChartContextMenu chart={chartApi} series={mainSeries} symbol={chart.symbol} bid={bid} ask={ask} spread={spread} />
            {chartApi && mainSeries && (
              <IndicatorOverlay
                chart={chartApi}
                candleSeries={mainSeries as any}
                data={chart.data}
                indicators={overlayIndicators}
              />
            )}
            {chartApi && mainSeries && volumeProfileIndicator && (
              <VolumeProfileIndicator
                chart={chartApi}
                candleSeries={mainSeries as any}
                data={chart.data}
                visible={true}
                bins={(volumeProfileIndicator.params.bins as number) || 50}
              />
            )}
            {isActive && chartPanels.indicators && (
              <IndicatorsModal chartId={chartId} onClose={() => onChartPanelClose('indicators')} />
            )}
          </div>

          {panelIndicators.length > 0 && (
            <div className="border-t border-gray-800 flex-shrink-0">
              {panelIndicators.map((ind) => (
                <div key={ind.id} className="h-[120px] border-b border-gray-800 last:border-b-0">
                  <IndicatorPanel data={chart.data} indicator={ind} />
                </div>
              ))}
            </div>
          )}

        </div>

        {isActive && chartPanels.alerts && <AlertsPanel symbol={chart.symbol.id} />}
        {isActive && chartPanels.strategy && <StrategyPanel />}
        {isActive && chartPanels.dom && <DOMPanel symbol={chart.symbol} />}
        {isActive && chartPanels.order && <OrderPanel symbol={chart.symbol} bid={bid} ask={ask} spread={spread} />}
        {isActive && chartPanels.pnl && <PnLDashboard symbol={chart.symbol.id} />}
        {isActive && chartPanels.journal && <TradeJournal />}
        {isActive && chartPanels.mtf && <MultiTimeframePanel symbol={chart.symbol} primaryTimeframe={chart.timeframe} />}
      </div>

      <KeyboardHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  )
}

// ─── Data Format Helpers ───

function formatDataForChartType(data: any[], type: ChartType): any[] {
  switch (type) {
    case 'candlestick':
      return data.map((d) => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close }))
    case 'line':
      return data.map((d) => ({ time: d.time as Time, value: d.close }))
    case 'area':
      return data.map((d) => ({ time: d.time as Time, value: d.close }))
    case 'heikin-ashi':
      return calculateHeikinAshi(data)
    default:
      return data.map((d) => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close }))
  }
}

function getTimeOrderValue(time: unknown): number | null {
  if (typeof time === 'number') return time
  if (typeof time === 'string') {
    const parsed = Date.parse(time)
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000)
  }
  if (time && typeof time === 'object') {
    const maybeDate = time as { year?: unknown; month?: unknown; day?: unknown }
    if (
      typeof maybeDate.year === 'number' &&
      typeof maybeDate.month === 'number' &&
      typeof maybeDate.day === 'number'
    ) {
      return Date.UTC(maybeDate.year, maybeDate.month - 1, maybeDate.day) / 1000
    }
  }
  return null
}

function normalizeChartData<T extends { time: unknown }>(data: T[]): T[] {
  const byTime = new Map<number, T>()
  for (const item of data) {
    const orderTime = getTimeOrderValue(item.time)
    if (orderTime === null) continue
    byTime.set(orderTime, item)
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item)
}

function formatVolumeData(data: any[]): HistogramData[] {
  return data.map((d) => ({
    time: d.time as Time,
    value: d.volume,
    color: d.close >= d.open ? '#26a69a80' : '#ef535080',
  }))
}

function formatVolumeBar(candle: any): HistogramData {
  return {
    time: candle.time as Time,
    value: candle.volume,
    color: candle.close >= candle.open ? '#26a69a80' : '#ef535080',
  }
}

function formatCandleForChartType(candle: any, type: ChartType, allData: any[]): any {
  switch (type) {
    case 'candlestick':
      return { time: candle.time as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close }
    case 'line': case 'area':
      return { time: candle.time as Time, value: candle.close }
    case 'heikin-ashi':
      const ha = calculateHeikinAshi([...allData.slice(-2), candle])
      return ha[ha.length - 1]
    default:
      return { time: candle.time as Time, open: candle.open, high: candle.high, low: candle.low, close: candle.close }
  }
}

function calculateHeikinAshi(data: any[]): any[] {
  const ha: any[] = []
  let prevHA: any = null
  for (const candle of data) {
    const close = (candle.open + candle.high + candle.low + candle.close) / 4
    const open = prevHA ? (prevHA.open + prevHA.close) / 2 : (candle.open + candle.close) / 2
    const high = Math.max(candle.high, open, close)
    const low = Math.min(candle.low, open, close)
    const haCandle = { time: candle.time as Time, open, high, low, close }
    ha.push(haCandle)
    prevHA = haCandle
  }
  return ha
}
