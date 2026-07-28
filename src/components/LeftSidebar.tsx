import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Circle,
  Flag,
  GitCompareArrows,
  Highlighter,
  MapPin,
  MessageSquare,
  Magnet,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  PenLine,
  Pin,
  Ruler,
  Shapes,
  Square,
  Table2,
  Tags,
  TextCursorInput,
  TrendingUp,
  Triangle,
  Type,
  Waypoints,
  Zap,
} from 'lucide-react'
import { DrawingType } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'

interface ToolItem {
  id: DrawingType
  icon: React.ReactNode
  label: string
  group: string
  enabled: boolean
}

const toolText = (label: string) => <span className="text-[8px] font-bold leading-none">{label}</span>

const TOOLS: ToolItem[] = [
  { id: 'cursor', icon: <MousePointer2 size={16} />, label: 'Cursor', group: 'cursor', enabled: true },

  { id: 'trendline', icon: <PenLine size={16} />, label: 'Trend Line', group: 'lines', enabled: true },
  { id: 'horizontal', icon: <MoveHorizontal size={16} />, label: 'Horizontal Line', group: 'lines', enabled: true },
  { id: 'vertical', icon: <MoveVertical size={16} />, label: 'Vertical Line', group: 'lines', enabled: true },
  { id: 'ray', icon: <ArrowRight size={16} />, label: 'Ray', group: 'lines', enabled: true },
  { id: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow', group: 'lines', enabled: true },
  { id: 'extended', icon: <GitCompareArrows size={16} />, label: 'Extended Line', group: 'lines', enabled: true },
  { id: 'crossLine', icon: <Zap size={15} />, label: 'Cross Line', group: 'lines', enabled: true },
  { id: 'infoLine', icon: <Ruler size={15} />, label: 'Info Line', group: 'lines', enabled: true },
  { id: 'trendAngle', icon: <TrendingUp size={15} />, label: 'Trend Angle', group: 'lines', enabled: true },
  { id: 'horizontalRay', icon: <ArrowRight size={16} />, label: 'Horizontal Ray', group: 'lines', enabled: true },

  { id: 'rectangle', icon: <Square size={16} />, label: 'Rectangle', group: 'shapes', enabled: true },
  { id: 'circle', icon: <Circle size={16} />, label: 'Circle', group: 'shapes', enabled: true },
  { id: 'priceRange', icon: <Ruler size={15} />, label: 'Price Range', group: 'shapes', enabled: true },
  { id: 'ellipse', icon: <Circle size={16} />, label: 'Ellipse', group: 'shapes', enabled: true },
  { id: 'path', icon: <Waypoints size={15} />, label: 'Path', group: 'shapes', enabled: true },
  { id: 'polyline', icon: <Shapes size={15} />, label: 'Polyline', group: 'shapes', enabled: true },
  { id: 'triangle', icon: <Triangle size={16} />, label: 'Triangle', group: 'shapes', enabled: false },
  { id: 'arc', icon: toolText('ARC'), label: 'Arc', group: 'shapes', enabled: false },
  { id: 'rotatedRectangle', icon: toolText('ROT'), label: 'Rotated Rectangle', group: 'shapes', enabled: false },
  { id: 'curve', icon: toolText('CRV'), label: 'Curve', group: 'shapes', enabled: false },
  { id: 'doubleCurve', icon: toolText('2CV'), label: 'Double Curve', group: 'shapes', enabled: false },

  { id: 'parallel', icon: toolText('CH'), label: 'Parallel Channel', group: 'channels', enabled: false },
  { id: 'regressionTrend', icon: <TrendingUp size={15} />, label: 'Regression Trend', group: 'channels', enabled: true },
  { id: 'flatTopBottom', icon: toolText('FTB'), label: 'Flat Top/Bottom', group: 'channels', enabled: false },
  { id: 'disjointChannel', icon: toolText('DC'), label: 'Disjoint Channel', group: 'channels', enabled: false },

  { id: 'fibonacci', icon: toolText('FIB'), label: 'Fib Retracement', group: 'fib', enabled: true },
  { id: 'fibTimeZone', icon: toolText('FTZ'), label: 'Fib Time Zone', group: 'fib', enabled: true },
  { id: 'fibSpeedFan', icon: toolText('FSF'), label: 'Fib Speed Fan', group: 'fib', enabled: true },
  { id: 'fibCircles', icon: toolText('FIC'), label: 'Fib Circles', group: 'fib', enabled: true },
  { id: 'fibSpiral', icon: toolText('FSP'), label: 'Fib Spiral', group: 'fib', enabled: true },
  { id: 'fibArcs', icon: toolText('FAR'), label: 'Fib Arcs', group: 'fib', enabled: true },
  { id: 'fibonacciExtension', icon: toolText('EXT'), label: 'Fib Extension', group: 'fib', enabled: false },
  { id: 'fibChannel', icon: toolText('FCH'), label: 'Fib Channel', group: 'fib', enabled: false },
  { id: 'fibTimeExtension', icon: toolText('FTE'), label: 'Trend-Based Fib Time', group: 'fib', enabled: false },
  { id: 'fibWedge', icon: toolText('FW'), label: 'Fib Wedge', group: 'fib', enabled: false },
  { id: 'pitchfan', icon: toolText('PF'), label: 'Pitchfan', group: 'fib', enabled: false },

  { id: 'andrewsPitchfork', icon: toolText('AP'), label: "Andrews' Pitchfork", group: 'pitchfork', enabled: false },
  { id: 'schiffPitchfork', icon: toolText('SP'), label: 'Schiff Pitchfork', group: 'pitchfork', enabled: false },
  { id: 'modifiedSchiffPitchfork', icon: toolText('MS'), label: 'Modified Schiff Pitchfork', group: 'pitchfork', enabled: false },
  { id: 'insidePitchfork', icon: toolText('IP'), label: 'Inside Pitchfork', group: 'pitchfork', enabled: false },

  { id: 'gannBox', icon: <Square size={16} />, label: 'Gann Box', group: 'gann', enabled: true },
  { id: 'gannFan', icon: toolText('GF'), label: 'Gann Fan', group: 'gann', enabled: true },
  { id: 'gannSquareFixed', icon: toolText('GSF'), label: 'Gann Square Fixed', group: 'gann', enabled: true },
  { id: 'gannSquare', icon: toolText('GS'), label: 'Gann Square', group: 'gann', enabled: true },

  { id: 'dateRange', icon: <Ruler size={15} />, label: 'Date Range', group: 'measure', enabled: true },
  { id: 'datePriceRange', icon: <Ruler size={15} />, label: 'Date and Price Range', group: 'measure', enabled: true },
  { id: 'forecast', icon: <TrendingUp size={15} />, label: 'Forecast', group: 'measure', enabled: true },
  { id: 'longPosition', icon: <ArrowUp size={16} />, label: 'Long Position', group: 'measure', enabled: false },
  { id: 'shortPosition', icon: <ArrowDown size={16} />, label: 'Short Position', group: 'measure', enabled: false },
  { id: 'projection', icon: toolText('PRJ'), label: 'Projection', group: 'measure', enabled: false },
  { id: 'barsPattern', icon: toolText('BAR'), label: 'Bars Pattern', group: 'measure', enabled: false },

  { id: 'text', icon: <Type size={16} />, label: 'Text', group: 'annotations', enabled: true },
  { id: 'callout', icon: <MessageSquare size={15} />, label: 'Callout', group: 'annotations', enabled: true },
  { id: 'brush', icon: <PenLine size={16} />, label: 'Brush', group: 'annotations', enabled: true },
  { id: 'highlighter', icon: <Highlighter size={15} />, label: 'Highlighter', group: 'annotations', enabled: true },
  { id: 'arrowMarker', icon: <ArrowRight size={16} />, label: 'Arrow Marker', group: 'annotations', enabled: true },
  { id: 'arrowMarkUp', icon: <ArrowUp size={16} />, label: 'Arrow Mark Up', group: 'annotations', enabled: true },
  { id: 'arrowMarkDown', icon: <ArrowDown size={16} />, label: 'Arrow Mark Down', group: 'annotations', enabled: true },
  { id: 'note', icon: <TextCursorInput size={15} />, label: 'Note', group: 'annotations', enabled: true },
  { id: 'priceNote', icon: <Tags size={15} />, label: 'Price Note', group: 'annotations', enabled: true },
  { id: 'priceLabel', icon: <Tags size={15} />, label: 'Price Label', group: 'annotations', enabled: true },
  { id: 'flagMark', icon: <Flag size={15} />, label: 'Flag Mark', group: 'annotations', enabled: true },
  { id: 'pin', icon: <Pin size={15} />, label: 'Pin', group: 'annotations', enabled: true },
  { id: 'comment', icon: <MessageSquare size={15} />, label: 'Comment', group: 'annotations', enabled: true },
  { id: 'signpost', icon: <MapPin size={15} />, label: 'Signpost', group: 'annotations', enabled: true },
  { id: 'table', icon: <Table2 size={15} />, label: 'Table', group: 'annotations', enabled: true },
  { id: 'anchoredText', icon: <Type size={16} />, label: 'Anchored Text', group: 'annotations', enabled: false },
]

const GROUPS = ['cursor', 'lines', 'shapes', 'channels', 'fib', 'pitchfork', 'gann', 'measure', 'annotations']

const GROUP_META: Record<string, { label: string; fallbackIcon: React.ReactNode }> = {
  cursor: { label: 'Cursor', fallbackIcon: <MousePointer2 size={16} /> },
  lines: { label: 'Lines', fallbackIcon: <PenLine size={16} /> },
  shapes: { label: 'Shapes', fallbackIcon: <Square size={16} /> },
  channels: { label: 'Channels', fallbackIcon: toolText('CH') },
  fib: { label: 'Fibonacci', fallbackIcon: toolText('FIB') },
  pitchfork: { label: 'Pitchforks', fallbackIcon: toolText('PF') },
  gann: { label: 'Gann', fallbackIcon: toolText('GAN') },
  measure: { label: 'Measure & Forecast', fallbackIcon: <Ruler size={15} /> },
  annotations: { label: 'Annotations', fallbackIcon: <Type size={16} /> },
}

interface LeftSidebarProps {
  activeTool: string
  onToolSelect: (tool: string) => void
}

export default function LeftSidebar({ activeTool, onToolSelect }: LeftSidebarProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [flyoutTop, setFlyoutTop] = useState(0)
  const [flyoutLeft, setFlyoutLeft] = useState(0)
  const magnetMode = useLayoutStore((s) => s.magnetMode)
  const toggleMagnetMode = useLayoutStore((s) => s.toggleMagnetMode)
  const toolsByGroup = useMemo(() => {
    return GROUPS.reduce<Record<string, ToolItem[]>>((acc, group) => {
      acc[group] = TOOLS.filter((tool) => tool.group === group)
      return acc
    }, {})
  }, [])

  const openFlyout = (group: string, element: HTMLElement) => {
    const groupTools = toolsByGroup[group] ?? []
    const estimatedHeight = Math.min(520, window.innerHeight - 112, 35 + Math.ceil(groupTools.length / 2) * 36)
    const rect = element.getBoundingClientRect()
    const nextTop = Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - estimatedHeight - 8))
    const nextLeft = Math.min(Math.max(8, rect.right + 4), Math.max(8, window.innerWidth - 232))
    setFlyoutTop(nextTop)
    setFlyoutLeft(nextLeft)
    setOpenGroup(group)
  }

  return (
    <div
      className="relative w-9 bg-[#161a25] border-r border-gray-800 flex flex-col items-center py-2 gap-0.5 flex-shrink-0 overflow-visible z-40"
      onMouseLeave={() => setOpenGroup(null)}
    >
      {GROUPS.map((group, gi) => (
        <div key={group} className="relative flex flex-col items-center w-full">
          {gi > 0 && <div className="w-5 h-px bg-gray-800 my-1" />}
          {(() => {
            const groupTools = toolsByGroup[group]
            const activeGroupTool = groupTools.find((tool) => tool.id === activeTool)
            const primaryTool = activeGroupTool ?? groupTools.find((tool) => tool.enabled) ?? groupTools[0]
            const isGroupActive = Boolean(activeGroupTool)
            const hasFlyout = groupTools.length > 1
            const meta = GROUP_META[group]

            return (
              <>
              <button
                key={group}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors mb-0.5 ${
                  isGroupActive
                    ? 'bg-violet-600 text-white'
                    : 'hover:bg-gray-800 text-gray-300 hover:text-white'
                }`}
                title={meta.label}
                onMouseEnter={(event) => {
                  if (hasFlyout) openFlyout(group, event.currentTarget)
                }}
                onClick={() => {
                  if (hasFlyout) {
                    if (openGroup === group) {
                      setOpenGroup(null)
                    } else {
                      const button = document.querySelector(`[data-drawing-group="${group}"]`) as HTMLElement | null
                      if (button) openFlyout(group, button)
                    }
                  } else if (primaryTool.enabled) {
                    onToolSelect(primaryTool.id)
                  }
                }}
                data-drawing-group={group}
              >
                {primaryTool?.icon ?? meta.fallbackIcon}
              </button>

              {openGroup === group && hasFlyout && (
                <div
                  className="fixed w-56 max-h-[min(520px,calc(100vh-1rem))] overflow-y-auto bg-[#161a25] border border-gray-700 shadow-xl p-2 z-50"
                  style={{ top: flyoutTop, left: flyoutLeft }}
                >
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 px-1 pb-1 border-b border-gray-800 mb-1">
                    {meta.label}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {groupTools.map((tool) => {
                      const isActive = activeTool === tool.id
                      const title = tool.enabled ? tool.label : `${tool.label} (multi-point coming soon)`
                      return (
                        <button
                          key={tool.id + tool.label}
                          disabled={!tool.enabled}
                          className={`h-8 rounded flex items-center gap-2 px-2 text-left text-[11px] transition-colors ${
                            isActive
                              ? 'bg-violet-600 text-white'
                              : tool.enabled
                                ? 'hover:bg-gray-800 text-gray-300 hover:text-white'
                                : 'text-gray-700 opacity-60 cursor-not-allowed'
                          }`}
                          title={title}
                          onClick={() => {
                            if (!tool.enabled) return
                            onToolSelect(tool.id)
                            setOpenGroup(null)
                          }}
                        >
                          <span className="w-4 flex items-center justify-center flex-shrink-0">{tool.icon}</span>
                          <span className="truncate">{tool.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              </>
            )
          })()}
        </div>
      ))}

      <div className="flex-1" />

      <div className="w-5 h-px bg-gray-800 my-1" />
      <button
        className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
          magnetMode
            ? 'bg-violet-600 text-white'
            : 'hover:bg-gray-800 text-gray-300 hover:text-white'
        }`}
        title={magnetMode ? 'Magnet Mode On' : 'Magnet Mode Off'}
        onClick={toggleMagnetMode}
      >
        <Magnet size={15} />
      </button>
    </div>
  )
}
