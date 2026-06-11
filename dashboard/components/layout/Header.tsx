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
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
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
