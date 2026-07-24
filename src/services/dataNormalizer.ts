import { CandleData } from '@/types'

// Unified data format regardless of source
export function normalizeBinanceKline(msg: any): CandleData {
  const k = msg.k
  return {
    time: Math.floor(k.t / 1000),
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v),
  }
}

export function normalizeBinanceDepth(msg: any) {
  return {
    bids: msg.bids.map(([p, s]: [string, string]) => ({
      price: parseFloat(p),
      size: parseFloat(s),
    })),
    asks: msg.asks.map(([p, s]: [string, string]) => ({
      price: parseFloat(p),
      size: parseFloat(s),
    })),
  }
}

// MT5 data is already normalized by the feed itself
export function normalizeMt5Tick(tick: any): CandleData {
  return tick as CandleData
}
