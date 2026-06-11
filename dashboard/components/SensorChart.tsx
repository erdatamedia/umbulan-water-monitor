'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { SensorReading } from '@/lib/types';

interface SensorChartProps {
  data: SensorReading[];
  dataKey: keyof SensorReading;
  color: string;
  label: string;
  unit: string;
}

export function SensorChart({ data, dataKey, color, label, unit }: SensorChartProps) {
  const chartData = data.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r[dataKey] !== null ? Number(r[dataKey]) : null,
  }));

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">{label} <span className="text-gray-400 font-normal">({unit})</span></h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} width={45} />
          <Tooltip formatter={(v) => [`${v} ${unit}`, label]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
