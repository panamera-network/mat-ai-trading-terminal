import { Order, OrderSide, OrderType, OrderStatus, OrderTIF, Position, Trade } from '@/types/order'
import { Symbol } from '@/types/market'

// Spread-aware order execution with SL/TP support
export class OrderService {
  private orders: Map<string, Order> = new Map()
  private positions: Map<string, Position> = new Map()
  private trades: Trade[] = []
  private orderCounter = 0
  private commissionRate = 0.0003

  async placeOrder(params: {
    symbol: Symbol
    side: OrderSide
    type: OrderType
    price?: number
    stopPrice?: number
    slPrice?: number
    tpPrice?: number
    size: number
    tif?: OrderTIF
    currentPrice: number
    spread?: number
    bid?: number
    ask?: number
  }): Promise<Order> {
    this.orderCounter++
    const id = `ord-${Date.now()}-${this.orderCounter}`

    const spread = params.spread ?? this.getDefaultSpread(params.symbol)
    const bid = params.bid ?? params.currentPrice - spread / 2
    const ask = params.ask ?? params.currentPrice + spread / 2

    const order: Order = {
      id,
      symbol: params.symbol.id,
      side: params.side,
      type: params.type,
      status: 'pending',
      price: params.price || null,
      stopPrice: params.stopPrice || null,
      slPrice: params.slPrice ?? null,
      tpPrice: params.tpPrice ?? null,
      size: params.size,
      filled: 0,
      tif: params.tif || 'GTC',
      createdAt: new Date(),
      filledAt: null,
      avgFillPrice: null,
      commission: 0,
      slippage: 0,
    }

    this.orders.set(id, order)

    switch (params.type) {
      case 'market':
        await this.fillMarketOrder(order, params.symbol, bid, ask, spread)
        break
      case 'limit':
        await this.fillLimitOrder(order, params.symbol, bid, ask, spread)
        break
      case 'stop':
        await this.fillStopOrder(order, params.symbol, bid, ask, spread)
        break
      case 'stop_limit':
        await this.fillStopLimitOrder(order, params.symbol, bid, ask, spread)
        break
    }

    return order
  }

  private async fillMarketOrder(order: Order, symbol: Symbol, bid: number, ask: number, spread: number) {
    const basePrice = order.side === 'buy' ? ask : bid
    const slipPips = Math.random() * 2 * symbol.pipSize
    const slipPrice = order.side === 'buy' ? basePrice + slipPips : basePrice - slipPips

    const commission = slipPrice * order.size * this.commissionRate
    const slippagePips = Math.round((slipPrice - basePrice) / symbol.pipSize * 10) / 10

    order.status = 'filled'
    order.filled = order.size
    order.filledAt = new Date()
    order.avgFillPrice = slipPrice
    order.commission = commission
    order.slippage = Math.abs(slippagePips)

    this.recordTrade(order, slipPrice, commission)
    this.updatePosition(order, slipPrice, symbol)
  }

  private async fillLimitOrder(order: Order, symbol: Symbol, bid: number, ask: number, spread: number) {
    if (!order.price) return
    const canFill = (order.side === 'buy' && ask <= order.price) || (order.side === 'sell' && bid >= order.price)
    if (!canFill) return

    const fillPrice = order.side === 'buy' ? Math.min(ask, order.price) : Math.max(bid, order.price)
    const slipPips = Math.random() * 0.5 * symbol.pipSize
    const actualPrice = order.side === 'buy' ? fillPrice + slipPips : fillPrice - slipPips
    const commission = actualPrice * order.size * this.commissionRate

    order.status = 'filled'
    order.filled = order.size
    order.filledAt = new Date()
    order.avgFillPrice = actualPrice
    order.commission = commission
    order.slippage = Math.round(slipPips / symbol.pipSize * 10) / 10

    this.recordTrade(order, actualPrice, commission)
    this.updatePosition(order, actualPrice, symbol)
  }

