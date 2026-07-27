import { useEffect, useState, useCallback } from 'react'
import { DepthSnapshot } from '@/types/depth'
import { Symbol } from '@/types/market'
import { depthFeed } from '@/services/depthFeed'
import { mt5Feed } from '@/services/mt5Feed'

export function useDepthData(symbol: Symbol) {
  const [depth, setDepth] = useState<DepthSnapshot | null>(null)

  const handleDepth = useCallback((data: DepthSnapshot) => {
    setDepth(data)
  }, [])

  useEffect(() => {
    if (symbol.exchange === 'binance') {
      const id = depthFeed.connect(symbol, {
        onSnapshot: handleDepth,
      })
      return () => depthFeed.disconnect(id)
    } else {
      // MT5 depth comes through its own subscription — driveOrders: false since
      // the chart tile's own feed subscription already owns that for this symbol.
      const id = mt5Feed.connect(symbol, '1m', {
        onCandle: () => {},
        onDepth: handleDepth,
        driveOrders: false,
      })
      return () => mt5Feed.disconnect(id)
    }
  }, [symbol.id, symbol.exchange, handleDepth])

  return { depth }
}
