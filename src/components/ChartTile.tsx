import { useRef, useEffect, useState, useCallback } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, Time, HistogramData } from 'lightweight-charts'
import { useLayoutStore } from '@/stores/layoutStore'
import { useBacktestStore } from '@/stores/backtestStore'
import { useRealtimeFeed } from '@/hooks/useRealtimeFeed'
import { useSyncCrosshair } from '@/hooks/useSyncCrosshair'
import { useStrategyRunner } from '@/hooks/useStrategyRunner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useOrderStore } from '@/stores/orderStore'
import { alertsService } from '@/services/alertsService'
import { ALL_SYMBOLS } from '@/types/market'
import { Timeframe, ChartType } from '@/types'
import DrawingOverlay from './DrawingOverlay'
import OrderPanel from './OrderPanel'
import DOMPanel from './DOMPanel'
import StrategyPanel from './StrategyPanel'
import PositionLines from './PositionLines'
import ChartContextMenu from './ChartContextMenu'
import AlertsPanel from './AlertsPanel'
import PnLDashboard from './PnLDashboard'
import TradeJournal from './TradeJournal'
import DrawingTemplateManager from './DrawingTemplateManager'
import MultiTimeframePanel from './MultiTimeframePanel'
import KeyboardHelpModal from './KeyboardHelpModal'
import LeftSidebar from './LeftSidebar'
import IndicatorsModal from './IndicatorsModal'
import IndicatorOverlay from './IndicatorOverlay'
import IndicatorPanel from './IndicatorPanel'
import VolumeProfileIndicator from './VolumeProfileIndicator'
import BottomPanel from './BottomPanel'

interface ChartTileProps {
  chartId: string
  isActive: boolean
}

