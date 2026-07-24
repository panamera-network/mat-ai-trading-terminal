import { useLayoutStore } from '@/stores/layoutStore'
import { useCallback } from 'react'

const LAYOUTS = [
  { type: '1x1' as const, label: '1×1', icon: '□' },
  { type: '1x2' as const, label: '1×2', icon: '□□' },
  { type: '1x3' as const, label: '1×3', icon: '□□□' },
  { type: '2x2' as const, label: '2×2', icon: '田' },
  { type: '2x3' as const, label: '2×3', icon: '▦' },
]

export default function LayoutSelector() {
  const { layout, setLayoutType, addChart, toggleSyncCrosshair, toggleSyncSymbol, toggleSyncTimeframe } = useLayoutStore()

  const handleAddChart = useCallback(() => {
    addChart()
  }, [addChart])

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-[#161a25] border-b border-gray-800">
      <span className="text-gray-400 text-xs font-medium">Layout:</span>

      {LAYOUTS.map((l) => (
        <button
          key={l.type}
          onClick={() => setLayoutType(l.type)}
          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
            layout.type === l.type
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-[#1e222d] border-gray-700 text-gray-400 hover:text-white'
          }`}
          title={l.label}
        >
          {l.icon}
        </button>
      ))}

      <div className="w-px h-4 bg-gray-700 mx-1" />

      <button
        onClick={handleAddChart}
        className="px-2 py-0.5 text-xs rounded bg-[#1e222d] border border-gray-700 text-gray-400 hover:text-white transition-colors"
        title="Add chart"
      >
        + Chart
      </button>

      <div className="w-px h-4 bg-gray-700 mx-1" />

      {/* Sync toggles */}
      <button
        onClick={toggleSyncCrosshair}
        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
          layout.syncCrosshair
            ? 'bg-green-900/50 border-green-700 text-green-400'
            : 'bg-[#1e222d] border-gray-700 text-gray-500'
        }`}
        title="Sync crosshair"
      >
        Crosshair
      </button>
      <button
        onClick={toggleSyncSymbol}
        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
          layout.syncSymbol
            ? 'bg-green-900/50 border-green-700 text-green-400'
            : 'bg-[#1e222d] border-gray-700 text-gray-500'
        }`}
        title="Sync symbol"
      >
        Symbol
      </button>
      <button
        onClick={toggleSyncTimeframe}
        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
          layout.syncTimeframe
            ? 'bg-green-900/50 border-green-700 text-green-400'
            : 'bg-[#1e222d] border-gray-700 text-gray-500'
        }`}
        title="Sync timeframe"
      >
        TF
      </button>
    </div>
  )
}
