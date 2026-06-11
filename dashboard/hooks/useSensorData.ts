'use client';

import { useEffect, useRef, useState } from 'react';
import { SensorReading } from '@/lib/types';

const MAX_HISTORY = 50;

export function useSensorData() {
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Load initial data
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/readings?limit=50`)
      .then((r) => r.json())
      .then((data: SensorReading[]) => {
        if (data.length > 0) {
          setLatest(data[0]);
          setHistory(data.reverse());
        }
      })
      .catch(console.error);

    // WebSocket for real-time
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'reading') {
          setLatest(msg.data);
          setHistory((prev) => {
            const next = [...prev, msg.data];
            return next.slice(-MAX_HISTORY);
          });
        }
      } catch {}
    };

    return () => ws.close();
  }, []);

  return { latest, history, connected };
}
