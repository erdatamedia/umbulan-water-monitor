'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { useSensorData } from '@/hooks/useSensorData';

interface Sesi {
  id: number;
  titik: string;
  kode_titik: string | null;
  petugas: string | null;
  jenis: 'kualitas' | 'kualitas_debit';
  waktu_mulai: string;
  waktu_selesai: string | null;
  muka_air_awal_cm: number | null;
  muka_air_akhir_cm: number | null;
  catatan: string | null;
  status: 'aktif' | 'selesai';
}

function formatDurasi(mulai: string, selesai: string | null) {
  if (!selesai) return null;
  const ms = new Date(selesai).getTime() - new Date(mulai).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}j ${m % 60}m`;
  return `${m}m`;
}

export default function RiwayatSesiPage() {
  const { connected, latest } = useSensorData();
  const [sesi, setSesi] = useState<Sesi[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'semua' | 'selesai' | 'aktif'>('semua');

  useEffect(() => {
    const url = filter === 'semua' ? '/api/sesi?limit=100' : `/api/sesi?status=${filter}&limit=100`;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(rows => { setSesi(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <>
      <Header
        title="Riwayat Sesi"
        subtitle="Daftar sesi pengambilan data"
        lastUpdate={latest?.recorded_at ?? null}
        connected={connected}
      />
      <div className="p-3 md:p-6 flex flex-col gap-4">

        {/* Filter */}
        <div className="flex gap-2">
          {(['semua', 'selesai', 'aktif'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}>
              {f === 'semua' ? 'Semua' : f === 'selesai' ? 'Selesai' : 'Sedang Berlangsung'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-8">Memuat…</div>
        ) : sesi.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-sm text-gray-400">Belum ada sesi pengambilan data.</p>
            <Link href="/sistem" className="mt-2 inline-block text-xs text-blue-600 hover:underline">
              Mulai sesi baru →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sesi.map(s => {
              const durasi = formatDurasi(s.waktu_mulai, s.waktu_selesai);
              const withDebit = s.jenis === 'kualitas_debit';
              const aktif = s.status === 'aktif';
              return (
                <Link key={s.id} href={`/riwayat-sesi/${s.id}`}
                  className="bg-white rounded-2xl shadow p-4 hover:shadow-md transition-shadow block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {aktif && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />}
                        <p className="text-sm font-semibold text-gray-800 truncate">{s.titik}</p>
                        <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          withDebit ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {withDebit ? 'Kualitas+Debit' : 'Kualitas'}
                        </span>
                      </div>
                      {s.kode_titik && <p className="text-[10px] text-gray-400 font-mono">{s.kode_titik}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        aktif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {aktif ? 'Aktif' : 'Selesai'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span>
                      {new Date(s.waktu_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {new Date(s.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      {s.waktu_selesai && (
                        <> – {new Date(s.waktu_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</>
                      )}
                    </span>
                    {durasi && <span className="text-gray-400">{durasi}</span>}
                    {s.petugas && <span>{s.petugas}</span>}
                  </div>

                  {withDebit && (s.muka_air_awal_cm != null || s.muka_air_akhir_cm != null) && (
                    <div className="mt-2 flex gap-3 text-[11px] text-blue-700 font-mono bg-blue-50 rounded-lg px-2.5 py-1.5">
                      {s.muka_air_awal_cm != null && <span>Awal: {Number(s.muka_air_awal_cm).toFixed(1)} cm</span>}
                      {s.muka_air_akhir_cm != null && <span>Akhir: {Number(s.muka_air_akhir_cm).toFixed(1)} cm</span>}
                      {s.muka_air_awal_cm != null && s.muka_air_akhir_cm != null && (
                        <span>Δ {Math.abs(s.muka_air_akhir_cm - s.muka_air_awal_cm).toFixed(1)} cm</span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
