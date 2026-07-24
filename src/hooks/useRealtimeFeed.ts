import { useEffect, useRef, useCallback } from 'react'
import { CandleData, Symbol, Timeframe } from '@/types'
import { binanceFeed } from '@/services/binanceFeed'
import { mt5Feed } from '@/services/mt5Feed'
import { useLayoutStore } from '@/stores/layoutStore'
import { useOrderStore } from '@/stores/orderStore'

export function useRealtimeFeed(
  chartId: string,
  symbol: Symbol,
  timeframe: Timeframe
) {
  const appendCandle = useLayoutStore((s) => s.appendCandle)
  const updateLastPrice = useLayoutStore((s) => s.updateLastPrice)
  const updatePositions = useOrderStore((s) => s.updatePositions)
  const checkPendingOrders = useOrderStore((s) => s.checkPendingOrders)
  const feedRef = useRef<any>(null)

  const handleCandle = useCallback(
    (candle: CandleData) => {
      appendCandle(chartId, candle)
      updateLastPrice(chartId, candle.close, candle.close - candle.open, 0)

      // Spread-aware position and order updates
      if (symbol.exchange === 'mt5') {
        const prices = mt5Feed.getCurrentPrices()
        if (prices.bid && prices.ask) {
          updatePositions(symbol, prices.bid, prices.ask)
          checkPendingOrders(symbol, prices.bid, prices.ask, prices.spread)
        }
      } else {
        // Crypto: assume tight spread, use mid price
        const spread = symbol.id === 'BTCUSDT' ? 0.5 : 0.05
        const bid = candle.close - spread / 2
        const ask = candle.close + spread / 2
        updatePositions(symbol, bid, ask)
        checkPendingOrders(symbol, bid, ask, spread)
      }
    },
    [chartId, symbol, appendCandle, updateLastPrice, updatePositions, checkPendingOrders]
  )

  useEffect(() => {
    const feed = symbol.exchange === 'binance' ? binanceFeed : mt5Feed
    feedRef.current = feed

    feed.connect(symbol, timeframe, {
      onCandle: handleCandle,
      onConnect: () => console.log(`[Feed] Connected: ${symbol.id} ${timeframe}`),
      onError: (err) => console.error(`[Feed] Error: ${symbol.id}`, err),
    })

    return () => {
      feed.disconnect()
    }
  }, [symbol.id, symbol.exchange, timeframe, handleCandle])

  return {
    isConnected: feedRef.current?.getConnectionStatus() || false,
    getPrices: () => {
      if (symbol.exchange === 'mt5') {
        return mt5Feed.getCurrentPrices()
      }
      return { bid: 0, ask: 0, mid: 0, spread: 0 }
    },
  }
}
