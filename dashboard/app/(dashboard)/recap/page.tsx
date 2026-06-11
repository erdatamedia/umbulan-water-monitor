'use client';

import { useEffect, useState, useCallback } from 'react';
import { SensorReading } from '@/lib/types';
import { Header } from '@/components/layout/Header';
import { SensorChart } from '@/components/SensorChart';

const API = process.env.NEXT_PUBLIC_API_URL;

type StatKey = 'temperature' | 'ph' | 'turbidity' | 'water_level_cm' | 'discharge_m3s' | 'do_estimated';

interface Stat {
  min: number; max: number; avg: number; count: number;
}

function calcStats(data: SensorReading[], key: StatKey): Stat | null {
  const vals = data.map(r => r[key]).filter((v): v is number => v !== null && v !== undefined).map(Number);
  if (!vals.length) return null;
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    count: vals.length,
  };
}

const SENSORS: { key: StatKey; label: string; unit: string; color: string; decimals?: number }[] = [
  { key: 'temperature', label: 'Suhu', unit: '°C', color: '#f59e0b' },
  { key: 'ph', label: 'pH', unit: 'pH', color: '#8b5cf6' },
  { key: 'turbidity', label: 'Turbiditas', unit: 'NTU', color: '#06b6d4' },
  { key: 'water_level_cm', label: 'Muka Air', unit: 'cm', color: '#3b82f6' },
  { key: 'discharge_m3s', label: 'Debit', unit: 'm³/s', color: '#10b981', decimals: 4 },
  { key: 'do_estimated', label: 'DO Estimasi', unit: 'mg/L', color: '#ef4444' },
];

export default function RecapPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [data, setData] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/readings?from=${encodeURIComponent(date + 'T00:00')}&to=${encodeURIComponent(date + 'T23:59')}&limit=1000`
      );
      const json = await res.json();
      setData(Array.isArray(json) ? json.reverse() : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Split data into sessions (gap > 30 menit = sesi baru)
  const sessions: SensorReading[][] = [];
  let current: SensorReading[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) { current.push(data[i]); continue; }
    const gap = new Date(data[i].recorded_at).getTime() - new Date(data[i - 1].recorded_at).getTime();
    if (gap > 30 * 60 * 1000) {
      if (current.length) sessions.push(current);
      current = [data[i]];
    } else {
      current.push(data[i]);
    }
  }
  if (current.length) sessions.push(current);

  return (
    <>
      <Header title="Rekap Harian" subtitle="Statistik dan ringkasan pengambilan data" />
      <div className="p-6 flex flex-col gap-5">

        {/* Date picker */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Tanggal</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 pt-5">
            {['Hari ini', 'Kemarin'].map(label => (
              <button key={label} onClick={() => {
                const d = new Date();
                if (label === 'Kemarin') d.setDate(d.getDate() - 1);
                setDate(d.toISOString().slice(0, 10));
              }}
                className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto pt-5">
            <span className="text-sm text-gray-500">
              {loading ? 'Memuat...' : `${data.length} rekaman · ${sessions.length} sesi`}
            </span>
          </div>
        </div>

        {data.length === 0 && !loading && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">
            Tidak ada data pada tanggal ini
          </div>
        )}

        {data.length > 0 && (
          <>
            {/* Stats grid */}
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Statistik Hari Ini</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {SENSORS.map(({ key, label, unit, color, decimals = 2 }) => {
                  const s = calcStats(data, key);
                  return (
                    <div key={key} className="bg-white rounded-2xl shadow-sm p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">{label}</span>
                        <span className="text-xs text-gray-400">{unit} · {s?.count ?? 0} data</span>
                      </div>
                      {s ? (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { l: 'Min', v: s.min },
                            { l: 'Rata-rata', v: s.avg },
                            { l: 'Max', v: s.max },
                          ].map(({ l, v }) => (
                            <div key={l} className="text-center bg-gray-50 rounded-xl p-2">
                              <p className="text-[10px] text-gray-400 uppercase">{l}</p>
                              <p className="text-base font-bold mt-0.5" style={{ color }}>{v.toFixed(decimals)}</p>
                              <p className="text-[10px] text-gray-400">{unit}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-3">Tidak ada data</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session breakdown */}
            {sessions.length > 1 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-600 mb-3">
                  Sesi Pengambilan Data ({sessions.length} sesi)
                </h2>
                <div className="flex flex-col gap-3">
                  {sessions.map((s, i) => {
                    const start = new Date(s[0].recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const end = new Date(s[s.length - 1].recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const dur = Math.round((new Date(s[s.length - 1].recorded_at).getTime() - new Date(s[0].recorded_at).getTime()) / 60000);
                    return (
                      <div key={i} className="bg-white rounded-2xl shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                            <div>
                              <p className="text-sm font-semibold text-gray-700">Sesi {i + 1}</p>
                              <p className="text-xs text-gray-400">{start} – {end} · {dur} menit · {s.length} data</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                          {SENSORS.map(({ key, label, unit, color, decimals = 2 }) => {
                            const stat = calcStats(s, key);
                            return (
                              <div key={key} className="text-center bg-gray-50 rounded-xl p-2">
                                <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
                                <p className="text-sm font-bold" style={{ color }}>
                                  {stat ? stat.avg.toFixed(decimals) : '—'}
                                </p>
                                <p className="text-[10px] text-gray-400">{unit}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Charts */}
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Grafik Hari Ini</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {SENSORS.map(({ key, label, unit, color }) => (
                  <SensorChart key={key} data={data} dataKey={key} color={color} label={label} unit={unit} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
