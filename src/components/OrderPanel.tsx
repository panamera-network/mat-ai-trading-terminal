import { useState, useMemo } from 'react'
import { useOrderStore } from '@/stores/orderStore'
import { useOrderPlacement } from '@/hooks/useOrderPlacement'
import { Symbol } from '@/types/market'
import { OrderSide, OrderType, OrderTIF } from '@/types/order'
import RiskCalculator from './RiskCalculator'
import OrderConfirmModal from './OrderConfirmModal'
import PositionActions from './PositionActions'

interface OrderPanelProps {
  symbol: Symbol
  bid: number
  ask: number
  spread: number
}

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
]

const TIF_OPTIONS: { value: OrderTIF; label: string }[] = [
  { value: 'GTC', label: 'GTC' },
  { value: 'IOC', label: 'IOC' },
  { value: 'FOK', label: 'FOK' },
]

export default function OrderPanel({ symbol, bid, ask, spread }: OrderPanelProps) {
  const currentPrice = (bid + ask) / 2
  const { form, setField, setSide, setType, submit, quickBuy, quickSell, isSubmitting } =
    useOrderPlacement(symbol, currentPrice, spread, bid, ask)
  const positions = useOrderStore((s) => s.positions)
  const orders = useOrderStore((s) => s.orders)
  const cancelOrder = useOrderStore((s) => s.cancelOrder)
  const modifySLTP = useOrderStore((s) => s.modifySLTP)

  const position = positions.find((p) => p.symbol === symbol.id)
  const pendingOrders = orders.filter((o) => o.symbol === symbol.id && o.status === 'pending')

  const [slPrice, setSlPrice] = useState('')
  const [tpPrice, setTpPrice] = useState('')
  const [modifyingSLTP, setModifyingSLTP] = useState(false)
  const [showRiskCalc, setShowRiskCalc] = useState(false)
  const [confirmBeforeSubmit, setConfirmBeforeSubmit] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)

  const doSubmit = async () => {
    const sl = slPrice ? parseFloat(slPrice) : undefined
    const tp = tpPrice ? parseFloat(tpPrice) : undefined
    const order = await submit(sl, tp)
    if (order) {
      setField('price', '')
      setField('stopPrice', '')
      setSlPrice('')
      setTpPrice('')
    }
    setShowConfirm(false)
  }

  const handleSubmit = () => {
    if (confirmBeforeSubmit) {
      setShowConfirm(true)
    } else {
      doSubmit()
    }
  }

  const handleModifySLTP = () => {
    const sl = slPrice ? parseFloat(slPrice) : undefined
    const tp = tpPrice ? parseFloat(tpPrice) : undefined
    modifySLTP(symbol.id, sl, tp)
    setModifyingSLTP(false)
    setSlPrice('')
    setTpPrice('')
  }

  const spreadPips = Math.round(spread / symbol.pipSize * 10) / 10

  // Auto-suggest SL/TP based on ATR or fixed pips
  const suggestedSL = useMemo(() => {
    if (form.side === 'buy') return (bid - 20 * symbol.pipSize).toFixed(symbol.digits)
    return (ask + 20 * symbol.pipSize).toFixed(symbol.digits)
  }, [form.side, bid, ask, symbol])

  const suggestedTP = useMemo(() => {
    if (form.side === 'buy') return (ask + 40 * symbol.pipSize).toFixed(symbol.digits)
    return (bid - 40 * symbol.pipSize).toFixed(symbol.digits)
  }, [form.side, bid, ask, symbol])

  return (
    <div className="w-[280px] bg-[#161a25] border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800">
        <h3 className="text-white text-sm font-semibold">{symbol.name}</h3>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-green-400">Bid {bid.toFixed(symbol.digits)}</span>
          <span className="text-red-400">Ask {ask.toFixed(symbol.digits)}</span>
        </div>
        <div className="text-center text-[10px] text-gray-500 mt-0.5">
          Spread: {spreadPips} pips
        </div>
        <button
          onClick={() => setShowRiskCalc((v) => !v)}
          className={`w-full mt-1 py-1 text-[10px] rounded border ${showRiskCalc ? 'bg-blue-900 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'}`}
        >
          Risk Calculator
        </button>
      </div>

      {showRiskCalc && (
        <RiskCalculator
          symbol={symbol}
          accountBalance={10000}
          entryPrice={currentPrice}
          onApply={({ positionSize, stopLoss, takeProfit }) => {
            setField('size', positionSize.toString())
            setSlPrice(stopLoss.toFixed(symbol.digits))
            setTpPrice(takeProfit.toFixed(symbol.digits))
            setShowRiskCalc(false)
          }}
        />
      )}

      {/* Order Form */}
      <div className="px-3 py-2 space-y-2">
        {/* Side buttons */}
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => setSide('buy')} className={`py-1.5 text-xs font-semibold rounded transition-colors ${form.side === 'buy' ? 'bg-green-600 text-white' : 'bg-[#1e222d] text-green-400 border border-green-900'}`}>BUY</button>
          <button onClick={() => setSide('sell')} className={`py-1.5 text-xs font-semibold rounded transition-colors ${form.side === 'sell' ? 'bg-red-600 text-white' : 'bg-[#1e222d] text-red-400 border border-red-900'}`}>SELL</button>
        </div>

        {/* Order type */}
        <div className="grid grid-cols-4 gap-1">
          {ORDER_TYPES.map((t) => (
            <button key={t.value} onClick={() => setType(t.value)} className={`py-1 text-[10px] rounded border transition-colors ${form.type === t.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1e222d] border-gray-700 text-gray-400 hover:text-white'}`}>{t.label}</button>
          ))}
        </div>

        {/* Price inputs */}
        {(form.type === 'limit' || form.type === 'stop_limit') && (
          <div>
            <label className="text-gray-500 text-[10px] uppercase">Limit Price</label>
            <input type="number" step={symbol.pipSize} value={form.price} onChange={(e) => setField('price', e.target.value)} className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500" placeholder={currentPrice.toFixed(symbol.digits)} />
            {form.errors.price && <span className="text-red-400 text-[10px]">{form.errors.price}</span>}
          </div>
        )}

        {(form.type === 'stop' || form.type === 'stop_limit') && (
          <div>
            <label className="text-gray-500 text-[10px] uppercase">Stop Price</label>
            <input type="number" step={symbol.pipSize} value={form.stopPrice} onChange={(e) => setField('stopPrice', e.target.value)} className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500" />
            {form.errors.stopPrice && <span className="text-red-400 text-[10px]">{form.errors.stopPrice}</span>}
          </div>
        )}

        {/* SL/TP */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-gray-500 text-[10px] uppercase flex justify-between">
              <span>SL</span>
              <button onClick={() => setSlPrice(suggestedSL)} className="text-blue-400 hover:text-blue-300">Auto</button>
            </label>
            <input type="number" step={symbol.pipSize} value={slPrice} onChange={(e) => setSlPrice(e.target.value)} className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-red-500" placeholder="—" />
          </div>
          <div>
            <label className="text-gray-500 text-[10px] uppercase flex justify-between">
              <span>TP</span>
              <button onClick={() => setTpPrice(suggestedTP)} className="text-blue-400 hover:text-blue-300">Auto</button>
            </label>
            <input type="number" step={symbol.pipSize} value={tpPrice} onChange={(e) => setTpPrice(e.target.value)} className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-green-500" placeholder="—" />
          </div>
        </div>

        {/* Size */}
        <div>
          <label className="text-gray-500 text-[10px] uppercase">Size ({symbol.exchange === 'mt5' ? 'Lots' : symbol.base})</label>
          <input type="number" step="0.01" min="0.01" value={form.size} onChange={(e) => setField('size', e.target.value)} className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-blue-500" />
          {form.errors.size && <span className="text-red-400 text-[10px]">{form.errors.size}</span>}
        </div>

        {/* TIF */}
        <div>
          <label className="text-gray-500 text-[10px] uppercase">Time in Force</label>
          <select value={form.tif} onChange={(e) => setField('tif', e.target.value as OrderTIF)} className="w-full bg-[#1e222d] text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none">
            {TIF_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Submit */}
        <label className="flex items-center gap-1 text-[10px] text-gray-500">
          <input type="checkbox" checked={confirmBeforeSubmit} onChange={(e) => setConfirmBeforeSubmit(e.target.checked)} className="accent-blue-500" />
          Confirm before submit
        </label>
        <button onClick={handleSubmit} disabled={isSubmitting} className={`w-full py-2 text-xs font-bold rounded transition-colors ${form.side === 'buy' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'} disabled:opacity-50`}>
          {isSubmitting ? 'Submitting...' : `${form.side.toUpperCase()} ${form.type.toUpperCase()}`}
        </button>
      </div>

      {showConfirm && (
        <OrderConfirmModal
          symbol={symbol}
          side={form.side}
          type={form.type}
          size={parseFloat(form.size) || 0}
          price={form.type === 'limit' || form.type === 'stop_limit' ? parseFloat(form.price) || currentPrice : currentPrice}
          slPrice={slPrice ? parseFloat(slPrice) : undefined}
          tpPrice={tpPrice ? parseFloat(tpPrice) : undefined}
          isSubmitting={isSubmitting}
          onConfirm={doSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Position info with SL/TP */}
      {position && (
        <div className="px-3 py-2 border-t border-gray-800">
          <h4 className="text-gray-400 text-[10px] uppercase mb-1">Position</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Side</span><span className={position.side === 'buy' ? 'text-green-400' : 'text-red-400'}>{position.side.toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-white">{position.size.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Entry</span><span className="text-white">{position.entryPrice.toFixed(symbol.digits)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">P&L</span><span className={position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>{position.unrealizedPnL >= 0 ? '+' : ''}{position.unrealizedPnL.toFixed(2)} ({position.unrealizedPnLPips} pips)</span></div>

            {/* SL/TP display */}
            <div className="flex justify-between"><span className="text-gray-500">SL</span><span className="text-red-400">{position.slPrice?.toFixed(symbol.digits) || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">TP</span><span className="text-green-400">{position.tpPrice?.toFixed(symbol.digits) || '—'}</span></div>

            {/* Modify SL/TP */}
            {modifyingSLTP ? (
              <div className="space-y-1 mt-2">
                <input type="number" step={symbol.pipSize} value={slPrice} onChange={(e) => setSlPrice(e.target.value)} placeholder="New SL" className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none" />
                <input type="number" step={symbol.pipSize} value={tpPrice} onChange={(e) => setTpPrice(e.target.value)} placeholder="New TP" className="w-full bg-[#1e222d] text-white text-xs px-2 py-1 rounded border border-gray-700 outline-none" />
                <div className="flex gap-1">
                  <button onClick={() => setModifyingSLTP(false)} className="flex-1 py-1 text-[10px] rounded border border-gray-700 text-gray-400">Cancel</button>
                  <button onClick={handleModifySLTP} className="flex-1 py-1 text-[10px] rounded bg-blue-600 text-white">Save</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setModifyingSLTP(true)} className="w-full py-1 text-[10px] rounded border border-gray-700 text-gray-400 hover:text-white mt-1">Modify SL/TP</button>
            )}

            <PositionActions symbol={symbol} position={position} bid={bid} ask={ask} spread={spread} />
          </div>
        </div>
      )}

      {/* Pending orders */}
      {pendingOrders.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-800 flex-1 overflow-auto">
          <h4 className="text-gray-400 text-[10px] uppercase mb-1">Pending Orders</h4>
          <div className="space-y-1">
            {pendingOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between bg-[#1e222d] rounded px-2 py-1">
                <div className="text-xs">
                  <span className={order.side === 'buy' ? 'text-green-400' : 'text-red-400'}>{order.side.toUpperCase()}</span>
                  <span className="text-gray-500 ml-1">{order.type}</span>
                  <span className="text-white ml-1">{order.price?.toFixed(symbol.digits) || 'MKT'}</span>
                  {order.slPrice && <span className="text-red-400 ml-1 text-[10px]">SL:{order.slPrice.toFixed(symbol.digits)}</span>}
                  {order.tpPrice && <span className="text-green-400 ml-1 text-[10px]">TP:{order.tpPrice.toFixed(symbol.digits)}</span>}
                </div>
                <button onClick={() => cancelOrder(order.id)} className="text-gray-500 hover:text-red-400 text-xs">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
