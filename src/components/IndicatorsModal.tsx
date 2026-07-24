import { useState } from 'react'
import { X, Plus, Eye, EyeOff, Trash2, Settings } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Indicator } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'

interface IndicatorsModalProps {
  chartId: string
  onClose: () => void
}

const PRESET_INDICATORS: { name: string; type: Indicator['type']; defaultParams: Record<string, number | string> }[] = [
  { name: 'SMA', type: 'overlay', defaultParams: { period: 20, color: '#2962FF', width: 2 } },
  { name: 'SMA', type: 'overlay', defaultParams: { period: 50, color: '#fb8c00', width: 2 } },
  { name: 'SMA', type: 'overlay', defaultParams: { period: 200, color: '#ef5350', width: 2 } },
  { name: 'EMA', type: 'overlay', defaultParams: { period: 12, color: '#ab47bc', width: 2 } },
  { name: 'EMA', type: 'overlay', defaultParams: { period: 26, color: '#26a69a', width: 2 } },
  { name: 'Bollinger Bands', type: 'overlay', defaultParams: { period: 20, multiplier: 2 } },
  { name: 'VWAP', type: 'overlay', defaultParams: { color: '#fdd835', width: 2 } },
  { name: 'Volume Profile', type: 'volume-profile', defaultParams: { bins: 50 } },
  { name: 'RSI', type: 'panel', defaultParams: { period: 14, color: '#2962FF' } },
  { name: 'MACD', type: 'panel', defaultParams: { fast: 12, slow: 26, signal: 9 } },
]

export default function IndicatorsModal({ chartId, onClose }: IndicatorsModalProps) {
  const indicators = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)?.indicators ?? [])
  const addIndicator = useLayoutStore((s) => s.addIndicator)
  const removeIndicator = useLayoutStore((s) => s.removeIndicator)
  const toggleIndicator = useLayoutStore((s) => s.toggleIndicator)
  const updateIndicatorParams = useLayoutStore((s) => s.updateIndicatorParams)
  const [editingIndicator, setEditingIndicator] = useState<string | null>(null)

  const handleAdd = (preset: typeof PRESET_INDICATORS[0]) => {
    const newIndicator: Indicator = {
      id: `ind-${nanoid(8)}`,
      name: preset.name,
      type: preset.type,
      params: { ...preset.defaultParams },
      visible: true,
    }
    addIndicator(chartId, newIndicator)
  }

  const handleParamChange = (id: string, key: string, value: number | string) => {
    const ind = indicators.find((i) => i.id === id)
    if (!ind) return
    updateIndicatorParams(chartId, id, { ...ind.params, [key]: value })
  }

  return (
    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 w-[420px] bg-[#161a25] border border-gray-700 rounded-lg shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-white text-sm font-semibold">Indicators</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-2">
        <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Active</h4>
        {indicators.length === 0 ? (
          <div className="text-gray-600 text-xs py-4 text-center">No indicators added</div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {indicators.map((ind) => (
              <div key={ind.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#1e222d]">
                <button
                  onClick={() => toggleIndicator(chartId, ind.id)}
                  className={ind.visible ? 'text-blue-400' : 'text-gray-600'}
                >
                  {ind.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                <span className="text-white text-xs flex-1">
                  {ind.name} {ind.params.period ? `(${ind.params.period})` : ''}
                </span>

                <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-gray-800 rounded">
                  {ind.type === 'volume-profile' ? 'VP' : ind.type}
                </span>

                <button
                  onClick={() => setEditingIndicator(editingIndicator === ind.id ? null : ind.id)}
                  className="text-gray-400 hover:text-white"
                >
                  <Settings size={14} />
                </button>

                <button
                  onClick={() => removeIndicator(chartId, ind.id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingIndicator && (() => {
        const ind = indicators.find((i) => i.id === editingIndicator)
        if (!ind) return null
        return (
          <div className="px-4 py-2 border-t border-gray-800 bg-black/20 space-y-2">
            <h4 className="text-gray-500 text-[10px] uppercase">Edit {ind.name}</h4>
            {Object.entries(ind.params).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="text-gray-400 text-xs w-20 capitalize">{key}</label>
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  value={String(value)}
                  onChange={(e) => handleParamChange(ind.id, key, typeof value === 'number' ? Number(e.target.value) : e.target.value)}
                  className="flex-1 px-2 py-1 bg-[#1e222d] border border-gray-700 rounded text-xs text-white outline-none"
                />
              </div>
            ))}
          </div>
        )
      })()}

      <div className="px-4 py-2 border-t border-gray-800">
        <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Add Indicator</h4>
        <div className="grid grid-cols-2 gap-1">
          {PRESET_INDICATORS.map((preset, i) => (
            <button
              key={`${preset.name}-${i}`}
              onClick={() => handleAdd(preset)}
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-[#1e222d] text-left text-xs text-gray-300 transition-colors"
            >
              <Plus size={14} className="text-blue-400" />
              <span>{preset.name} {preset.defaultParams.period ? `(${preset.defaultParams.period})` : ''}</span>
              <span className="text-[10px] text-gray-500 ml-auto">
                {preset.type === 'volume-profile' ? 'VP' : preset.type}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
