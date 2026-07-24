import { useState } from 'react'
import { X, Plus, Eye, EyeOff, Trash2, Settings } from 'lucide-react'
import { Indicator } from '@/types'
import { useChartStore } from '@/stores/chartStore'

interface IndicatorsModalProps {
  isOpen: boolean
  onClose: () => void
}

const PRESET_INDICATORS = [
  { name: 'SMA', type: 'overlay' as const, defaultParams: { period: 20, color: '#2962FF', width: 2 } },
  { name: 'SMA', type: 'overlay' as const, defaultParams: { period: 50, color: '#fb8c00', width: 2 } },
  { name: 'SMA', type: 'overlay' as const, defaultParams: { period: 200, color: '#ef5350', width: 2 } },
  { name: 'EMA', type: 'overlay' as const, defaultParams: { period: 12, color: '#ab47bc', width: 2 } },
  { name: 'EMA', type: 'overlay' as const, defaultParams: { period: 26, color: '#26a69a', width: 2 } },
  { name: 'Bollinger Bands', type: 'overlay' as const, defaultParams: { period: 20, multiplier: 2 } },
  { name: 'VWAP', type: 'overlay' as const, defaultParams: { color: '#fdd835', width: 2 } },
  { name: 'Volume Profile', type: 'volume-profile' as const, defaultParams: { bins: 50 } },
  { name: 'RSI', type: 'panel' as const, defaultParams: { period: 14, color: '#2962FF' } },
  { name: 'MACD', type: 'panel' as const, defaultParams: { fast: 12, slow: 26, signal: 9 } },
]

export default function IndicatorsModal({ isOpen, onClose }: IndicatorsModalProps) {
  const { indicators, addIndicator, removeIndicator, toggleIndicator } = useChartStore()
  const [editingIndicator, setEditingIndicator] = useState<string | null>(null)

  if (!isOpen) return null

  const handleAdd = (preset: typeof PRESET_INDICATORS[0]) => {
    const newIndicator: Indicator = {
      id: `ind-${Date.now()}`,
      name: preset.name,
      type: preset.type,
      params: { ...preset.defaultParams },
      visible: true,
    }
    addIndicator(newIndicator)
  }

  const handleParamChange = (id: string, key: string, value: number | string) => {
    const { updateIndicator } = useChartStore.getState()
    const ind = indicators.find(i => i.id === id)
    if (!ind) return
    updateIndicator(id, { params: { ...ind.params, [key]: value } })
  }

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-[500px] bg-chart-panel border border-chart-border rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-chart-border">
        <h3 className="text-sm font-medium">Indicators</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Active Indicators */}
      <div className="px-4 py-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Active</h4>
        {indicators.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">No indicators added</div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {indicators.map(ind => (
              <div key={ind.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-chart-border">
                <button
                  onClick={() => toggleIndicator(ind.id)}
                  className={`${ind.visible ? 'text-blue-400' : 'text-gray-600'}`}
                >
                  {ind.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                <span className="text-sm flex-1">
                  {ind.name} {ind.params.period ? `(${ind.params.period})` : ''}
                </span>

                <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-chart-bg rounded">
                  {ind.type === 'volume-profile' ? 'VP' : ind.type}
                </span>

                <button
                  onClick={() => setEditingIndicator(editingIndicator === ind.id ? null : ind.id)}
                  className="text-gray-400 hover:text-white"
                >
                  <Settings size={14} />
                </button>

                <button
                  onClick={() => removeIndicator(ind.id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Params */}
      {editingIndicator && (
        <div className="px-4 py-2 border-t border-chart-border bg-chart-bg/50">
          {(() => {
            const ind = indicators.find(i => i.id === editingIndicator)
            if (!ind) return null
            return (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-500">Edit {ind.name}</h4>
                {Object.entries(ind.params).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 w-20 capitalize">{key}</label>
                    <input
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) => handleParamChange(ind.id, key, 
                        typeof value === 'number' ? Number(e.target.value) : e.target.value
                      )}
                      className="flex-1 px-2 py-1 bg-chart-bg border border-chart-border rounded text-xs"
                    />
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Add New */}
      <div className="px-4 py-2 border-t border-chart-border">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Add Indicator</h4>
        <div className="grid grid-cols-2 gap-1">
          {PRESET_INDICATORS.map((preset, i) => (
            <button
              key={`${preset.name}-${i}`}
              onClick={() => handleAdd(preset)}
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-chart-border text-left text-sm transition-colors"
            >
              <Plus size={14} className="text-blue-400" />
              <span>{preset.name} {preset.defaultParams.period ? `(${preset.defaultParams.period})` : ''}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {preset.type === 'volume-profile' ? 'VP' : preset.type}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}