export default function ChartTile({ chartId, isActive }: ChartTileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<any> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const [activeTool, setActiveTool] = useState('cursor')
  const [showOrderPanel, setShowOrderPanel] = useState(false)
  const [showDOM, setShowDOM] = useState(false)
  const [showStrategy, setShowStrategy] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showPnL, setShowPnL] = useState(false)
  const [showJournal, setShowJournal] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showMTF, setShowMTF] = useState(false)
  const [showIndicatorsModal, setShowIndicatorsModal] = useState(false)

  const chart = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)!)
  const updateChart = useLayoutStore((s) => s.updateChart)
  const setActiveChart = useLayoutStore((s) => s.setActiveChart)
  const removeChart = useLayoutStore((s) => s.removeChart)
  const undoDrawing = useLayoutStore((s) => s.undoDrawing)
  const redoDrawing = useLayoutStore((s) => s.redoDrawing)
  const canUndo = useLayoutStore((s) => (s.drawingStacks.get(chartId)?.undo.length ?? 0) > 0)
  const canRedo = useLayoutStore((s) => (s.drawingStacks.get(chartId)?.redo.length ?? 0) > 0)

  const isBacktestMode = useBacktestStore((s) => s.isBacktestMode)
  const backtestState = useBacktestStore((s) => s.state)
  const backtestData = useBacktestStore((s) => s.data)

  const { isConnected, getPrices } = useRealtimeFeed(chartId, chart.symbol, chart.timeframe)
  const prices = getPrices()

  const placeOrder = useOrderStore((s) => s.placeOrder)

  useSyncCrosshair(chartRef.current, chartId)

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
    setActiveTool,
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
    }
    switch (type) {
      case 'candlestick':
        return chartApi.addCandlestickSeries({
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        })
      case 'line':
        return chartApi.addLineSeries({ color: '#2962FF', lineWidth: 2 })
      case 'area':
        return chartApi.addAreaSeries({
          lineColor: '#2962FF', topColor: 'rgba(41, 98, 255, 0.4)',
          bottomColor: 'rgba(41, 98, 255, 0.05)',
        })
      case 'heikin-ashi':
        return chartApi.addCandlestickSeries({
          upColor: '#26a69a', downColor: '#ef5350',
          borderUpColor: '#26a69a', borderDownColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        })
      default:
        return chartApi.addCandlestickSeries({
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
    })
    const series = createSeries(chartApi, chart.chartType)
    chartRef.current = chartApi
    seriesRef.current = series

    const volumeSeries = chartApi.addHistogramSeries({
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
    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
      chartApi.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [chartId])

  // Handle chart type change
  useEffect(() => {
    if (!chartRef.current) return
    const series = createSeries(chartRef.current, chart.chartType)
    seriesRef.current = series
    if (chart.data.length > 0) {
      const formatted = formatDataForChartType(chart.data, chart.chartType)
      series.setData(formatted as any)
      volumeSeriesRef.current?.setData(formatVolumeData(chart.data))
    }
  }, [chart.chartType])

  // Live mode: update from store
  useEffect(() => {
    if (isBacktestMode || !seriesRef.current || chart.data.length === 0) return
    const lastCandle = chart.data[chart.data.length - 1]
    const formatted = formatCandleForChartType(lastCandle, chart.chartType, chart.data)
    seriesRef.current.update(formatted as any)
    volumeSeriesRef.current?.update(formatVolumeBar(lastCandle))

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

  const handleSymbolChange = useCallback((symbolId: string) => {
    const symbol = ALL_SYMBOLS.find((s) => s.id === symbolId)
    if (symbol) updateChart(chartId, { symbol, data: [] })
  }, [chartId, updateChart])

  const handleTimeframeChange = useCallback((tf: Timeframe) => {
    updateChart(chartId, { timeframe: tf, data: [] })
  }, [chartId, updateChart])

  const handleChartTypeChange = useCallback((type: ChartType) => {
    updateChart(chartId, { chartType: type })
  }, [chartId, updateChart])

  const currentCandle = btCandle || (chart.data.length > 0 ? chart.data[chart.data.length - 1] : null)
  useStrategyRunner(chart.symbol, bid, ask, spread, currentCandle)

  const overlayIndicators = chart.indicators.filter((i) => i.type === 'overlay')
  const panelIndicators = chart.indicators.filter((i) => i.type === 'panel' && i.visible)
  const volumeProfileIndicator = chart.indicators.find((i) => i.type === 'volume-profile' && i.visible)

  return (
    <div className={`relative flex flex-col border ${isActive ? 'border-blue-500' : 'border-gray-800'} bg-chart-bg overflow-hidden`} onClick={() => setActiveChart(chartId)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#161a25] border-b border-gray-800 min-h-[32px]">
        <div className="flex items-center gap-2">
          <select value={chart.symbol.id} onChange={(e) => handleSymbolChange(e.target.value)} disabled={isBacktestMode} className="bg-[#1e222d] text-white text-xs px-2 py-0.5 rounded border border-gray-700 outline-none disabled:opacity-50">
            {ALL_SYMBOLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={chart.timeframe} onChange={(e) => handleTimeframeChange(e.target.value as Timeframe)} disabled={isBacktestMode} className="bg-[#1e222d] text-white text-xs px-2 py-0.5 rounded border border-gray-700 outline-none disabled:opacity-50">
            {['1m', '5m', '15m', '1H', '4H', '1D', '1W'].map((tf) => <option key={tf} value={tf}>{tf}</option>)}
          </select>
          <select value={chart.chartType} onChange={(e) => handleChartTypeChange(e.target.value as ChartType)} className="bg-[#1e222d] text-white text-xs px-2 py-0.5 rounded border border-gray-700 outline-none">
            <option value="candlestick">Candles</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="heikin-ashi">Heikin</option>
          </select>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isBacktestMode ? 'bg-purple-900/50 text-purple-400 border border-purple-800' : 'bg-green-900/50 text-green-400 border border-green-800'}`}>
            {isBacktestMode ? 'BACKTEST' : 'LIVE'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isBacktestMode && <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />}
          {bid > 0 && ask > 0 && (
            <span className="text-xs font-mono">
              <span className="text-green-400">{bid.toFixed(chart.symbol.digits)}</span>
              <span className="text-gray-600 mx-1">|</span>
              <span className="text-red-400">{ask.toFixed(chart.symbol.digits)}</span>
            </span>
          )}
          <button onClick={() => undoDrawing(chartId)} disabled={!canUndo} className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-500 disabled:opacity-30 hover:text-white" title="Undo">↶</button>
          <button onClick={() => redoDrawing(chartId)} disabled={!canRedo} className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-500 disabled:opacity-30 hover:text-white" title="Redo">↷</button>
          <button onClick={() => setShowIndicatorsModal(!showIndicatorsModal)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showIndicatorsModal ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>Indicators</button>
          <button onClick={() => setShowAlerts(!showAlerts)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showAlerts ? 'bg-yellow-900 border-yellow-500 text-yellow-300' : 'border-gray-700 text-gray-500'}`}>Alerts</button>
          <button onClick={() => setShowStrategy(!showStrategy)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showStrategy ? 'bg-purple-900 border-purple-500 text-purple-300' : 'border-gray-700 text-gray-500'}`}>Strategy</button>
          <button onClick={() => setShowDOM(!showDOM)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showDOM ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>DOM</button>
          <button onClick={() => setShowOrderPanel(!showOrderPanel)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showOrderPanel ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>Order</button>
          <button onClick={() => setShowPnL(!showPnL)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showPnL ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>P&amp;L</button>
          <button onClick={() => setShowJournal(!showJournal)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showJournal ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>Journal</button>
          <button onClick={() => setShowTemplates(!showTemplates)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showTemplates ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>Templates</button>
          <button onClick={() => setShowMTF(!showMTF)} className={`text-[10px] px-1.5 py-0.5 rounded border ${showMTF ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}>MTF</button>
          {!isBacktestMode && <button onClick={() => removeChart(chartId)} className="text-gray-500 hover:text-red-400 text-xs px-1">×</button>}
        </div>
      </div>

      {/* Chart + side panels */}
      <div className="flex flex-1 min-h-0">
        <LeftSidebar chartId={chartId} activeTool={activeTool} onToolSelect={setActiveTool} />

        <div className="flex-1 flex flex-col min-w-0">
          <div
            className="relative bg-chart-bg"
            style={{ height: panelIndicators.length > 0 ? `calc(100% - ${panelIndicators.length * 120}px)` : '100%' }}
          >
            <div ref={containerRef} className="absolute inset-0" />
            <DrawingOverlay chartId={chartId} chart={chartRef.current!} candleSeries={seriesRef.current as any} activeTool={activeTool as any} />
            {seriesRef.current && <PositionLines chart={chartRef.current!} series={seriesRef.current as any} symbol={chart.symbol} />}
            <ChartContextMenu chart={chartRef.current} series={seriesRef.current} symbol={chart.symbol} bid={bid} ask={ask} spread={spread} />
            {chartRef.current && (
              <IndicatorOverlay
                chart={chartRef.current}
                candleSeries={seriesRef.current as any}
                data={chart.data}
                indicators={overlayIndicators}
              />
            )}
            {chartRef.current && volumeProfileIndicator && (
              <VolumeProfileIndicator
                chart={chartRef.current}
                candleSeries={seriesRef.current as any}
                data={chart.data}
                visible={true}
                bins={(volumeProfileIndicator.params.bins as number) || 50}
              />
            )}
            {showIndicatorsModal && (
              <IndicatorsModal chartId={chartId} onClose={() => setShowIndicatorsModal(false)} />
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

          <BottomPanel chartId={chartId} symbol={chart.symbol} />
        </div>

        {showAlerts && <AlertsPanel symbol={chart.symbol.id} />}
        {showStrategy && <StrategyPanel />}
        {showDOM && <DOMPanel symbol={chart.symbol} />}
        {showOrderPanel && <OrderPanel symbol={chart.symbol} bid={bid} ask={ask} spread={spread} />}
        {showPnL && <PnLDashboard symbol={chart.symbol.id} />}
        {showJournal && <TradeJournal />}
        {showTemplates && (
          <DrawingTemplateManager
            symbol={chart.symbol.id}
            timeframe={chart.timeframe}
            currentDrawings={chart.drawings}
            onApplyDrawings={(drawings) => updateChart(chartId, { drawings })}
          />
        )}
        {showMTF && <MultiTimeframePanel symbol={chart.symbol} primaryTimeframe={chart.timeframe} />}
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
