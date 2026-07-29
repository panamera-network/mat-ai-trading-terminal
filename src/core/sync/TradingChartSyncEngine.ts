import { LogicalRange } from 'lightweight-charts'
import {
  TradingChartController,
  TradingChartCrosshairPosition,
} from '@/core/chart/TradingChartController'
import { Symbol, Timeframe } from '@/types'

export interface TradingChartSyncOptions {
  syncCrosshair: boolean
  syncVisibleRange?: boolean
  syncSymbol?: boolean
  syncTimeframe?: boolean
}

export interface TradingChartSyncMember {
  chartId: string
  controller: TradingChartController
  getSymbol: () => Symbol
  getTimeframe: () => Timeframe
  setSymbol?: (symbol: Symbol) => void
  setTimeframe?: (timeframe: Timeframe) => void
}

interface RegisteredSyncMember extends TradingChartSyncMember {
  unsubscribeCrosshair: () => void
  unsubscribeVisibleRange: () => void
  applyingCrosshair: boolean
  applyingVisibleRange: boolean
}

export class TradingChartSyncEngine {
  private members = new Map<string, RegisteredSyncMember>()
  private options: TradingChartSyncOptions
  private lastCrosshair: TradingChartCrosshairPosition | null = null
  private lastVisibleRange: LogicalRange | null = null

  constructor(options: TradingChartSyncOptions) {
    this.options = options
  }

  registerMember(member: TradingChartSyncMember): () => void {
    this.unregisterMember(member.chartId)

    const registered: RegisteredSyncMember = {
      ...member,
      unsubscribeCrosshair: () => undefined,
      unsubscribeVisibleRange: () => undefined,
      applyingCrosshair: false,
      applyingVisibleRange: false,
    }

    registered.unsubscribeCrosshair = member.controller.subscribeCrosshairMove((position) => {
      this.handleCrosshairMove(member.chartId, position)
    })

    registered.unsubscribeVisibleRange = member.controller.subscribeVisibleLogicalRangeChange((range) => {
      this.handleVisibleRangeChange(member.chartId, range)
    })

    this.members.set(member.chartId, registered)
    this.applyCurrentStateToMember(registered)

    return () => this.unregisterMember(member.chartId)
  }

  updateMember(chartId: string, patch: Partial<Omit<TradingChartSyncMember, 'chartId' | 'controller'>>) {
    const member = this.members.get(chartId)
    if (!member) return
    Object.assign(member, patch)
  }

  setGroupOptions(options: TradingChartSyncOptions) {
    const wasCrosshairEnabled = this.options.syncCrosshair
    this.options = options

    if (wasCrosshairEnabled && !options.syncCrosshair) {
      this.lastCrosshair = null
      this.members.forEach((member) => member.controller.clearExternalCrosshair())
    }
  }

  destroy() {
    Array.from(this.members.keys()).forEach((chartId) => this.unregisterMember(chartId))
    this.lastCrosshair = null
    this.lastVisibleRange = null
  }

  private unregisterMember(chartId: string) {
    const member = this.members.get(chartId)
    if (!member) return
    member.unsubscribeCrosshair()
    member.unsubscribeVisibleRange()
    member.controller.clearExternalCrosshair()
    this.members.delete(chartId)
  }

  private handleCrosshairMove(sourceChartId: string, position: TradingChartCrosshairPosition | null) {
    const source = this.members.get(sourceChartId)
    if (!source || source.applyingCrosshair || !this.options.syncCrosshair) return

    this.lastCrosshair = position
    this.members.forEach((target, targetChartId) => {
      if (targetChartId === sourceChartId) return
      target.applyingCrosshair = true
      try {
        if (position) target.controller.setExternalCrosshair(position)
        else target.controller.clearExternalCrosshair()
      } finally {
        target.applyingCrosshair = false
      }
    })
  }

  private handleVisibleRangeChange(sourceChartId: string, range: LogicalRange | null) {
    const source = this.members.get(sourceChartId)
    if (!source || source.applyingVisibleRange || !this.options.syncVisibleRange) return

    this.lastVisibleRange = range
    if (!range) return

    this.members.forEach((target, targetChartId) => {
      if (targetChartId === sourceChartId) return
      target.applyingVisibleRange = true
      try {
        target.controller.setVisibleLogicalRange(range)
      } finally {
        target.applyingVisibleRange = false
      }
    })
  }

  private applyCurrentStateToMember(member: RegisteredSyncMember) {
    if (this.options.syncCrosshair && this.lastCrosshair) {
      member.applyingCrosshair = true
      try {
        member.controller.setExternalCrosshair(this.lastCrosshair)
      } finally {
        member.applyingCrosshair = false
      }
    }

    if (this.options.syncVisibleRange && this.lastVisibleRange) {
      member.applyingVisibleRange = true
      try {
        member.controller.setVisibleLogicalRange(this.lastVisibleRange)
      } finally {
        member.applyingVisibleRange = false
      }
    }
  }
}
