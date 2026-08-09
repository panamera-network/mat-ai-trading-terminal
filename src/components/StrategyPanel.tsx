import { useState } from 'react'
import { useStrategyStore, PRESET_STRATEGIES } from '@/stores/strategyStore'
import { ALL_SYMBOLS } from '@/types/market'

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D']

export default function StrategyPanel() {
  const { scripts, activeScriptId, logs, createScript, updateScript, deleteScript, setActiveScript, toggleScript, clearLogs } = useStrategyStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editSymbol, setEditSymbol] = useState('XAUUSD')
  const [editTimeframe, setEditTimeframe] = useState('1H')
  const [showPresets, setShowPresets] = useState(false)

  const handleCreate = () => {
    const id = createScript(editName || 'New Strategy', editCode, editSymbol, editTimeframe)
    setActiveScript(id)
    setIsEditing(false)
    setEditName('')
    setEditCode('')
  }

  const handleUpdate = () => {
    if (!activeScriptId) return
    updateScript(activeScriptId, {
      name: editName,
      code: editCode,
      symbol: editSymbol,
      timeframe: editTimeframe,
    })
    setIsEditing(false)
  }

  const loadPreset = (name: string, code: string) => {
    setEditName(name)
    setEditCode(code)
    setShowPresets(false)
  }

  const selectedScript = scripts.find((s) => s.id === activeScriptId)

  return (
    <div className="w-[320px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-white text-sm font-semibold">Strategy Runner</h3>
        <button
          onClick={() => {
            setIsEditing(true)
            setEditName('')
            setEditCode('')
            setActiveScript(null)
          }}
          className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
        >
          + New
        </button>
      </div>

      {/* Script list */}
      <div className="px-3 py-2 border-b border-gray-800 max-h-[120px] overflow-auto">
        {scripts.length === 0 && (
          <span className="text-gray-600 text-xs">No strategies. Create one to start.</span>
        )}
        <div className="space-y-1">
          {scripts.map((script) => (
            <div
              key={script.id}
              onClick={() => setActiveScript(script.id)}
              className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${
                activeScriptId === script.id ? 'bg-blue-900/30 border border-blue-800' : 'bg-[#1e222d] border border-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleScript(script.id)
                  }}
                  className={`w-2 h-2 rounded-full ${script.isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                />
                <span className="text-white">{script.name}</span>
                <span className="text-gray-500 text-[10px]">{script.symbol} {script.timeframe}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteScript(script.id)
                }}
                className="text-gray-500 hover:text-red-400 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="px-3 py-2 border-b border-gray-800 space-y-2">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Strategy name"
            className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none"
          />
          <div className="flex gap-2">
            <select
              value={editSymbol}
              onChange={(e) => setEditSymbol(e.target.value)}
              className="flex-1 bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none"
            >
              {ALL_SYMBOLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={editTimeframe}
              onChange={(e) => setEditTimeframe(e.target.value)}
              className="flex-1 bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none"
            >
              {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </div>

          {/* Presets */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Load Preset ▼
            </button>
            {showPresets && (
              <div className="absolute z-10 bg-[#1e222d] border border-gray-700 rounded mt-1 w-full">
                {Object.entries(PRESET_STRATEGIES).map(([name, code]) => (
                  <button
                    key={name}
                    onClick={() => loadPreset(name, code)}
                    className="block w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            placeholder="// Write your strategy here..."
            className="w-full h-[150px] bg-[#0d1117] text-green-400 text-xs px-2 py-1.5 rounded border border-gray-700 outline-none font-mono resize-none"
            spellCheck={false}
          />

          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={activeScriptId ? handleUpdate : handleCreate}
              className="flex-1 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              {activeScriptId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Selected script view */}
      {selectedScript && !isEditing && (
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white text-xs font-medium">{selectedScript.name}</span>
            <button
              onClick={() => {
                setEditName(selectedScript.name)
                setEditCode(selectedScript.code)
                setEditSymbol(selectedScript.symbol)
                setEditTimeframe(selectedScript.timeframe)
                setIsEditing(true)
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              Edit
            </button>
          </div>
          <pre className="text-[10px] text-gray-400 bg-[#0d1117] rounded p-2 overflow-auto max-h-[100px] font-mono">
            {selectedScript.code.slice(0, 200)}{selectedScript.code.length > 200 ? '...' : ''}
          </pre>
        </div>
      )}

      {/* Logs */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-1 border-b border-gray-800 flex items-center justify-between">
          <span className="text-gray-500 text-[10px] uppercase">Logs</span>
          <button onClick={clearLogs} className="text-[10px] text-gray-500 hover:text-gray-300">Clear</button>
        </div>
        <div className="flex-1 overflow-auto px-3 py-1 space-y-0.5">
          {logs.length === 0 && <span className="text-gray-600 text-[10px]">No logs yet</span>}
          {logs.slice(-50).map((log, i) => (
            <div key={i} className="text-[10px] text-gray-400 font-mono">{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
