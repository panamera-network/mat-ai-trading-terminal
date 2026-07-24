import { useState } from 'react'
import { Drawing } from '@/types'
import { useDrawingTemplates } from '@/hooks/useDrawingTemplates'

interface DrawingTemplateManagerProps {
  symbol: string
  timeframe: string
  currentDrawings: Drawing[]
  onApplyDrawings: (drawings: Drawing[]) => void
}

export default function DrawingTemplateManager({ symbol, timeframe, currentDrawings, onApplyDrawings }: DrawingTemplateManagerProps) {
  const { saveTemplate, deleteTemplate, getTemplatesForSymbol } = useDrawingTemplates()
  const [newName, setNewName] = useState('')
  const [showSave, setShowSave] = useState(false)

  const templates = getTemplatesForSymbol(symbol)

  return (
    <div className="w-[280px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-800">
        <h3 className="text-white text-sm font-semibold">Drawing Templates</h3>
        <span className="text-gray-500 text-[10px]">{symbol}</span>
      </div>

      <div className="px-3 py-2 border-b border-gray-800 space-y-2">
        {!showSave ? (
          <button
            onClick={() => setShowSave(true)}
            disabled={currentDrawings.length === 0}
            className="w-full py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50"
          >
            Save current drawings ({currentDrawings.length})
          </button>
        ) : (
          <div className="space-y-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name..."
              className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none"
            />
            <div className="flex gap-1">
              <button
                onClick={() => setShowSave(false)}
                className="flex-1 py-1 text-[10px] rounded border border-gray-700 text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newName) return
                  saveTemplate(newName, symbol, timeframe, currentDrawings)
                  setNewName('')
                  setShowSave(false)
                }}
                className="flex-1 py-1 text-[10px] rounded bg-blue-600 text-white"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-3 py-2">
        <span className="text-gray-500 text-[10px] uppercase">Saved ({templates.length})</span>
        {templates.length === 0 && <div className="text-gray-600 text-[10px] mt-1">No templates for {symbol} yet</div>}
        <div className="space-y-1 mt-1">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1.5 text-xs">
              <div>
                <div className="text-white">{t.name}</div>
                <div className="text-gray-500 text-[10px]">{t.timeframe} · {t.drawings.length} objects</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onApplyDrawings(t.drawings)} className="text-blue-400 hover:text-blue-300 text-[10px]">Apply</button>
                <button onClick={() => deleteTemplate(t.id)} className="text-gray-500 hover:text-red-400 text-[10px]">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
