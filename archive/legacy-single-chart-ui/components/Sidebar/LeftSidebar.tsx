import { 
  MousePointer2, Minus, MoveHorizontal, MoveVertical, 
  ArrowRight, ArrowLeftRight, TrendingUp, 
  Square, Circle, Type, Ruler, Magnet, Lock,
  Trash2
} from 'lucide-react'
import { DrawingType } from '@/types'
import { useChartStore } from '@/stores/chartStore'

interface ToolItem {
  id: DrawingType
  icon: React.ReactNode
  label: string
  group: string
}

const TOOLS: ToolItem[] = [
  { id: 'cursor', icon: <MousePointer2 size={18} />, label: 'Cursor', group: 'cursor' },
  { id: 'trendline', icon: <Minus size={18} />, label: 'Trend Line', group: 'lines' },
  { id: 'horizontal', icon: <MoveHorizontal size={18} />, label: 'Horizontal', group: 'lines' },
  { id: 'vertical', icon: <MoveVertical size={18} />, label: 'Vertical', group: 'lines' },
  { id: 'ray', icon: <ArrowRight size={18} />, label: 'Ray', group: 'lines' },
  { id: 'extended', icon: <ArrowLeftRight size={18} />, label: 'Extended', group: 'lines' },
  { id: 'parallel', icon: <TrendingUp size={18} />, label: 'Parallel Channel', group: 'fib' },
  { id: 'fibonacci', icon: <span className="text-xs font-bold">FIB</span>, label: 'Fib Retracement', group: 'fib' },
  { id: 'fibonacciExtension', icon: <span className="text-xs font-bold">EXT</span>, label: 'Fib Extension', group: 'fib' },
  { id: 'rectangle', icon: <Square size={18} />, label: 'Rectangle', group: 'shapes' },
  { id: 'circle', icon: <Circle size={18} />, label: 'Circle', group: 'shapes' },
  { id: 'text', icon: <Type size={18} />, label: 'Text', group: 'shapes' },
  { id: 'measure', icon: <Ruler size={18} />, label: 'Measure', group: 'tools' },
]

interface LeftSidebarProps {
  activeTool: string
  onToolSelect: (tool: string) => void
}

export default function LeftSidebar({ activeTool, onToolSelect }: LeftSidebarProps) {
  const { 
    drawings, removeDrawing, selectedDrawing, 
    settings, toggleMagnet, toggleLockDrawing 
  } = useChartStore()

  const groups = ['cursor', 'lines', 'fib', 'shapes', 'tools']
  const groupLabels: Record<string, string> = {
    cursor: '',
    lines: 'Lines',
    fib: 'Fibonacci',
    shapes: 'Shapes',
    tools: 'Tools'
  }

  const handleDelete = () => {
    if (selectedDrawing) {
      removeDrawing(selectedDrawing)
    }
  }

  const selectedDrawingObj = drawings.find(d => d.id === selectedDrawing)

  return (
    <div className="w-10 bg-chart-panel border-r border-chart-border flex flex-col items-center py-2 gap-0.5">
      {groups.map((group, gi) => (
        <div key={group} className="flex flex-col items-center w-full">
          {gi > 0 && <div className="w-6 h-px bg-chart-border my-1" />}
          {groupLabels[group] && (
            <span className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">{groupLabels[group]}</span>
          )}
          {TOOLS.filter(t => t.group === group).map(tool => (
            <button
              key={tool.id + tool.label}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors mb-0.5 ${
                activeTool === tool.id 
                  ? 'bg-blue-600 text-white' 
                  : 'hover:bg-chart-border text-gray-400 hover:text-gray-200'
              }`}
              title={tool.label}
              onClick={() => onToolSelect(tool.id)}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      ))}

      <div className="w-6 h-px bg-chart-border my-1" />

      {/* Magnet Mode */}
      <button
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors mb-0.5 ${
          settings.magnetMode 
            ? 'bg-blue-600 text-white' 
            : 'hover:bg-chart-border text-gray-400 hover:text-gray-200'
        }`}
        title={`Magnet Mode ${settings.magnetMode ? '(ON)' : '(OFF)'}`}
        onClick={toggleMagnet}
      >
        <Magnet size={18} />
      </button>

      {/* Lock Selected Drawing */}
      <button
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors mb-0.5 ${
          selectedDrawingObj?.locked 
            ? 'bg-blue-600 text-white' 
            : selectedDrawing 
              ? 'hover:bg-chart-border text-gray-400 hover:text-gray-200' 
              : 'text-gray-600 cursor-not-allowed'
        }`}
        title={selectedDrawingObj?.locked ? 'Unlock Drawing' : selectedDrawing ? 'Lock Drawing' : 'Select a drawing to lock'}
        onClick={() => selectedDrawing && toggleLockDrawing(selectedDrawing)}
        disabled={!selectedDrawing}
      >
        <Lock size={18} />
      </button>

      <div className="flex-1" />

      <div className="w-6 h-px bg-chart-border my-1" />

      {/* Delete selected drawing */}
      <button 
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors mb-1 ${
          selectedDrawing 
            ? 'text-red-400 hover:bg-red-900/30' 
            : 'text-gray-600 cursor-not-allowed'
        }`}
        title={selectedDrawing ? 'Delete Selected' : 'Select a drawing to delete'}
        onClick={handleDelete}
        disabled={!selectedDrawing}
      >
        <Trash2 size={16} />
      </button>

      {/* Drawing count badge */}
      {drawings.length > 0 && (
        <span className="text-[9px] text-gray-500">{drawings.length}</span>
      )}
    </div>
  )
}