'use client';

import { useEffect, useRef } from 'react';
import { useKaidoStore } from '../store';
import type { WsMessage, Ticker } from '@repo/types';

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:4000/ws';

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const updateTicker = useKaidoStore((s) => s.updateTicker);
  const setWsStatus = useKaidoStore((s) => s.setWsStatus);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pingTimer: ReturnType<typeof setInterval>;
    let alive = true;

    function connect() {
      if (!alive) return;
      setWsStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15_000);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WsMessage;
          if (msg.type === 'data' && msg.payload.channel === 'ticker') {
            const raw = msg.payload.data as {
              symbol: string;
              price: string | number;
              timestamp: string | number;
            };
            const ticker: Ticker = {
              symbol: raw.symbol,
              price: Number(raw.price),
              change24h: 0,
              high24h: 0,
              low24h: 0,
              volume24h: 0,
              timestamp: Number(raw.timestamp),
            };
            updateTicker(ticker);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        setWsStatus('disconnected');
        if (alive) {
          reconnectTimer = setTimeout(connect, 3_000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, [updateTicker, setWsStatus]);

  return <>{children}</>;
}
