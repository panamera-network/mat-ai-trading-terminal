import { useState, useEffect, useRef, useCallback } from 'react';
import { MT5Tick, MT5OHLCV, MT5Position, MT5Account, MT5HistoryBar, MT5Message } from '../types/mt5';
import { useAlerts } from './useAlerts';        // Import
import { useTradeJournal } from './useTradeJournal';  // Import

interface MT5FeedState {
  connected: boolean;
  accounts: Map<string, MT5Account>;
  selectedAccount: string | null;
  symbols: Map<string, MT5Tick>;
  ohlcv: Map<string, MT5OHLCV[]>;
  history: Map<string, MT5HistoryBar[]>;
  historyLoading: Set<string>;
  positions: MT5Position[];
  error: string | null;
}

export function useMT5Feed(bridgeUrl: string = 'ws://localhost:8080') {
  const ws = useRef<WebSocket | null>(null);
  const [state, setState] = useState<MT5FeedState>({
    connected: false,
    accounts: new Map(),
    selectedAccount: null,
    symbols: new Map(),
    ohlcv: new Map(),
    history: new Map(),
    historyLoading: new Set(),
    positions: [],
    error: null
  });
  
  const reconnectTimer = useRef<NodeJS.Timeout>();
  const pendingHistory = useRef<Set<string>>(new Set());

  // ✅ Declare dalam hook — boleh access dalam handleMessage
  const { alerts, checkAlerts, addAlert, removeAlert, triggeredAlerts, clearTriggered } = useAlerts();
  const { trades, logOpen, logClose, updateTrade, filterTrades, analytics, exportCSV } = useTradeJournal();

  // ✅ Helper: get position by ticket (for TRADE_RESULT)
  const getPositionByTicket = useCallback((ticket: number): MT5Position | undefined => {
    return state.positions.find(p => p.ticket === ticket);
  }, [state.positions]);

  const connect = useCallback(() => {
    if(ws.current?.readyState === WebSocket.OPEN) return;
    
    try {
      ws.current = new WebSocket(bridgeUrl);
      
      ws.current.onopen = () => {
        setState(prev => ({ ...prev, connected: true, error: null }));
      };
      
      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      };
      
      ws.current.onclose = () => {
        setState(prev => ({ ...prev, connected: false }));
        reconnectTimer.current = setTimeout(connect, 3000);
      };
      
      ws.current.onerror = () => {
        setState(prev => ({ ...prev, error: 'Connection error' }));
      };
      
    } catch {
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [bridgeUrl]);

  // ✅ Fixed: Include semua dependencies yang kena
  const handleMessage = useCallback((msg: any) => {
    setState(prev => {
      const next = { ...prev };
      
      switch(msg.type) {
        case 'CONNECTED':
          msg.accounts?.forEach((acc: MT5Account) => {
            next.accounts = new Map(prev.accounts);
            next.accounts.set(acc.id, acc);
          });
          break;
          
        case 'ACCOUNT_ONLINE':
          next.accounts = new Map(prev.accounts);
          next.accounts.set(msg.account.id, { ...msg.account, connected: true });
          break;
          
        case 'ACCOUNT_SELECTED':
          next.accounts = new Map(prev.accounts);
          next.accounts.set(msg.account.id, msg.account);
          break;
          
        case 'ACCOUNT_OFFLINE':
          next.accounts = new Map(prev.accounts);
          const offlineAcc = next.accounts.get(msg.accountId);
          if(offlineAcc) offlineAcc.connected = false;
          break;
          
        case 'TICK':
          if(msg.accountId === prev.selectedAccount) {
            next.symbols = new Map(prev.symbols);
            next.symbols.set(msg.data.symbol, msg.data);
            // ✅ Now works — checkAlerts dari useAlerts hook
            checkAlerts(msg.data);
          }
          break;
          
        case 'OHLCV':
          if(msg.accountId === prev.selectedAccount) {
            const key = `${msg.accountId}_${msg.data.symbol}_${msg.data.timeframe}`;
            next.ohlcv = new Map(prev.ohlcv);
            const bars = next.ohlcv.get(key) || [];
            const last = bars[bars.length - 1];
            if(last && last.time === msg.data.time) {
              bars[bars.length - 1] = msg.data;
            } else {
              bars.push(msg.data);
            }
            if(bars.length > 2000) bars.shift();
            next.ohlcv.set(key, bars);
          }
          break;
          
        case 'HISTORY':
        case 'HISTORY_BATCH':
        case 'HISTORY_CACHED':
          const hKey = `${msg.accountId}_${msg.data.symbol}_${msg.data.timeframe}`;
          next.history = new Map(prev.history);
          const existing = next.history.get(hKey) || [];
          const newBars = msg.data.bars || [];
          next.history.set(hKey, [...existing, ...newBars]);
          break;
          
        case 'HISTORY_COMPLETE':
          const hcKey = `${msg.accountId}_${msg.data.symbol}_${msg.data.timeframe}`;
          next.historyLoading = new Set(prev.historyLoading);
          next.historyLoading.delete(hcKey);
          pendingHistory.current.delete(hcKey);
          break;
          
        case 'HEARTBEAT':
          next.accounts = new Map(prev.accounts);
          const hbAcc = next.accounts.get(msg.accountId);
          if(hbAcc) {
            hbAcc.balance = msg.data.balance;
            hbAcc.equity = msg.data.equity;
            hbAcc.margin = msg.data.margin;
            hbAcc.lastHeartbeat = Date.now();
          }
          break;
          
        case 'POSITION':
          if(msg.accountId === prev.selectedAccount) {
            next.positions = prev.positions.map(p => 
              p.ticket === msg.data.ticket ? msg.data : p
            );
            if(!next.positions.find(p => p.ticket === msg.data.ticket)) {
              next.positions.push(msg.data);
            }
            // ✅ Log new position to journal
            if(!prev.positions.find(p => p.ticket === msg.data.ticket)) {
              logOpen(msg.data);
            }
          }
          break;
          
        case 'TRADE_RESULT':
          console.log('Trade result:', msg.data);
          // ✅ Fixed: Find position first, then log with data
          if(msg.data.error === 0) {
            const pos = prev.positions.find(p => p.ticket === msg.data.ticket);
            if(pos) {
              logClose(msg.data, pos);  // Pass position untuk exit price
            }
            // Remove from positions if closed
            if(msg.data.action === 'CLOSE' || msg.data.action === 'CLOSE_PARTIAL') {
              next.positions = prev.positions.filter(p => p.ticket !== msg.data.ticket);
            }
          }
          break;
      }
      
      return next;
    });
  // ✅ Dependency array kena ada semua yang digunakan
  }, [checkAlerts, logOpen, logClose]);

  // Account selection
  const selectAccount = useCallback((accountId: string) => {
    setState(prev => ({ ...prev, selectedAccount: accountId }));
    ws.current?.send(JSON.stringify({ type: 'SELECT_ACCOUNT', accountId }));
  }, []);

  // History backfill
  const getHistory = useCallback((symbol: string, timeframe: string, count: number = 500) => {
    const accountId = state.selectedAccount;
    if(!accountId) return;
    
    const key = `${accountId}_${symbol}_${timeframe}`;
    if(state.historyLoading.has(key) || pendingHistory.current.has(key)) return;
    
    pendingHistory.current.add(key);
    setState(prev => {
      const next = { ...prev };
      next.historyLoading = new Set(prev.historyLoading);
      next.historyLoading.add(key);
      return next;
    });
    
    ws.current?.send(JSON.stringify({
      type: 'GET_HISTORY',
      accountId,
      symbol,
      timeframe,
      count
    }));
  }, [state.selectedAccount, state.historyLoading]);

  const getOHLCV = useCallback((symbol: string, timeframe: string): MT5OHLCV[] => {
    if(!state.selectedAccount) return [];
    return state.ohlcv.get(`${state.selectedAccount}_${symbol}_${timeframe}`) || [];
  }, [state.selectedAccount, state.ohlcv]);

  const getHistoryBars = useCallback((symbol: string, timeframe: string): MT5HistoryBar[] => {
    if(!state.selectedAccount) return [];
    return state.history.get(`${state.selectedAccount}_${symbol}_${timeframe}`) || [];
  }, [state.selectedAccount, state.history]);

  // Trade commands
  const sendCommand = useCallback((command: any) => {
    if(!state.selectedAccount) return;
    ws.current?.send(JSON.stringify({
      type: 'TRADE_COMMAND',
      accountId: state.selectedAccount,
      data: command
    }));
  }, [state.selectedAccount]);

  const subscribeSymbol = useCallback((symbol: string) => {
    if(!state.selectedAccount) return;
    ws.current?.send(JSON.stringify({
      type: 'SUBSCRIBE_SYMBOL',
      accountId: state.selectedAccount,
      symbol
    }));
  }, [state.selectedAccount]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return {
    ...state,
    alerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    clearTriggered,
    trades,
    analytics,
    exportCSV,
    selectAccount,
    getHistory,
    getOHLCV,
    getHistoryBars,
    sendCommand,
    subscribeSymbol,
    reconnect: connect
  };
}