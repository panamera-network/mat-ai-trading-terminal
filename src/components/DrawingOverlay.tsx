import { useRef, useEffect, useState, useCallback } from 'react'
import { IChartApi, ISeriesApi, Logical, Time } from 'lightweight-charts'
import { nanoid } from 'nanoid'
import { CandleData, DrawingType, Drawing, DrawingPoint } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'

interface DrawingOverlayProps {
  chartId: string
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick'> | null
  activeTool: DrawingType
  data: CandleData[]
}

interface SvgPoint {
  x: number
  y: number
}

interface MagnetCandle {
  open: number
  high: number
  low: number
  close: number
}

function isMagnetCandle(value: unknown): value is MagnetCandle {
  if (!value || typeof value !== 'object') return false
  const candle = value as Record<string, unknown>
  return (
    typeof candle.open === 'number' &&
    typeof candle.high === 'number' &&
    typeof candle.low === 'number' &&
    typeof candle.close === 'number'
  )
}

export default function DrawingOverlay({ chartId, chart, candleSeries, activeTool, data }: DrawingOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drawings = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)?.drawings ?? [])
  const selectedDrawing = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)?.selectedDrawing ?? null)
  const magnetMode = useLayoutStore((s) => s.magnetMode)
  const addDrawingRaw = useLayoutStore((s) => s.addDrawing)
  const removeDrawingRaw = useLayoutStore((s) => s.removeDrawing)
  const selectDrawingRaw = useLayoutStore((s) => s.selectDrawing)
  const updateDrawingRaw = useLayoutStore((s) => s.updateDrawing)
  const undoDrawing = useLayoutStore((s) => s.undoDrawing)
  const redoDrawing = useLayoutStore((s) => s.redoDrawing)
  const addDrawing = useCallback((d: Drawing) => addDrawingRaw(chartId, d), [addDrawingRaw, chartId])
  const removeDrawing = useCallback((id: string) => removeDrawingRaw(chartId, id), [removeDrawingRaw, chartId])
  const selectDrawing = useCallback((id: string | null) => selectDrawingRaw(chartId, id), [selectDrawingRaw, chartId])
  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => updateDrawingRaw(chartId, id, updates), [updateDrawingRaw, chartId])
  const undo = useCallback(() => undoDrawing(chartId), [undoDrawing, chartId])
  const redo = useCallback(() => redoDrawing(chartId), [redoDrawing, chartId])
  const [isDrawing, setIsDrawing] = useState(false)
  const [tempPoints, setTempPoints] = useState<DrawingPoint[]>([])
  const [svgPoints, setSvgPoints] = useState<SvgPoint[]>([])
  const [renderKey, setRenderKey] = useState(0)
  const [editingText, setEditingText] = useState<string | null>(null)
  const [editTextValue, setEditTextValue] = useState('')
  const [draggingPoint, setDraggingPoint] = useState<{ drawingId: string; pointIndex: number } | null>(null)

  // Subscribe to chart changes
  useEffect(() => {
    if (!chart) return
    const handleChange = () => setRenderKey(prev => prev + 1)
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleChange)
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleChange)
    }
  }, [chart])

  // Keyboard shortcuts with undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawing && !editingText) {
          const drawing = drawings.find(d => d.id === selectedDrawing)
          if (drawing && !drawing.locked) {
            removeDrawing(selectedDrawing)
          }
        }
      }
      if (e.key === 'Escape') {
        if (isDrawing) {
          setIsDrawing(false)
          setTempPoints([])
          setSvgPoints([])
        }
        if (editingText) {
          setEditingText(null)
          setEditTextValue('')
        }
        selectDrawing(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedDrawing, drawings, isDrawing, editingText, removeDrawing, selectDrawing, undo, redo])

  const chartToSvg = useCallback((time: number, price: number): SvgPoint | null => {
    if (!chart || !candleSeries) return null
    const timeScale = chart.timeScale()
    const x = timeScale.timeToCoordinate(time as Time) ?? timeScale.logicalToCoordinate(time as Logical)
    const y = candleSeries.priceToCoordinate(price)
    if (x === null || y === null) return null
    return { x, y }
  }, [chart, candleSeries])

  const svgToChart = useCallback((x: number, y: number): DrawingPoint | null => {
    if (!chart || !candleSeries) return null
    const timeScale = chart.timeScale()
    const logical = timeScale.coordinateToLogical(x)
    const time = timeScale.coordinateToTime(x) ?? logical
    const price = candleSeries.coordinateToPrice(y)
    if (time === null || price === null) return null
    if (!magnetMode || logical === null || data.length === 0) return { time: time as number, price }

    const candle = data[Math.max(0, Math.min(data.length - 1, Math.round(logical)))]
    const prices = [candle.open, candle.high, candle.low, candle.close]
    const nearestPrice = prices.reduce((prev, curr) =>
      Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
    )
    return { time: candle.time, price: nearestPrice }
  }, [chart, candleSeries, data, magnetMode])

  // Magnet snap
  const snapToMagnet = useCallback((point: DrawingPoint): DrawingPoint => {
    if (!magnetMode || !candleSeries || data.length === 0) return point
    const timeScale = chart.timeScale()
    const x = timeScale.timeToCoordinate(point.time as Time) ?? timeScale.logicalToCoordinate(point.time as Logical)
    if (x === null) return point
    const logical = timeScale.coordinateToLogical(x)
    if (logical === null) return point
    const candle = data[Math.max(0, Math.min(data.length - 1, Math.round(logical)))]
    if (!isMagnetCandle(candle)) return point
    const prices = [candle.open, candle.high, candle.low, candle.close]
    const nearestPrice = prices.reduce((prev, curr) => 
      Math.abs(curr - point.price) < Math.abs(prev - point.price) ? curr : prev
    )
    return { time: candle.time, price: nearestPrice }
  }, [chart, candleSeries, data, magnetMode])

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement
    const pointData = target.closest('[data-point]')?.getAttribute('data-point')
    if (pointData) {
      const [drawingId, pointIndex] = pointData.split(':')
      selectDrawing(drawingId)
      setDraggingPoint({ drawingId, pointIndex: parseInt(pointIndex, 10) })
      return
    }

    if (activeTool === 'cursor') {
      const drawingId = target.closest('[data-drawing-id]')?.getAttribute('data-drawing-id')
      if (drawingId) {
        selectDrawing(drawingId)
      } else {
        selectDrawing(null)
      }
      return
    }

    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let chartPoint = svgToChart(x, y)
    if (!chartPoint) return
    chartPoint = snapToMagnet(chartPoint)
    setIsDrawing(true)
    setTempPoints([chartPoint])
    setSvgPoints([{ x, y }])
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // Handle dragging
    if (draggingPoint) {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      let chartPoint = svgToChart(x, y)
      if (!chartPoint) return
      chartPoint = snapToMagnet(chartPoint)

      const drawing = drawings.find(d => d.id === draggingPoint.drawingId)
      if (drawing && !drawing.locked) {
        const newPoints = [...drawing.points]
        newPoints[draggingPoint.pointIndex] = chartPoint
        updateDrawing(drawing.id, { points: newPoints })
      }
      return
    }

    if (!isDrawing || tempPoints.length === 0) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let chartPoint = svgToChart(x, y)
    if (!chartPoint) return
    chartPoint = snapToMagnet(chartPoint)
    setTempPoints([tempPoints[0], chartPoint])
    setSvgPoints([svgPoints[0], { x, y }])
  }

  const handleMouseUp = () => {
    if (draggingPoint) {
      setDraggingPoint(null)
      return
    }

    if (!isDrawing) {
      setIsDrawing(false)
      setTempPoints([])
      setSvgPoints([])
      return
    }

    const singleClickTools: DrawingType[] = ['horizontal', 'vertical', 'text']
    if (singleClickTools.includes(activeTool) && tempPoints.length >= 1) {
      const newDrawing: Drawing = {
        id: `drawing-${nanoid(8)}`,
        type: activeTool,
        points: [tempPoints[0]],
        color: '#2962FF',
        style: 'solid',
        width: activeTool === 'horizontal' || activeTool === 'vertical' ? 2 : 1,
        text: activeTool === 'text' ? 'Text' : undefined,
      }
      addDrawing(newDrawing)
      selectDrawing(newDrawing.id)
      setIsDrawing(false)
      setTempPoints([])
      setSvgPoints([])
      return
    }

    if (tempPoints.length < 2) {
      setIsDrawing(false)
      setTempPoints([])
      setSvgPoints([])
      return
    }

    const newDrawing: Drawing = {
      id: `drawing-${nanoid(8)}`,
      type: activeTool,
      points: tempPoints,
      color: activeTool === 'horizontal' || activeTool === 'vertical' ? '#2962FF' : '#fff',
      style: 'solid',
      width: 1,
    }
    addDrawing(newDrawing)
    selectDrawing(newDrawing.id)
    setIsDrawing(false)
    setTempPoints([])
    setSvgPoints([])
  }

  const handleDrawingClick = (e: React.MouseEvent, drawingId: string) => {
    e.stopPropagation()
    const drawing = drawings.find(d => d.id === drawingId)
    if (drawing?.locked) return
    selectDrawing(drawingId)
  }

  const handleTextDoubleClick = (e: React.MouseEvent, drawingId: string) => {
    e.stopPropagation()
    const drawing = drawings.find(d => d.id === drawingId)
    if (!drawing || drawing.locked) return
    setEditingText(drawingId)
    setEditTextValue(drawing.text || 'Text')
  }

  const handleTextSubmit = () => {
    if (!editingText) return
    updateDrawing(editingText, { text: editTextValue })
    setEditingText(null)
    setEditTextValue('')
  }

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTextSubmit()
    if (e.key === 'Escape') {
      setEditingText(null)
      setEditTextValue('')
    }
  }

  // ─── Render functions ───
  const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
  const FIB_COLORS = ['#fff', '#fb8c00', '#fdd835', '#fff', '#ab47bc', '#ef5350', '#fff']

  const renderDrawing = (drawing: Drawing) => {
    const isSelected = selectedDrawing === drawing.id
    const isLocked = drawing.locked
    const color = isSelected ? '#2962FF' : (drawing.color || '#fff')
    const width = isSelected ? 2 : (drawing.width || 1)
    const svgWidth = svgRef.current?.clientWidth || 1000
    const svgHeight = svgRef.current?.clientHeight || 600

    const commonProps = {
      'data-drawing-id': drawing.id,
      className: isLocked ? 'cursor-not-allowed' : 'cursor-pointer',
      onClick: (e: React.MouseEvent) => handleDrawingClick(e, drawing.id),
      opacity: isLocked ? 0.6 : 1,
    }

    // Draggable handle renderer
    const renderHandle = (point: SvgPoint, index: number) => {
      if (!isSelected || isLocked) return null
      return (
        <circle
          key={`handle-${index}`}
          data-point={`${drawing.id}:${index}`}
          cx={point.x}
          cy={point.y}
          r={5}
          fill="#2962FF"
          stroke="#fff"
          strokeWidth={1}
          className="cursor-move hover:r-6"
          style={{ transition: 'r 0.1s' }}
        />
      )
    }

    switch (drawing.type) {
      case 'trendline': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        return (
          <g key={drawing.id}>
            <line {...commonProps} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={color} strokeWidth={width}
              strokeDasharray={drawing.style === 'dashed' ? '5,5' : undefined} />
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'horizontal': {
        if (drawing.points.length < 1) return null
        const p = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        if (!p) return null
        return (
          <g key={drawing.id}>
            <line {...commonProps} x1={0} y1={p.y} x2={svgWidth} y2={p.y}
              stroke={color} strokeWidth={width}
              strokeDasharray={drawing.style === 'dashed' ? '5,5' : undefined} />
            <rect {...commonProps} x={svgWidth - 75} y={p.y - 10} width={75} height={20}
              fill={color} rx={2} />
            <text x={svgWidth - 37} y={p.y + 4} textAnchor="middle" fill="#fff" fontSize={10}
              className="pointer-events-none">
              {drawing.points[0].price.toFixed(2)}
            </text>
            {renderHandle({ x: svgWidth / 2, y: p.y }, 0)}
          </g>
        )
      }

      case 'vertical': {
        if (drawing.points.length < 1) return null
        const p = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        if (!p) return null
        return (
          <g key={drawing.id}>
            <line {...commonProps} x1={p.x} y1={0} x2={p.x} y2={svgHeight}
              stroke={color} strokeWidth={width}
              strokeDasharray={drawing.style === 'dashed' ? '5,5' : undefined} />
            {renderHandle({ x: p.x, y: svgHeight / 2 }, 0)}
          </g>
        )
      }

      case 'ray': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const t = svgWidth / Math.max(Math.abs(dx), 1)
        return (
          <g key={drawing.id}>
            <line {...commonProps} x1={p1.x} y1={p1.y} x2={p1.x + dx * t} y2={p1.y + dy * t}
              stroke={color} strokeWidth={width}
              strokeDasharray={drawing.style === 'dashed' ? '5,5' : undefined} />
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'extended': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const t1 = -p1.x / Math.max(dx, 1)
        const t2 = (svgWidth - p1.x) / Math.max(dx, 1)
        return (
          <g key={drawing.id}>
            <line {...commonProps}
              x1={p1.x + dx * Math.min(t1, t2)} y1={p1.y + dy * Math.min(t1, t2)}
              x2={p1.x + dx * Math.max(t1, t2)} y2={p1.y + dy * Math.max(t1, t2)}
              stroke={color} strokeWidth={width}
              strokeDasharray={drawing.style === 'dashed' ? '5,5' : undefined} />
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'fibonacci': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const highPrice = Math.max(drawing.points[0].price, drawing.points[1].price)
        const lowPrice = Math.min(drawing.points[0].price, drawing.points[1].price)
        const range = highPrice - lowPrice
        const leftX = Math.min(p1.x, p2.x)
        return (
          <g key={drawing.id}>
            {FIB_LEVELS.map((level, i) => {
              const price = highPrice - range * level
              const y = chartToSvg(0, price)?.y
              if (y === undefined || y === null) return null
              return (
                <g key={i}>
                  <line {...commonProps} x1={leftX} y1={y} x2={svgWidth} y2={y}
                    stroke={FIB_COLORS[i]} strokeWidth={1} opacity={0.8} />
                  <rect {...commonProps} x={svgWidth - 50} y={y - 9} width={50} height={18}
                    fill={FIB_COLORS[i]} rx={2} opacity={0.9} />
                  <text x={svgWidth - 25} y={y + 4} textAnchor="middle" fill="#000" fontSize={10}
                    fontWeight="bold" className="pointer-events-none">
                    {(level * 100).toFixed(1)}%
                  </text>
                </g>
              )
            })}
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'fibonacciExtension': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const highPrice = Math.max(drawing.points[0].price, drawing.points[1].price)
        const lowPrice = Math.min(drawing.points[0].price, drawing.points[1].price)
        const range = highPrice - lowPrice
        const leftX = Math.min(p1.x, p2.x)
        const extLevels = [0, 0.618, 1, 1.272, 1.618, 2, 2.618]
        return (
          <g key={drawing.id}>
            {extLevels.map((level, i) => {
              const price = highPrice + range * level
              const y = chartToSvg(0, price)?.y
              if (y === undefined || y === null) return null
              return (
                <g key={i}>
                  <line {...commonProps} x1={leftX} y1={y} x2={svgWidth} y2={y}
                    stroke="#ab47bc" strokeWidth={1} opacity={0.7} />
                  <text x={svgWidth - 5} y={y - 3} textAnchor="end" fill="#ab47bc" fontSize={9}
                    className="pointer-events-none">
                    {level.toFixed(3)}x
                  </text>
                </g>
              )
            })}
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'parallel': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const offset = 30
        return (
          <g key={drawing.id}>
            <line {...commonProps} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={color} strokeWidth={width} />
            <line {...commonProps} x1={p1.x} y1={p1.y + offset} x2={p2.x} y2={p2.y + offset}
              stroke={color} strokeWidth={width} strokeDasharray="5,5" />
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'rectangle': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const x = Math.min(p1.x, p2.x)
        const y = Math.min(p1.y, p2.y)
        const w = Math.abs(p2.x - p1.x)
        const h = Math.abs(p2.y - p1.y)
        return (
          <g key={drawing.id}>
            <rect {...commonProps} x={x} y={y} width={w} height={h}
              fill={isSelected ? 'rgba(41, 98, 255, 0.1)' : 'none'}
              stroke={color} strokeWidth={width}
              strokeDasharray={drawing.style === 'dashed' ? '5,5' : undefined} />
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'circle': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const cx = (p1.x + p2.x) / 2
        const cy = (p1.y + p2.y) / 2
        const rx = Math.abs(p2.x - p1.x) / 2
        const ry = Math.abs(p2.y - p1.y) / 2
        return (
          <g key={drawing.id}>
            <ellipse {...commonProps} cx={cx} cy={cy} rx={rx} ry={ry}
              fill={isSelected ? 'rgba(41, 98, 255, 0.1)' : 'none'}
              stroke={color} strokeWidth={width} />
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      case 'text': {
        if (drawing.points.length < 1) return null
        const p = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        if (!p) return null

        if (editingText === drawing.id) {
          return (
            <foreignObject key={drawing.id} x={p.x - 2} y={p.y - 20} width={200} height={30}>
              <input
                type="text"
                value={editTextValue}
                onChange={(e) => setEditTextValue(e.target.value)}
                onBlur={handleTextSubmit}
                onKeyDown={handleTextKeyDown}
                className="bg-[#1e222d] border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none w-full"
                autoFocus
              />
            </foreignObject>
          )
        }

        return (
          <g key={drawing.id}>
            <rect {...commonProps} x={p.x - 2} y={p.y - 14} width={80} height={18}
              fill="transparent" onDoubleClick={(e) => handleTextDoubleClick(e, drawing.id)} />
            <text x={p.x} y={p.y} fill={color} fontSize={12}
              className={isLocked ? '' : 'cursor-pointer'}
              onDoubleClick={isLocked ? undefined : (e) => handleTextDoubleClick(e, drawing.id)}>
              {drawing.text || 'Text'}
            </text>
            {isSelected && !isLocked && renderHandle(p, 0)}
          </g>
        )
      }

      case 'measure': {
        if (drawing.points.length < 2) return null
        const p1 = chartToSvg(drawing.points[0].time as number, drawing.points[0].price)
        const p2 = chartToSvg(drawing.points[1].time as number, drawing.points[1].price)
        if (!p1 || !p2) return null
        const priceDiff = Math.abs(drawing.points[1].price - drawing.points[0].price)
        const pctDiff = ((priceDiff / drawing.points[0].price) * 100).toFixed(2)
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        return (
          <g key={drawing.id}>
            <line {...commonProps} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#fb8c00" strokeWidth={1} strokeDasharray="5,5" />
            <rect {...commonProps} x={midX - 50} y={midY - 15} width={100} height={30}
              fill="rgba(30, 34, 45, 0.9)" stroke="#fb8c00" rx={4} />
            <text x={midX} y={midY - 2} textAnchor="middle" fill="#fb8c00" fontSize={10}
              className="pointer-events-none">
              {priceDiff.toFixed(2)} ({pctDiff}%)
            </text>
            <text x={midX} y={midY + 10} textAnchor="middle" fill="#aaa" fontSize={9}
              className="pointer-events-none">
              {Math.abs(drawing.points[1].time - drawing.points[0].time)} bars
            </text>
            {renderHandle(p1, 0)}
            {renderHandle(p2, 1)}
          </g>
        )
      }

      default:
        return null
    }
  }

  const renderTempDrawing = () => {
    if (!isDrawing || svgPoints.length < 1) return null
    const p1 = svgPoints[0]
    const p2 = svgPoints[1] || svgPoints[0]
    const svgWidth = svgRef.current?.clientWidth || 1000
    const svgHeight = svgRef.current?.clientHeight || 600

    switch (activeTool) {
      case 'trendline':
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2962FF" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
      case 'horizontal':
        return <line x1={0} y1={p1.y} x2={svgWidth} y2={p1.y} stroke="#2962FF" strokeWidth={2} strokeDasharray="5,5" opacity={0.7} />
      case 'vertical':
        return <line x1={p1.x} y1={0} x2={p1.x} y2={svgHeight} stroke="#2962FF" strokeWidth={2} strokeDasharray="5,5" opacity={0.7} />
      case 'ray': {
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const t = svgWidth / Math.max(Math.abs(dx), 1)
        return <line x1={p1.x} y1={p1.y} x2={p1.x + dx * t} y2={p1.y + dy * t} stroke="#2962FF" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
      }
      case 'extended': {
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const t1 = -p1.x / Math.max(dx, 1)
        const t2 = (svgWidth - p1.x) / Math.max(dx, 1)
        return <line x1={p1.x + dx * Math.min(t1, t2)} y1={p1.y + dy * Math.min(t1, t2)} x2={p1.x + dx * Math.max(t1, t2)} y2={p1.y + dy * Math.max(t1, t2)} stroke="#2962FF" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
      }
      case 'fibonacci':
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2962FF" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
      case 'fibonacciExtension':
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#ab47bc" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
      case 'parallel':
        return (
          <g>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2962FF" strokeWidth={1} opacity={0.7} />
            <line x1={p1.x} y1={p1.y + 30} x2={p2.x} y2={p2.y + 30} stroke="#2962FF" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
          </g>
        )
      case 'rectangle': {
        const x = Math.min(p1.x, p2.x)
        const y = Math.min(p1.y, p2.y)
        const w = Math.abs(p2.x - p1.x)
        const h = Math.abs(p2.y - p1.y)
        return <rect x={x} y={y} width={w} height={h} fill="rgba(41, 98, 255, 0.05)" stroke="#2962FF" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
      }
      case 'circle': {
        const cx = (p1.x + p2.x) / 2
        const cy = (p1.y + p2.y) / 2
        const rx = Math.abs(p2.x - p1.x) / 2
        const ry = Math.abs(p2.y - p1.y) / 2
        return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="rgba(41, 98, 255, 0.05)" stroke="#2962FF" strokeWidth={1} opacity={0.7} />
      }
      case 'text':
        return <text x={p1.x} y={p1.y} fill="#2962FF" fontSize={12} opacity={0.7}>Text</text>
      case 'measure':
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fb8c00" strokeWidth={1} strokeDasharray="5,5" opacity={0.7} />
      default:
        return null
    }
  }

  const svgWidth = svgRef.current?.clientWidth || 1000
  const svgHeight = svgRef.current?.clientHeight || 600

  return (
    <svg
      ref={svgRef}
      key={renderKey}
      className="absolute inset-0 h-full w-full pointer-events-auto touch-none"
      style={{ zIndex: 10 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {drawings.map(renderDrawing)}
      {renderTempDrawing()}
      {activeTool !== 'cursor' && (
        <text x={10} y={20} fill="#2962FF" fontSize={11} className="pointer-events-none">
          {activeTool.toUpperCase()} — {['horizontal', 'vertical', 'text'].includes(activeTool) ? 'Click to place' : 'Click and drag'}
          {magnetMode && ' (Magnet ON)'}
        </text>
      )}
    </svg>
  )
}
