'use client';

import { useEffect, useState, useCallback } from 'react';
import { SensorReading } from '@/lib/types';
import { Header } from '@/components/layout/Header';
import { SensorChart } from '@/components/SensorChart';

const API = process.env.NEXT_PUBLIC_API_URL;

function fmt(v: number | null, d = 2) {
  return v !== null && v !== undefined ? Number(v).toFixed(d) : '—';
}

function toLocalDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 16);
}

export default function HistoryPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${todayStr}T00:00`);
  const [to, setTo] = useState(`${todayStr}T23:59`);
  const [data, setData] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/readings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=1000`
      );
      const json = await res.json();
      setData(Array.isArray(json) ? json.reverse() : []);
      setPage(1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function exportCSV() {
    const headers = ['id', 'device_id', 'recorded_at', 'temperature', 'ph', 'turbidity', 'water_level_cm', 'discharge_m3s', 'do_estimated'];
    const rows = data.map(r =>
      headers.map(h => (r as unknown as Record<string, unknown>)[h] ?? '').join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `umbulan_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Header title="Riwayat Data" subtitle="Filter dan ekspor data pengukuran" />
      <div className="p-6 flex flex-col gap-5">

        {/* Filter bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Dari</label>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Sampai</label>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            {['Hari ini', 'Kemarin', '7 hari'].map((label) => (
              <button key={label} onClick={() => {
                const now = new Date();
                if (label === 'Hari ini') {
                  setFrom(`${now.toISOString().slice(0, 10)}T00:00`);
                  setTo(`${now.toISOString().slice(0, 10)}T23:59`);
                } else if (label === 'Kemarin') {
                  const y = new Date(now); y.setDate(y.getDate() - 1);
                  const d = y.toISOString().slice(0, 10);
                  setFrom(`${d}T00:00`); setTo(`${d}T23:59`);
                } else {
                  const w = new Date(now); w.setDate(w.getDate() - 7);
                  setFrom(`${w.toISOString().slice(0, 10)}T00:00`);
                  setTo(`${now.toISOString().slice(0, 10)}T23:59`);
                }
              }}
                className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
              {label}
            </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Tampilkan
            </button>
            <button onClick={exportCSV} disabled={data.length === 0}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary row */}
        {data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Data', value: data.length.toString(), unit: 'rekaman' },
              { label: 'Periode', value: `${from.slice(0, 10)}`, unit: `s/d ${to.slice(0, 10)}` },
              { label: 'Perangkat', value: data[0]?.device_id ?? '—', unit: 'device' },
              {
                label: 'Durasi', value: (() => {
                  const diff = new Date(data[data.length - 1].recorded_at).getTime() - new Date(data[0].recorded_at).getTime();
                  const m = Math.floor(diff / 60000);
                  return m < 60 ? `${m}` : `${Math.floor(m / 60)}j ${m % 60}`;
                })(), unit: 'menit'
              },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
                <p className="text-xl font-bold text-gray-800 mt-1">{s.value}</p>
                <p className="text-xs text-gray-400">{s.unit}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        {data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SensorChart data={data} dataKey="temperature" color="#f59e0b" label="Suhu" unit="°C" />
            <SensorChart data={data} dataKey="ph" color="#8b5cf6" label="pH" unit="pH" />
            <SensorChart data={data} dataKey="turbidity" color="#06b6d4" label="Turbiditas" unit="NTU" />
            <SensorChart data={data} dataKey="water_level_cm" color="#3b82f6" label="Muka Air" unit="cm" />
            <SensorChart data={data} dataKey="discharge_m3s" color="#10b981" label="Debit" unit="m³/s" />
            <SensorChart data={data} dataKey="do_estimated" color="#ef4444" label="DO Estimasi" unit="mg/L" />
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {loading ? 'Memuat...' : `${data.length} data`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-50">‹</button>
                <span className="text-gray-500">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-50">›</button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  {['Waktu', 'Device', 'Suhu (°C)', 'pH', 'Turbiditas (NTU)', 'Muka Air (cm)', 'Debit (m³/s)', 'DO (mg/L)'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat data...</td></tr>
                ) : pageData.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada data pada rentang waktu ini</td></tr>
                ) : pageData.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 font-mono text-xs">
                      {new Date(r.recorded_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.device_id}</td>
                    <td className="px-4 py-2.5 font-medium text-amber-600">{fmt(r.temperature)}</td>
                    <td className="px-4 py-2.5 font-medium text-purple-600">{fmt(r.ph)}</td>
                    <td className="px-4 py-2.5 font-medium text-cyan-600">{fmt(r.turbidity)}</td>
                    <td className="px-4 py-2.5 font-medium text-blue-600">{fmt(r.water_level_cm)}</td>
                    <td className="px-4 py-2.5 font-medium text-emerald-600">{fmt(r.discharge_m3s, 4)}</td>
                    <td className="px-4 py-2.5 font-medium text-red-500">{fmt(r.do_estimated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
