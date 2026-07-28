import { useMemo, useState } from 'react'
import { X, Plus, Eye, EyeOff, Trash2, Settings, Search } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Indicator } from '@/types'
import { useLayoutStore } from '@/stores/layoutStore'
import {
  INDICATOR_CATEGORIES,
  INDICATOR_REGISTRY,
  getIndicatorDefaults,
  type IndicatorInput,
  type IndicatorRegistryItem,
} from '@/utils/indicatorRegistry'

interface IndicatorsModalProps {
  chartId: string
  onClose: () => void
}

export default function IndicatorsModal({ chartId, onClose }: IndicatorsModalProps) {
  const indicators = useLayoutStore((s) => s.layout.charts.find((c) => c.id === chartId)?.indicators ?? [])
  const addIndicator = useLayoutStore((s) => s.addIndicator)
  const removeIndicator = useLayoutStore((s) => s.removeIndicator)
  const toggleIndicator = useLayoutStore((s) => s.toggleIndicator)
  const updateIndicatorParams = useLayoutStore((s) => s.updateIndicatorParams)
  const [editingIndicator, setEditingIndicator] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filteredRegistry = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return INDICATOR_REGISTRY
    return INDICATOR_REGISTRY.filter((item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.shortName.toLowerCase().includes(normalized) ||
      item.category.toLowerCase().includes(normalized)
    )
  }, [query])

  const handleAdd = (item: IndicatorRegistryItem) => {
    const newIndicator: Indicator = {
      id: `ind-${nanoid(8)}`,
      name: item.name,
      type: item.type,
      params: { sourceId: item.id, ...getIndicatorDefaults(item) },
      visible: true,
    }
    addIndicator(chartId, newIndicator)
    setEditingIndicator(newIndicator.id)
  }

  const handleParamChange = (id: string, key: string, value: number | boolean | string) => {
    const ind = indicators.find((i) => i.id === id)
    if (!ind) return
    updateIndicatorParams(chartId, id, { ...ind.params, [key]: value })
  }

  const getRegistryItem = (indicator: Indicator) => {
    const sourceId = indicator.params.sourceId as string | undefined
    return INDICATOR_REGISTRY.find((item) => item.id === sourceId || item.name === indicator.name)
  }

  return (
    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 w-[520px] max-h-[min(680px,calc(100vh-7rem))] bg-[#161a25] border border-gray-700 rounded-lg shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <h3 className="text-white text-sm font-semibold">Indicators</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="p-3 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 bg-[#1e222d] border border-gray-700 rounded px-2">
          <Search size={14} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search selected indicators..."
            className="w-full bg-transparent text-xs text-white py-2 outline-none placeholder:text-gray-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] min-h-0 overflow-hidden">
        <div className="min-h-0 overflow-auto border-r border-gray-800">
          <div className="px-3 py-2">
            <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Add Indicator</h4>
            {INDICATOR_CATEGORIES.map((category) => {
              const items = filteredRegistry.filter((item) => item.category === category)
              if (items.length === 0) return null
              return (
                <div key={category} className="mb-3">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">{category}</div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAdd(item)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#1e222d] text-left text-xs text-gray-300 transition-colors"
                      >
                        <Plus size={13} className="text-blue-400" />
                        <span className="truncate">{item.name}</span>
                        <span className="text-[10px] text-gray-500 ml-auto">{item.type === 'volume-profile' ? 'VP' : item.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 overflow-auto">
          <div className="px-3 py-2">
            <h4 className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Active</h4>
            {indicators.length === 0 ? (
              <div className="text-gray-600 text-xs py-4 text-center">No indicators added</div>
            ) : (
              <div className="space-y-1">
                {indicators.map((ind) => {
                  const registryItem = getRegistryItem(ind)
                  return (
                    <div key={ind.id} className="rounded bg-[#1e222d]">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <button
                          onClick={() => toggleIndicator(chartId, ind.id)}
                          className={ind.visible ? 'text-blue-400' : 'text-gray-600'}
                        >
                          {ind.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>

                        <span className="text-white text-xs flex-1 truncate">
                          {registryItem?.shortName ?? ind.name}
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

                      {editingIndicator === ind.id && registryItem && (
                        <div className="px-2 pb-2 space-y-2 border-t border-gray-800">
                          {registryItem.inputs.length === 0 ? (
                            <div className="text-[11px] text-gray-600 pt-2">No settings.</div>
                          ) : (
                            registryItem.inputs.map((input) => (
                              <ParamInput
                                key={input.id}
                                input={input}
                                value={ind.params[input.id] ?? input.defaultValue}
                                onChange={(value) => handleParamChange(ind.id, input.id, value)}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ParamInput({
  input,
  value,
  onChange,
}: {
  input: IndicatorInput
  value: number | boolean | string
  onChange: (value: number | boolean | string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] text-gray-400 pt-2">
      <span>{input.label}</span>
      {input.type === 'number' && (
        <input
          type="number"
          value={Number(value)}
          min={input.min}
          step={input.step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 px-2 py-1 bg-[#161a25] border border-gray-700 rounded text-xs text-white outline-none"
        />
      )}
      {input.type === 'boolean' && (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-blue-500"
        />
      )}
      {input.type === 'select' && (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1 bg-[#161a25] border border-gray-700 rounded text-xs text-white outline-none"
        >
          {input.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      )}
      {input.type === 'color' && (
        <input
          type="color"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-6 bg-transparent border border-gray-700 rounded"
        />
      )}
    </label>
  )
}
