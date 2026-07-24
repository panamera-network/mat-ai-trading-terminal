import React, { useState } from 'react';
import { useMT5Feed } from '../hooks/useMT5Feed';
import { OrderConfirmModal } from './OrderConfirmModal';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];

export const MT5FeedSelector: React.FC = () => {
  const {
    connected,
    accounts,
    selectedAccount,
    symbols,
    historyLoading,
    positions,
    selectAccount,
    getHistory,
    sendCommand
  } = useMT5Feed();

  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  const [selectedTF, setSelectedTF] = useState('H1');
  const [pendingOrder, setPendingOrder] = useState<any>(null);

  const activeAccount = selectedAccount ? accounts.get(selectedAccount) : null;
  const availableSymbols = activeAccount 
    ? Array.from(activeAccount.symbols?.keys() || []) 
    : [];

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    getHistory(sym, selectedTF, 500);
  };

  const handleTFChange = (tf: string) => {
    setSelectedTF(tf);
    getHistory(selectedSymbol, tf, 500);
  };

  const handleTradeClick = (action: 'BUY' | 'SELL') => {
    const tick = symbols.get(selectedSymbol);
    if(!tick) return;
    
    setPendingOrder({
      action,
      symbol: selectedSymbol,
      price: action === 'BUY' ? tick.ask : tick.bid,
      volume: 0.1,
      sl: action === 'BUY' ? tick.bid - 0.0050 : tick.ask + 0.0050,
      tp: action === 'BUY' ? tick.bid + 0.0100 : tick.ask - 0.0100
    });
  };

  const confirmTrade = (order: any) => {
    sendCommand({
      action: order.action,
      symbol: order.symbol,
      volume: order.volume,
      sl: order.sl,
      tp: order.tp,
      comment: 'MAT.ai Terminal'
    });
    setPendingOrder(null);
  };

  return (
    <div className="mt5-panel">
      {/* Connection Status */}
      <div className="status-bar">
        <span className={`indicator ${connected ? 'green' : 'red'}`}>
          ● Bridge: {connected ? 'Connected' : 'Disconnected'}
        </span>
        <span className={`indicator ${activeAccount?.connected ? 'green' : 'red'}`}>
          ● MT5: {activeAccount?.connected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Account Selector */}
      <div className="account-selector">
        <label>Account:</label>
        <select 
          value={selectedAccount || ''} 
          onChange={e => selectAccount(e.target.value)}
        >
          <option value="">Select Account</option>
          {Array.from(accounts.values()).map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.id} {acc.connected ? '✅' : '❌'} | ${acc.balance?.toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      {/* Symbol & Timeframe */}
      <div className="chart-controls">
        <select value={selectedSymbol} onChange={e => handleSymbolChange(e.target.value)}>
          {availableSymbols.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        
        <select value={selectedTF} onChange={e => handleTFChange(e.target.value)}>
          {TIMEFRAMES.map(tf => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
        
        {historyLoading.has(`${selectedAccount}_${selectedSymbol}_${selectedTF}`) && (
          <span className="loading">⏳ Loading history...</span>
        )}
      </div>

      {/* Price Ticker */}
      {(() => {
        const tick = symbols.get(selectedSymbol);
        if(!tick) return null;
        return (
          <div className="price-ticker">
            <div className="bid">{tick.bid.toFixed(5)}</div>
            <div className="spread">{tick.spread.toFixed(1)}</div>
            <div className="ask">{tick.ask.toFixed(5)}</div>
          </div>
        );
      })()}

      {/* Trade Buttons */}
      {activeAccount?.connected && (
        <div className="trade-buttons">
          <button className="btn-buy" onClick={() => handleTradeClick('BUY')}>
            BUY {selectedSymbol}
          </button>
          <button className="btn-sell" onClick={() => handleTradeClick('SELL')}>
            SELL {selectedSymbol}
          </button>
        </div>
      )}

      {/* Positions */}
      <div className="positions-panel">
        <h4>Open Positions ({positions.length})</h4>
        {positions.map(pos => (
          <div key={pos.ticket} className="position-row">
            <span>{pos.symbol} {pos.type}</span>
            <span>{pos.volume} lots @ {pos.openPrice}</span>
            <span className={pos.profit >= 0 ? 'profit' : 'loss'}>
              ${pos.profit.toFixed(2)}
            </span>
            <button onClick={() => sendCommand({ action: 'CLOSE', ticket: pos.ticket })}>
              Close
            </button>
          </div>
        ))}
      </div>

      {/* Order Confirmation Modal */}
      {pendingOrder && (
        <OrderConfirmModal
          order={pendingOrder}
          onConfirm={confirmTrade}
          onCancel={() => setPendingOrder(null)}
        />
      )}
    </div>
  );
};