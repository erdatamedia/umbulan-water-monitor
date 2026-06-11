'use client';

interface MetricCardProps {
  label: string;
  value: number | null;
  unit: string;
  decimals?: number;
  color?: string;
}

export function MetricCard({ label, value, unit, decimals = 2, color = '#3b82f6' }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-bold" style={{ color }}>
        {value !== null && value !== undefined ? value.toFixed(decimals) : '—'}
      </span>
      <span className="text-sm text-gray-400">{unit}</span>
    </div>
  );
}
