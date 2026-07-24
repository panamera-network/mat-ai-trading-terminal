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
      depthFeed.connect(symbol, {
        onSnapshot: handleDepth,
      })
      return () => depthFeed.disconnect()
    } else {
      // MT5 depth comes through the main feed
      mt5Feed.connect(symbol, '1m', {
        onCandle: () => {},
        onDepth: handleDepth,
      })
      return () => mt5Feed.disconnect()
    }
  }, [symbol.id, symbol.exchange, handleDepth])

  return { depth }
}
