import { useState } from 'react'
import { useTradeJournal, TradeJournalEntry } from '@/hooks/useTradeJournal'

const SETUPS = ['breakout', 'pullback', 'trend_follow', 'reversal', 'range']
const EMOTIONS = ['confident', 'fearful', 'greedy', 'patient', 'revenge']

export default function TradeJournal() {
  const { entries, updateEntry, filterEntries, exportCSV } = useTradeJournal()
  const [reasonFilter, setReasonFilter] = useState('')
  const [selected, setSelected] = useState<TradeJournalEntry | null>(null)
  const [tagInput, setTagInput] = useState('')

  const filtered = filterEntries(reasonFilter ? { exitReason: reasonFilter as any } : {})

  return (
    <div className="w-[300px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-white text-sm font-semibold">Trade Journal</h3>
        <button onClick={exportCSV} className="text-[10px] text-blue-400 hover:text-blue-300">Export CSV</button>
      </div>

      <div className="px-3 py-2 border-b border-gray-800">
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none"
        >
          <option value="">All trades</option>
          <option value="tp">Take profit</option>
          <option value="sl">Stop loss</option>
          <option value="manual">Manual close</option>
          <option value="strategy">Strategy</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-1">
        {filtered.length === 0 && <span className="text-gray-600 text-[10px]">No trades yet</span>}
        {filtered.map((entry) => (
          <div
            key={entry.id}
            onClick={() => setSelected(entry)}
            className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1 text-xs cursor-pointer hover:bg-[#252a38]"
          >
            <span className="text-gray-500">{new Date(entry.timestamp).toLocaleDateString()}</span>
            <span className="text-white">{entry.symbol}</span>
            <span className={entry.side === 'buy' ? 'text-green-400' : 'text-red-400'}>{entry.side.toUpperCase()}</span>
            <span className="text-gray-400">{entry.price.toFixed(2)}</span>
            {entry.tags.length > 0 && <span className="text-blue-400 text-[10px]">{entry.tags.length} tags</span>}
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="bg-[#161a25] border border-gray-700 rounded-lg shadow-xl w-[300px] p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-white text-sm font-semibold">{selected.symbol} — {selected.side.toUpperCase()}</h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="text-white">{selected.price}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-white">{selected.size}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Commission</span><span className="text-white">${selected.commission.toFixed(2)}</span></div>
              {selected.exitReason && <div className="flex justify-between"><span className="text-gray-500">Reason</span><span className="text-white">{selected.exitReason}</span></div>}
            </div>

            <div className="flex flex-wrap gap-1">
              {selected.tags.map((tag) => (
                <span key={tag} className="text-[10px] bg-blue-900/50 text-blue-300 rounded px-1.5 py-0.5">
                  {tag}
                  <button
                    className="ml-1 text-blue-400 hover:text-white"
                    onClick={() => {
                      const tags = selected.tags.filter((t) => t !== tag)
                      updateEntry(selected.id, { tags })
                      setSelected({ ...selected, tags })
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput) {
                  const tags = [...selected.tags, tagInput]
                  updateEntry(selected.id, { tags })
                  setSelected({ ...selected, tags })
                  setTagInput('')
                }
              }}
              placeholder="Add tag, press Enter"
              className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none"
            />

            <select
              value={selected.setup ?? ''}
              onChange={(e) => { updateEntry(selected.id, { setup: e.target.value }); setSelected({ ...selected, setup: e.target.value }) }}
              className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none"
            >
              <option value="">Select setup</option>
              {SETUPS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={selected.emotion ?? ''}
              onChange={(e) => { updateEntry(selected.id, { emotion: e.target.value }); setSelected({ ...selected, emotion: e.target.value }) }}
              className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none"
            >
              <option value="">Select emotion</option>
              {EMOTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>

            <textarea
              value={selected.notes ?? ''}
              onChange={(e) => { updateEntry(selected.id, { notes: e.target.value }); setSelected({ ...selected, notes: e.target.value }) }}
              placeholder="Notes..."
              className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none h-16 resize-none"
            />

            <button onClick={() => setSelected(null)} className="w-full py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-white">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
