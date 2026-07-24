// src/hooks/useMT5Bridge.ts
// React hook for MT5 bridge integration

import { useState, useEffect, useCallback, useRef } from 'react';
import { mt5Bridge, MT5Tick, MT5Bar, MT5Account, BridgeStatus } from '../services/mt5-bridge';

export interface UseMT5BridgeReturn {
  status: BridgeStatus;
  ticks: Map<string, MT5Tick>;
  account: MT5Account | null;
  positions: MT5Account['positions'];
  orders: MT5Account['orders'];
  placeOrder: (params: any) => Promise<any>;
  closePosition: (ticket: number) => Promise<any>;
  modifyPosition: (ticket: number, sl: number, tp: number) => Promise<any>;
  cancelOrder: (ticket: number) => Promise<any>;
}

export function useMT5Bridge(): UseMT5BridgeReturn {
  const [status, setStatus] = useState<BridgeStatus>({
    connected: false,
    account: null,
    broker: null,
    symbols: []
  });
  
  const [ticks, setTicks] = useState<Map<string, MT5Tick>>(new Map());
  const [account, setAccount] = useState<MT5Account | null>(null);
  const [positions, setPositions] = useState<MT5Account['positions']>([]);
  const [orders, setOrders] = useState<MT5Account['orders']>([]);
  
  const tickBuffer = useRef<Map<string, MT5Tick>>(new Map());
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Connect to bridge
    mt5Bridge.connect();

    // Listen for status changes
    const unsubConnected = mt5Bridge.on('connected', (s: BridgeStatus) => {
      setStatus(s);
    });

    const unsubDisconnected = mt5Bridge.on('disconnected', () => {
      setStatus({ connected: false, account: null, broker: null, symbols: [] });
      setAccount(null);
      setPositions([]);
      setOrders([]);
    });

    // Poll for data updates (since we're using HTTP polling for now)
    const dataInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5556/latest');
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.ticks) {
          for (const tick of data.ticks) {
            tickBuffer.current.set(tick.symbol, tick);
          }
          
          // Batch update using RAF
          if (rafId.current === null) {
            rafId.current = requestAnimationFrame(() => {
              setTicks(new Map(tickBuffer.current));
              rafId.current = null;
            });
          }
        }
        
        if (data.account) {
          setAccount(data.account);
          setPositions(data.account.positions || []);
          setOrders(data.account.orders || []);
        }
      } catch (e) {
        // Silently fail — bridge might be down
      }
    }, 100); // 100ms = ~10 updates/sec

    return () => {
      unsubConnected();
      unsubDisconnected();
      clearInterval(dataInterval);
      mt5Bridge.disconnect();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const placeOrder = useCallback((params: any) => {
    return mt5Bridge.placeOrder(params);
  }, []);

  const closePosition = useCallback((ticket: number) => {
    return mt5Bridge.closePosition(ticket);
  }, []);

  const modifyPosition = useCallback((ticket: number, sl: number, tp: number) => {
    return mt5Bridge.modifyPosition(ticket, sl, tp);
  }, []);

  const cancelOrder = useCallback((ticket: number) => {
    return mt5Bridge.cancelOrder(ticket);
  }, []);

  return {
    status,
    ticks,
    account,
    positions,
    orders,
    placeOrder,
    closePosition,
    modifyPosition,
    cancelOrder
  };
}