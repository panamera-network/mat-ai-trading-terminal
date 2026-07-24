// src/hooks/useMT5NativeBridge.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { MT5NativeBridge } from '../services/mt5-native-bridge';

interface MT5Connection {
  connected: boolean;
  account: string | null;
  broker: string | null;
  symbols: string[];
}

export function useMT5NativeBridge() {
  const [connection, setConnection] = useState<MT5Connection>({
    connected: false,
    account: null,
    broker: null,
    symbols: []
  });
  
  const [ticks, setTicks] = useState<Map<string, any>>(new Map());
  const [positions, setPositions] = useState<any[]>([]);
  const bridgeRef = useRef<MT5NativeBridge | null>(null);

  useEffect(() => {
    const bridge = new MT5NativeBridge();
    bridgeRef.current = bridge;

    bridge.on('handshake', (data) => {
      setConnection({
        connected: true,
        account: data.account,
        broker: data.broker,
        symbols: data.symbols || []
      });
    });

    bridge.on('tick', (tick) => {
      setTicks(prev => new Map(prev).set(tick.symbol, tick));
    });

    bridge.on('accountUpdate', (acc) => {
      setPositions(acc.positions || []);
    });

    bridge.on('disconnect', () => {
      setConnection(prev => ({ ...prev, connected: false }));
    });

    bridge.start();

    return () => {
      bridge.stop();
    };
  }, []);

  const placeOrder = useCallback((params: any) => {
    if (!connection.account || !bridgeRef.current) return false;
    return bridgeRef.current.placeOrder(connection.account, params);
  }, [connection.account]);

  const closePosition = useCallback((ticket: number) => {
    if (!connection.account || !bridgeRef.current) return false;
    return bridgeRef.current.closePosition(connection.account, ticket);
  }, [connection.account]);

  const modifyPosition = useCallback((ticket: number, sl: number, tp: number) => {
    if (!connection.account || !bridgeRef.current) return false;
    return bridgeRef.current.modifyPosition(connection.account, ticket, sl, tp);
  }, [connection.account]);

  return {
    connection,
    ticks,
    positions,
    placeOrder,
    closePosition,
    modifyPosition
  };
}