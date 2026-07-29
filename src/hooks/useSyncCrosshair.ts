import { useEffect } from 'react'
import { TradingChartController } from '@/core/chart/TradingChartController'
import {
  TradingChartSyncEngine,
  TradingChartSyncMember,
} from '@/core/sync/TradingChartSyncEngine'

export function useSyncCrosshair(
  syncEngine: TradingChartSyncEngine | null,
  member: Omit<TradingChartSyncMember, 'controller'> & { controller: TradingChartController | null }
) {
  useEffect(() => {
    if (!syncEngine || !member.controller) return
    return syncEngine.registerMember({
      ...member,
      controller: member.controller,
    })
  }, [syncEngine, member.chartId, member.controller])
}
