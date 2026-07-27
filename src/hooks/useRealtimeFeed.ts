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
  const subscriptionIdRef = useRef<string | null>(null)

  const handleCandle = useCallback(
    (candle: CandleData) => {
      appendCandle(chartId, candle)
      updateLastPrice(chartId, candle.close, candle.close - candle.open, 0)

      // Spread-aware position and order updates
      if (symbol.exchange === 'mt5' && subscriptionIdRef.current) {
        const prices = mt5Feed.getCurrentPrices(subscriptionIdRef.current)
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

    const id = feed.connect(symbol, timeframe, {
      onCandle: handleCandle,
      onConnect: () => console.log(`[Feed] Connected: ${symbol.id} ${timeframe}`),
      onError: (err) => console.error(`[Feed] Error: ${symbol.id}`, err),
    })
    subscriptionIdRef.current = id

    return () => {
      feed.disconnect(id)
      subscriptionIdRef.current = null
    }
  }, [symbol.id, symbol.exchange, timeframe, handleCandle])

  return {
    isConnected: subscriptionIdRef.current ? feedRef.current?.getConnectionStatus(subscriptionIdRef.current) || false : false,
    getPrices: () => {
      if (symbol.exchange === 'mt5' && subscriptionIdRef.current) {
        return mt5Feed.getCurrentPrices(subscriptionIdRef.current)
      }
      return { bid: 0, ask: 0, mid: 0, spread: 0 }
    },
  }
}
