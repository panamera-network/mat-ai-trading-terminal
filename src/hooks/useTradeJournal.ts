import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOrderStore } from '@/stores/orderStore'

const STORAGE_KEY = 'mat_trade_journal_notes'

interface JournalNote {
  tags: string[]
  setup?: string
  emotion?: string
  notes?: string
}

export interface TradeJournalEntry extends JournalNote {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  price: number
  size: number
  commission: number
  timestamp: Date
  exitReason?: 'manual' | 'sl' | 'tp' | 'strategy'
}

export interface JournalFilter {
  symbol?: string
  exitReason?: 'manual' | 'sl' | 'tp' | 'strategy'
  tags?: string[]
}

export function useTradeJournal() {
  const trades = useOrderStore((s) => s.trades)
  const [notes, setNotes] = useState<Record<string, JournalNote>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const entries: TradeJournalEntry[] = useMemo(
    () =>
      trades.map((t) => ({
        ...t,
        ...(notes[t.id] ?? { tags: [] }),
      })),
    [trades, notes]
  )

  const updateEntry = useCallback((id: string, updates: Partial<JournalNote>) => {
    setNotes((prev) => {
      const existing: JournalNote = prev[id] ?? { tags: [] }
      return { ...prev, [id]: { ...existing, ...updates } }
    })
  }, [])

  const filterEntries = useCallback(
    (filter: JournalFilter) =>
      entries.filter((e) => {
        if (filter.symbol && e.symbol !== filter.symbol) return false
        if (filter.exitReason && e.exitReason !== filter.exitReason) return false
        if (filter.tags && !filter.tags.every((tag) => e.tags.includes(tag))) return false
        return true
      }),
    [entries]
  )

  const exportCSV = useCallback(() => {
    const headers = ['Date', 'Symbol', 'Side', 'Price', 'Size', 'Commission', 'Reason', 'Tags', 'Setup', 'Emotion', 'Notes']
    const rows = entries.map((e) => [
      new Date(e.timestamp).toISOString(),
      e.symbol,
      e.side,
      e.price,
      e.size,
      e.commission,
      e.exitReason ?? '',
      e.tags.join(';'),
      e.setup ?? '',
      e.emotion ?? '',
      e.notes ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trade_journal_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [entries])

  return { entries, updateEntry, filterEntries, exportCSV }
}
