'use client';

import { RealtimeClock } from '@/components/RealtimeClock';

interface HeaderProps {
  title: string;
  subtitle?: string;
  lastUpdate?: string | null;
  connected?: boolean;
}

export function Header({ title, subtitle, lastUpdate, connected }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2 sticky top-0 z-40">
      <div className="min-w-0">
        <h1 className="text-base md:text-lg font-bold text-gray-800 leading-tight">{title}</h1>
        {subtitle && <p className="text-[11px] text-gray-400 hidden md:block mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {connected !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Live' : 'Offline'}</span>
          </div>
        )}
        <RealtimeClock lastUpdate={lastUpdate ?? null} staleAfterSeconds={60} />
      </div>
    </header>
  );
}
