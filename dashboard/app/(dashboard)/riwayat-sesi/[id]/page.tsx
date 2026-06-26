'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { useSensorData } from '@/hooks/useSensorData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Snapshot {
  id: number;
  sesi_id: number;
  waktu: string;
  temperature: number | null;
  ph: number | null;
  turbidity: number | null;
  do_estimated: number | null;
  water_level_cm: number | null;
  discharge_m3s: number | null;
}

interface SesiDetail {
  id: number;
  titik: string;
  kode_titik: string | null;
  lat: number | null;
  lng: number | null;
  petugas: string | null;
  jenis: 'kualitas' | 'kualitas_debit';
  waktu_mulai: string;
  waktu_selesai: string | null;
  muka_air_awal_cm: number | null;
  muka_air_akhir_cm: number | null;
  catatan: string | null;
  status: 'aktif' | 'selesai';
  snapshots: Snapshot[];
}

function fmt(v: number | null, d: number, unit: string) {
  return v != null ? `${Number(v).toFixed(d)} ${unit}`.trim() : '—';
}

function formatDurasi(mulai: string, selesai: string | null) {
  if (!selesai) return null;
  const ms = new Date(selesai).getTime() - new Date(mulai).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} jam ${m % 60} menit`;
  return `${m} menit`;
}

const CHART_FIELDS = [
  { key: 'temperature',   label: 'Suhu',        unit: '°C',   color: '#f97316', decimals: 2 },
  { key: 'ph',            label: 'pH',          unit: '',     color: '#8b5cf6', decimals: 2 },
  { key: 'turbidity',     label: 'Turbiditas',  unit: 'NTU',  color: '#06b6d4', decimals: 1 },
  { key: 'do_estimated',  label: 'DO',          unit: 'mg/L', color: '#10b981', decimals: 2 },
] as const;

export default function DetailSesiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { connected, latest } = useSensorData();
  const [sesi, setSesi] = useState<SesiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<string>('temperature');

  useEffect(() => {
    fetch(`/api/sesi/${id}`)
      .then(r => r.json())
      .then(data => { setSesi(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // Refresh tiap 30d jika sesi masih aktif
  useEffect(() => {
    if (!sesi || sesi.status !== 'aktif') return;
    const t = setInterval(() => {
      fetch(`/api/sesi/${id}`)
        .then(r => r.json())
        .then(setSesi)
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, [id, sesi?.status]);

  if (loading) {
    return (
      <>
        <Header title="Detail Sesi" subtitle="" lastUpdate={null} connected={connected} />
        <div className="p-6 text-center text-sm text-gray-400">Memuat…</div>
      </>
    );
  }

  if (!sesi) {
    return (
      <>
        <Header title="Detail Sesi" subtitle="" lastUpdate={null} connected={connected} />
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500">Sesi tidak ditemukan.</p>
          <Link href="/riwayat-sesi" className="text-xs text-blue-600 hover:underline mt-1 block">← Kembali</Link>
        </div>
      </>
    );
  }

  const withDebit = sesi.jenis === 'kualitas_debit';
  const snapshots = sesi.snapshots ?? [];
  const durasi = formatDurasi(sesi.waktu_mulai, sesi.waktu_selesai);

  const chartData = snapshots.map(s => ({
    ...s,
    waktuLabel: new Date(s.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  }));

  const field = CHART_FIELDS.find(f => f.key === activeChart)!;

  // Statistik ringkas
  function stat(key: keyof Snapshot) {
    const vals = snapshots.map(s => s[key]).filter((v): v is number => v != null);
    if (!vals.length) return { min: null, max: null, avg: null };
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    };
  }

  return (
    <>
      <Header
        title={sesi.titik}
        subtitle={sesi.kode_titik ?? 'Detail sesi'}
        lastUpdate={latest?.recorded_at ?? null}
        connected={connected}
      />
      <div className="p-3 md:p-6 flex flex-col gap-4">

        {/* Back */}
        <Link href="/riwayat-sesi" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke Riwayat Sesi
        </Link>

        {/* Info sesi */}
        <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {sesi.status === 'aktif' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  sesi.status === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {sesi.status === 'aktif' ? 'Sedang Berlangsung' : 'Selesai'}
                </span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  withDebit ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {withDebit ? 'Kualitas+Debit' : 'Kualitas'}
                </span>
              </div>
              <h2 className="text-base font-bold text-gray-800">{sesi.titik}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400">Mulai</p>
              <p className="font-medium">{new Date(sesi.waktu_mulai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400">Selesai</p>
              <p className="font-medium">
                {sesi.waktu_selesai
                  ? new Date(sesi.waktu_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </p>
            </div>
            {durasi && (
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Durasi</p>
                <p className="font-medium">{durasi}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400">Snapshot</p>
              <p className="font-medium">{snapshots.length} data</p>
            </div>
            {sesi.petugas && (
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Petugas</p>
                <p className="font-medium">{sesi.petugas}</p>
              </div>
            )}
            {sesi.lat && (
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Koordinat</p>
                <a href={`https://maps.google.com/?q=${sesi.lat},${sesi.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[11px] text-blue-600 hover:underline">
                  {Number(sesi.lat).toFixed(4)}, {Number(sesi.lng).toFixed(4)}
                </a>
              </div>
            )}
          </div>

          {withDebit && (
            <div className="mt-3 bg-blue-50 rounded-xl px-3 py-2.5 text-xs">
              <p className="text-[10px] font-semibold text-blue-600 mb-1.5">Pengukuran Debit</p>
              <div className="flex gap-6 font-mono text-blue-800">
                <span>Muka Air Awal: <strong>{fmt(sesi.muka_air_awal_cm, 1, 'cm')}</strong></span>
                <span>Muka Air Akhir: <strong>{fmt(sesi.muka_air_akhir_cm, 1, 'cm')}</strong></span>
                {sesi.muka_air_awal_cm != null && sesi.muka_air_akhir_cm != null && (
                  <span>Δ <strong>{Math.abs(sesi.muka_air_akhir_cm - sesi.muka_air_awal_cm).toFixed(1)} cm</strong></span>
                )}
              </div>
            </div>
          )}

          {sesi.catatan && (
            <div className="mt-3 bg-yellow-50 rounded-xl px-3 py-2 text-xs text-gray-600 italic">{sesi.catatan}</div>
          )}
        </div>

        {/* Grafik */}
        {snapshots.length > 1 && (
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Grafik Selama Sesi</h3>

            {/* Pilih parameter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {CHART_FIELDS.map(f => (
                <button key={f.key} onClick={() => setActiveChart(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    activeChart === f.key ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  style={activeChart === f.key ? { backgroundColor: f.color } : {}}>
                  {f.label}
                </button>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="waktuLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={45}
                  tickFormatter={v => `${Number(v).toFixed(field.decimals)}`} />
                <Tooltip
                  formatter={(v: any) => [`${Number(v).toFixed(field.decimals)} ${field.unit}`.trim(), field.label]}
                  labelFormatter={l => `Pukul ${l}`}
                  contentStyle={{ fontSize: 11 }}
                />
                <Line type="monotone" dataKey={field.key} stroke={field.color}
                  strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Statistik ringkas */}
        {snapshots.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Statistik Kualitas Air</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-100">
                    <th className="pb-2 font-medium">Parameter</th>
                    <th className="pb-2 font-medium text-right">Min</th>
                    <th className="pb-2 font-medium text-right">Maks</th>
                    <th className="pb-2 font-medium text-right">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {CHART_FIELDS.map(f => {
                    const { min, max, avg } = stat(f.key as keyof Snapshot);
                    return (
                      <tr key={f.key} className="border-b border-gray-50">
                        <td className="py-2 font-medium text-gray-700">{f.label}</td>
                        <td className="py-2 text-right font-mono text-gray-600">
                          {min != null ? `${min.toFixed(f.decimals)} ${f.unit}`.trim() : '—'}
                        </td>
                        <td className="py-2 text-right font-mono text-gray-600">
                          {max != null ? `${max.toFixed(f.decimals)} ${f.unit}`.trim() : '—'}
                        </td>
                        <td className="py-2 text-right font-mono text-gray-600">
                          {avg != null ? `${avg.toFixed(f.decimals)} ${f.unit}`.trim() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabel snapshot */}
        {snapshots.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Data Snapshot ({snapshots.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-100">
                    <th className="pb-2 font-medium">Waktu</th>
                    <th className="pb-2 font-medium text-right">Suhu</th>
                    <th className="pb-2 font-medium text-right">pH</th>
                    <th className="pb-2 font-medium text-right">Turbiditas</th>
                    <th className="pb-2 font-medium text-right">DO</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 font-mono">
                      <td className="py-1.5 text-gray-500">
                        {new Date(s.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-1.5 text-right">{fmt(s.temperature, 2, '°C')}</td>
                      <td className="py-1.5 text-right">{fmt(s.ph, 2, '')}</td>
                      <td className="py-1.5 text-right">{fmt(s.turbidity, 1, 'NTU')}</td>
                      <td className="py-1.5 text-right">{fmt(s.do_estimated, 2, 'mg/L')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {snapshots.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-center text-sm text-gray-400">
            Belum ada snapshot terekam untuk sesi ini.
          </div>
        )}
      </div>
    </>
  );
}
