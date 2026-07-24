import { create } from 'zustand'
import { Order, Position, Trade } from '@/types/order'
import { Symbol } from '@/types/market'
import { orderService } from '@/services/orderService'

interface OrderStore {
  orders: Order[]
  positions: Position[]
  trades: Trade[]
  selectedOrderId: string | null
  placeOrder: (params: {
    symbol: Symbol
    side: 'buy' | 'sell'
    type: 'market' | 'limit' | 'stop' | 'stop_limit'
    price?: number
    stopPrice?: number
    slPrice?: number
    tpPrice?: number
    size: number
    tif?: 'GTC' | 'IOC' | 'FOK'
    currentPrice: number
    spread?: number
    bid?: number
    ask?: number
  }) => Promise<Order>
  cancelOrder: (orderId: string) => void
  modifySLTP: (symbolId: string, slPrice?: number, tpPrice?: number) => void
  updatePositions: (symbol: Symbol, bid: number, ask: number) => void
  checkPendingOrders: (symbol: Symbol, bid: number, ask: number, spread: number) => void
  selectOrder: (id: string | null) => void
  refresh: () => void
  reset: () => void
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  positions: [],
  trades: [],
  selectedOrderId: null,

  placeOrder: async (params) => {
    const order = await orderService.placeOrder(params)
    get().refresh()
    return order
  },

  cancelOrder: (orderId) => {
    orderService.cancelOrder(orderId)
    get().refresh()
  },

  modifySLTP: (symbolId, slPrice, tpPrice) => {
    orderService.modifySLTP(symbolId, slPrice, tpPrice)
    get().refresh()
  },

  updatePositions: (symbol, bid, ask) => {
    orderService.updatePositions(symbol, bid, ask)
    get().refresh()
  },

  checkPendingOrders: (symbol, bid, ask, spread) => {
    orderService.checkPendingOrders(symbol, bid, ask, spread)
    get().refresh()
  },

  selectOrder: (id) => set({ selectedOrderId: id }),

  refresh: () => {
    set({
      orders: orderService.getOrders(),
      positions: orderService.getPositions(),
      trades: orderService.getTrades(),
    })
  },

  reset: () => {
    orderService.reset()
    set({ orders: [], positions: [], trades: [], selectedOrderId: null })
  },
}))