  private async fillStopOrder(order: Order, symbol: Symbol, bid: number, ask: number, spread: number) {
    if (!order.stopPrice) return
    const triggered = (order.side === 'buy' && ask >= order.stopPrice) || (order.side === 'sell' && bid <= order.stopPrice)
    if (!triggered) return
    await this.fillMarketOrder(order, symbol, bid, ask, spread)
  }

  private async fillStopLimitOrder(order: Order, symbol: Symbol, bid: number, ask: number, spread: number) {
    if (!order.stopPrice || !order.price) return
    const triggered = (order.side === 'buy' && ask >= order.stopPrice) || (order.side === 'sell' && bid <= order.stopPrice)
    if (!triggered) return
    await this.fillLimitOrder(order, symbol, bid, ask, spread)
  }

  /**
   * Check SL/TP on positions — call on every price update
   */
  checkSLTP(symbol: Symbol, bid: number, ask: number) {
    const pos = this.positions.get(symbol.id)
    if (!pos || pos.size <= 0) return

    // For buy position: SL hit if bid <= SL, TP hit if bid >= TP
    // For sell position: SL hit if ask >= SL, TP hit if ask <= TP
    let shouldClose = false
    let closePrice = 0
    let exitReason: 'sl' | 'tp' = 'sl'

    if (pos.side === 'buy') {
      if (pos.slPrice && bid <= pos.slPrice) {
        shouldClose = true
        closePrice = pos.slPrice
        exitReason = 'sl'
      } else if (pos.tpPrice && bid >= pos.tpPrice) {
        shouldClose = true
        closePrice = pos.tpPrice
        exitReason = 'tp'
      }
    } else {
      if (pos.slPrice && ask >= pos.slPrice) {
        shouldClose = true
        closePrice = pos.slPrice
        exitReason = 'sl'
      } else if (pos.tpPrice && ask <= pos.tpPrice) {
        shouldClose = true
        closePrice = pos.tpPrice
        exitReason = 'tp'
      }
    }

    if (shouldClose) {
      this.closePosition(pos, closePrice, symbol, exitReason)
    }
  }

  /**
   * Close position fully at given price
   */
  private closePosition(position: Position, closePrice: number, symbol: Symbol, reason: 'sl' | 'tp' | 'manual') {
    const closePnL = this.calculatePnL(position, closePrice, symbol)
    position.realizedPnL += closePnL

    // Record closing trade
    const trade: Trade = {
      id: `trd-${Date.now()}-${this.orderCounter++}`,
      orderId: position.id,
      symbol: position.symbol,
      side: position.side === 'buy' ? 'sell' : 'buy',
      price: closePrice,
      size: position.size,
      commission: closePrice * position.size * this.commissionRate,
      timestamp: new Date(),
      exitReason: reason,
    }
    this.trades.push(trade)

    this.positions.delete(position.symbol)
  }

  /**
   * Modify SL/TP on existing position
   */
  modifySLTP(symbolId: string, slPrice?: number, tpPrice?: number) {
    const pos = this.positions.get(symbolId)
    if (!pos) return false
    if (slPrice !== undefined) pos.slPrice = slPrice
    if (tpPrice !== undefined) pos.tpPrice = tpPrice
    return true
  }

  checkPendingOrders(symbol: Symbol, bid: number, ask: number, spread: number) {
    const pending = this.getPendingOrders().filter((o) => o.symbol === symbol.id)
    for (const order of pending) {
      if (order.type === 'limit') this.fillLimitOrder(order, symbol, bid, ask, spread)
      else if (order.type === 'stop') this.fillStopOrder(order, symbol, bid, ask, spread)
      else if (order.type === 'stop_limit') this.fillStopLimitOrder(order, symbol, bid, ask, spread)
    }
  }

