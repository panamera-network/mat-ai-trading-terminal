import {
  MousePointer2, Minus, MoveHorizontal, MoveVertical,
  ArrowRight, ArrowLeftRight, TrendingUp,
  Square, Circle, Type, Ruler, Magnet, Lock,
  Trash2,
} from 'lucide-react'
import { DrawingType } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'

interface ToolItem {
  id: DrawingType
  icon: React.ReactNode
  label: string
  group: string
}

const TOOLS: ToolItem[] = [
  { id: 'cursor', icon: <MousePointer2 size={16} />, label: 'Cursor', group: 'cursor' },
  { id: 'trendline', icon: <Minus size={16} />, label: 'Trend Line', group: 'lines' },
  { id: 'horizontal', icon: <MoveHorizontal size={16} />, label: 'Horizontal', group: 'lines' },
  { id: 'vertical', icon: <MoveVertical size={16} />, label: 'Vertical', group: 'lines' },
  { id: 'ray', icon: <ArrowRight size={16} />, label: 'Ray', group: 'lines' },
  { id: 'extended', icon: <ArrowLeftRight size={16} />, label: 'Extended', group: 'lines' },
  { id: 'parallel', icon: <TrendingUp size={16} />, label: 'Parallel Channel', group: 'fib' },
  { id: 'fibonacci', icon: <span className="text-[9px] font-bold">FIB</span>, label: 'Fib Retracement', group: 'fib' },
  { id: 'fibonacciExtension', icon: <span className="text-[9px] font-bold">EXT</span>, label: 'Fib Extension', group: 'fib' },
  { id: 'rectangle', icon: <Square size={16} />, label: 'Rectangle', group: 'shapes' },
  { id: 'circle', icon: <Circle size={16} />, label: 'Circle', group: 'shapes' },
  { id: 'text', icon: <Type size={16} />, label: 'Text', group: 'shapes' },
  { id: 'measure', icon: <Ruler size={16} />, label: 'Measure', group: 'tools' },
]

const GROUPS = ['cursor', 'lines', 'fib', 'shapes', 'tools']

interface LeftSidebarProps {
  chartId: string
  activeTool: string
  onToolSelect: (tool: string) => void
}

export default function LeftSidebar({ chartId, activeTool, onToolSelect }: LeftSidebarProps) {
  const drawings = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)?.drawings ?? [])
  const selectedDrawing = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)?.selectedDrawing ?? null)
  const magnetMode = useLayoutStore((s) => s.magnetMode)
  const toggleMagnetMode = useLayoutStore((s) => s.toggleMagnetMode)
  const removeDrawing = useLayoutStore((s) => s.removeDrawing)
  const toggleLockDrawing = useLayoutStore((s) => s.toggleLockDrawing)

  const selectedDrawingObj = drawings.find((d) => d.id === selectedDrawing)

  return (
    <div className="w-9 bg-[#161a25] border-r border-gray-800 flex flex-col items-center py-2 gap-0.5 flex-shrink-0">
      {GROUPS.map((group, gi) => (
        <div key={group} className="flex flex-col items-center w-full">
          {gi > 0 && <div className="w-5 h-px bg-gray-800 my-1" />}
          {TOOLS.filter((t) => t.group === group).map((tool) => (
            <button
              key={tool.id + tool.label}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors mb-0.5 ${
                activeTool === tool.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
              title={tool.label}
              onClick={() => onToolSelect(tool.id)}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      ))}

      <div className="w-5 h-px bg-gray-800 my-1" />

      <button
        className={`w-7 h-7 rounded flex items-center justify-center transition-colors mb-0.5 ${
          magnetMode ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
        }`}
        title={`Magnet Mode ${magnetMode ? '(ON)' : '(OFF)'}`}
        onClick={toggleMagnetMode}
      >
        <Magnet size={16} />
      </button>

      <button
        className={`w-7 h-7 rounded flex items-center justify-center transition-colors mb-0.5 ${
          selectedDrawingObj?.locked
            ? 'bg-blue-600 text-white'
            : selectedDrawing
              ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
              : 'text-gray-700 cursor-not-allowed'
        }`}
        title={selectedDrawingObj?.locked ? 'Unlock Drawing' : selectedDrawing ? 'Lock Drawing' : 'Select a drawing to lock'}
        onClick={() => selectedDrawing && toggleLockDrawing(chartId, selectedDrawing)}
        disabled={!selectedDrawing}
      >
        <Lock size={16} />
      </button>

      <div className="flex-1" />

      <div className="w-5 h-px bg-gray-800 my-1" />

      <button
        className={`w-7 h-7 rounded flex items-center justify-center transition-colors mb-1 ${
          selectedDrawing ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-700 cursor-not-allowed'
        }`}
        title={selectedDrawing ? 'Delete Selected' : 'Select a drawing to delete'}
        onClick={() => selectedDrawing && removeDrawing(chartId, selectedDrawing)}
        disabled={!selectedDrawing}
      >
        <Trash2 size={14} />
      </button>

      {drawings.length > 0 && <span className="text-[9px] text-gray-500">{drawings.length}</span>}
    </div>
  )
}
