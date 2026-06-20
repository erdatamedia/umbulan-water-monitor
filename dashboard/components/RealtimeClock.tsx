'use client';

import { useEffect, useState } from 'react';

interface RealtimeClockProps {
  lastUpdate: string | null;
  staleAfterSeconds?: number;
}

export function RealtimeClock({ lastUpdate, staleAfterSeconds = 60 }: RealtimeClockProps) {
  // null saat SSR — diset setelah mount agar SSR dan CSR render konten yang sama (cegah #418)
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  const secondsAgo = lastUpdate
    ? Math.floor((now.getTime() - new Date(lastUpdate).getTime()) / 1000)
    : null;

  const isStale = secondsAgo !== null && secondsAgo > staleAfterSeconds;

  function formatAgo(s: number) {
    if (s < 60) return `${s}d yang lalu`;
    if (s < 3600) return `${Math.floor(s / 60)}m yang lalu`;
    return `${Math.floor(s / 3600)}j yang lalu`;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 font-mono text-xs md:text-sm">
        {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      {secondsAgo !== null && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
          isStale ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
        }`}>
          {isStale ? `⚠ ${formatAgo(secondsAgo)}` : `✓ ${formatAgo(secondsAgo)}`}
        </span>
      )}
    </div>
  );
}