  private recordTrade(order: Order, price: number, commission: number) {
    const trade: Trade = {
      id: `trd-${Date.now()}-${this.orderCounter}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      price,
      size: order.size,
      commission,
      timestamp: new Date(),
    }
    this.trades.push(trade)
  }

  private updatePosition(order: Order, fillPrice: number, symbol: Symbol) {
    const existing = this.positions.get(order.symbol)

    if (!existing) {
      const position: Position = {
        id: `pos-${Date.now()}`,
        symbol: order.symbol,
        side: order.side,
        size: order.size,
        entryPrice: fillPrice,
        currentPrice: fillPrice,
        unrealizedPnL: 0,
        unrealizedPnLPips: 0,
        realizedPnL: 0,
        openTime: new Date(),
        slPrice: order.slPrice,
        tpPrice: order.tpPrice,
      }
      this.positions.set(order.symbol, position)
    } else {
      if (existing.side === order.side) {
        const totalSize = existing.size + order.size
        existing.entryPrice = (existing.entryPrice * existing.size + fillPrice * order.size) / totalSize
        existing.size = totalSize
        // Update SL/TP if new order has them
        if (order.slPrice) existing.slPrice = order.slPrice
        if (order.tpPrice) existing.tpPrice = order.tpPrice
      } else {
        if (order.size >= existing.size) {
          const closePnL = this.calculatePnL(existing, fillPrice, symbol)
          existing.realizedPnL += closePnL
          if (order.size > existing.size) {
            existing.side = order.side
            existing.size = order.size - existing.size
            existing.entryPrice = fillPrice
            existing.unrealizedPnL = 0
            existing.unrealizedPnLPips = 0
            existing.slPrice = order.slPrice
            existing.tpPrice = order.tpPrice
          } else {
            this.positions.delete(order.symbol)
          }
        } else {
          const closePnL = this.calculatePnL(existing, fillPrice, symbol) * (order.size / existing.size)
          existing.realizedPnL += closePnL
          existing.size -= order.size
        }
      }
    }
  }

  private calculatePnL(position: Position, currentPrice: number, symbol: Symbol): number {
    const priceDiff = position.side === 'buy' ? currentPrice - position.entryPrice : position.entryPrice - currentPrice
    return priceDiff * position.size * symbol.lotSize
  }

  updatePositions(symbol: Symbol, bid: number, ask: number) {
    const pos = this.positions.get(symbol.id)
    if (!pos) return
    const mid = (bid + ask) / 2
    pos.currentPrice = mid
    const priceDiff = pos.side === 'buy' ? pos.currentPrice - pos.entryPrice : pos.entryPrice - pos.currentPrice
    pos.unrealizedPnL = priceDiff * pos.size * symbol.lotSize
    pos.unrealizedPnLPips = Math.round(priceDiff / symbol.pipSize * 10) / 10

    // Check SL/TP
    this.checkSLTP(symbol, bid, ask)
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId)
    if (!order || order.status !== 'pending') return false
    order.status = 'cancelled'
    return true
  }

  getOrders(): Order[] { return Array.from(this.orders.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) }
  getPendingOrders(): Order[] { return this.getOrders().filter((o) => o.status === 'pending') }
  getPositions(): Position[] { return Array.from(this.positions.values()) }
  getTrades(): Trade[] { return [...this.trades].reverse() }
  getPosition(symbolId: string): Position | undefined { return this.positions.get(symbolId) }

  private getDefaultSpread(symbol: Symbol): number {
    const spreads: Record<string, number> = {
      'EURUSD': 0.00015, 'GBPUSD': 0.00020, 'USDJPY': 0.015,
      'AUDUSD': 0.00018, 'USDCAD': 0.00025, 'XAUUSD': 0.15,
      'BTCUSDT': 0.5, 'ETHUSDT': 0.05, 'SOLUSDT': 0.01,
    }
    return spreads[symbol.id] || 0.0001
  }

  reset() {
    this.orders.clear()
    this.positions.clear()
    this.trades = []
    this.orderCounter = 0
  }
}

export const orderService = new OrderService()
