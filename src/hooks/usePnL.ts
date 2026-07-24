import { useMemo } from 'react'
import { Position, Trade } from '@/types/order'

export function usePnL(positions: Position[], trades: Trade[]) {
  const summary = useMemo(() => {
    const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0)
    const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0)
    const closedTrades = trades.filter((t) => t.exitReason)

    // Equity curve from realized-PnL-bearing positions is not reconstructable
    // from the current Trade shape (no per-trade profit field), so this
    // dashboard only reports what's directly measurable: open unrealized P&L
    // and trade/commission counts. See CLAUDE.md "Known gaps".
    return {
      totalUnrealized,
      totalCommission,
      openCount: positions.length,
      closedCount: closedTrades.length,
      slHits: closedTrades.filter((t) => t.exitReason === 'sl').length,
      tpHits: closedTrades.filter((t) => t.exitReason === 'tp').length,
    }
  }, [positions, trades])

  const marginLevel = useMemo(() => {
    // No live margin/equity feed yet — placeholder until account state exists.
    return 100
  }, [])

  return { summary, marginLevel }
}
