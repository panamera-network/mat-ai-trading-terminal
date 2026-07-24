import { Symbol } from '@/types/market'
import { OrderSide, OrderType } from '@/types/order'

interface OrderConfirmModalProps {
  symbol: Symbol
  side: OrderSide
  type: OrderType
  size: number
  price: number
  slPrice?: number
  tpPrice?: number
  onConfirm: () => void
  onCancel: () => void
  isSubmitting?: boolean
}

export default function OrderConfirmModal({
  symbol, side, type, size, price, slPrice, tpPrice, onConfirm, onCancel, isSubmitting,
}: OrderConfirmModalProps) {
  const riskAmount = slPrice ? Math.abs(price - slPrice) * size * symbol.lotSize : undefined

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onCancel}>
      <div
        className="bg-[#161a25] border border-gray-700 rounded-lg shadow-xl w-[280px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white text-sm font-semibold mb-3">
          Confirm {side.toUpperCase()} {type.toUpperCase()}
        </h3>

        <div className="space-y-1.5 text-xs mb-3">
          <div className="flex justify-between"><span className="text-gray-500">Symbol</span><span className="text-white">{symbol.name}</span></div>
          <div className="flex justify-between">
            <span className="text-gray-500">Side</span>
            <span className={side === 'buy' ? 'text-green-400' : 'text-red-400'}>{side.toUpperCase()}</span>
          </div>
          <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="text-white">{price.toFixed(symbol.digits)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-white">{size.toFixed(2)} lots</span></div>
          {slPrice !== undefined && (
            <div className="flex justify-between"><span className="text-gray-500">Stop Loss</span><span className="text-red-400">{slPrice.toFixed(symbol.digits)}</span></div>
          )}
          {tpPrice !== undefined && (
            <div className="flex justify-between"><span className="text-gray-500">Take Profit</span><span className="text-green-400">{tpPrice.toFixed(symbol.digits)}</span></div>
          )}
          {riskAmount !== undefined && (
            <div className="flex justify-between pt-1 border-t border-gray-800"><span className="text-gray-500">Approx. Risk</span><span className="text-yellow-400">${riskAmount.toFixed(2)}</span></div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 py-1.5 text-xs font-semibold rounded text-white disabled:opacity-50 ${side === 'buy' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
          >
            {isSubmitting ? 'Submitting...' : `Confirm ${side.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
