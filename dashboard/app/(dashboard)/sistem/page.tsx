'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSensorData } from '@/hooks/useSensorData';
import { Header } from '@/components/layout/Header';

type JenisData = 'kualitas' | 'kualitas_debit';

interface SesiAktif {
  id: number;
  titik: string;
  kode_titik: string | null;
  lat: number | null;
  lng: number | null;
  petugas: string | null;
  jenis: JenisData;
  waktu_mulai: string;
  muka_air_awal_cm: number | null;
  catatan: string | null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}j ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}d`;
  return `${s}d`;
}

export default function SistemPage() {
  const { latest, connected } = useSensorData();
  const [sesiAktif, setSesiAktif] = useState<SesiAktif | null>(null);
  const [loading, setLoading] = useState(true);

  // Check sesi aktif dari server saat halaman dibuka
  useEffect(() => {
    fetch('/api/sesi?status=aktif&limit=1')
      .then(r => r.json())
      .then((rows: SesiAktif[]) => {
        setSesiAktif(rows[0] ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sensorValues = {
    temperature:    toNum(latest?.temperature),
    ph:             toNum(latest?.ph),
    turbidity:      toNum(latest?.turbidity),
    do_estimated:   toNum(latest?.do_estimated),
    water_level_cm: toNum(latest?.water_level_cm),
    discharge_m3s:  toNum(latest?.discharge_m3s),
  };

  const temp = sensorValues.temperature;
  const deviceActive = temp !== null && temp > 0;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsAgo = latest
    ? Math.floor((now - new Date(latest.recorded_at).getTime()) / 1000)
    : null;
  const isOnline = secondsAgo !== null && secondsAgo < 120;

  if (loading) {
    return (
      <>
        <Header title="Sistem" subtitle="Manajemen sesi pengambilan data" lastUpdate={null} connected={connected} />
        <div className="p-6 flex items-center justify-center text-gray-400 text-sm">Memuat…</div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Sistem"
        subtitle="Manajemen sesi pengambilan data"
        lastUpdate={latest?.recorded_at ?? null}
        connected={connected}
      />
      <div className="p-3 md:p-6 flex flex-col gap-4 md:gap-5">

        {/* Status Sensor */}
        <SensorStatus sensorValues={sensorValues} isOnline={isOnline} deviceActive={deviceActive} now={now} latest={latest} />

        {/* Panel utama */}
        {sesiAktif
          ? <SesiAktifPanel
              sesi={sesiAktif}
              sensorValues={sensorValues}
              deviceActive={deviceActive}
              now={now}
              onSelesai={(s) => setSesiAktif(null)}
            />
          : <MulaiSesiPanel
              sensorValues={sensorValues}
              deviceActive={deviceActive}
              onMulai={(s) => setSesiAktif(s)}
            />
        }
      </div>
    </>
  );
}

/* ─── Status Sensor Card ─── */
const SENSOR_ROWS = [
  { key: 'temperature',    label: 'Suhu',        unit: '°C',   decimals: 2 },
  { key: 'ph',             label: 'pH',          unit: '',     decimals: 2 },
  { key: 'turbidity',      label: 'Turbiditas',  unit: 'NTU',  decimals: 1 },
  { key: 'do_estimated',   label: 'DO Estimasi', unit: 'mg/L', decimals: 2 },
  { key: 'water_level_cm', label: 'Muka Air',    unit: 'cm',   decimals: 1 },
  { key: 'discharge_m3s',  label: 'Debit',       unit: 'm³/s', decimals: 4 },
] as const;

function SensorStatus({ sensorValues, isOnline, deviceActive, now, latest }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Status Sensor</h2>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
        }`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SENSOR_ROWS.map(({ key, label, unit, decimals }) => {
          const val = sensorValues[key];
          return (
            <div key={key} className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-sm font-mono font-semibold text-gray-800 mt-0.5">
                {val !== null ? `${Number(val).toFixed(decimals)}${unit ? ' ' + unit : ''}` : '—'}
              </p>
            </div>
          );
        })}
      </div>
      {!deviceActive && (
        <p className="text-xs text-gray-400 mt-3 text-center">Menunggu data suhu dari DS18B20</p>
      )}
    </div>
  );
}

/* ─── Form Mulai Sesi ─── */
function MulaiSesiPanel({ sensorValues, deviceActive, onMulai }: {
  sensorValues: Record<string, number | null>;
  deviceActive: boolean;
  onMulai: (sesi: SesiAktif) => void;
}) {
  const [jenis, setJenis] = useState<JenisData>('kualitas');
  const [form, setForm] = useState({ titik: '', kodeTitik: '', petugas: '', catatan: '' });
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [mukaAirAwal, setMukaAirAwal] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGPS() {
    if (!navigator.geolocation) { setGeoError('Geolocation tidak didukung'); return; }
    setGeoLoading(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Izin lokasi ditolak' : 'Gagal mendapatkan lokasi');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titik) { setError('Nama titik wajib diisi'); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titik: form.titik,
          kode_titik: form.kodeTitik || null,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          petugas: form.petugas || null,
          jenis,
          muka_air_awal_cm: jenis === 'kualitas_debit' && mukaAirAwal ? parseFloat(mukaAirAwal) : null,
          catatan: form.catatan || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const sesi = await res.json();
      onMulai(sesi);
    } catch (err: any) {
      setError(err.message ?? 'Gagal memulai sesi');
    } finally {
      setSubmitting(false);
    }
  }

  const withDebit = jenis === 'kualitas_debit';

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Mulai Sesi Pengambilan Data</h2>
      <p className="text-xs text-gray-400 mb-4">
        Isi informasi titik, lalu tekan Mulai Sesi. Sensor akan direkam otomatis tiap menit selama sesi berlangsung.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">

        {/* Jenis data */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Jenis Pengumpulan Data</label>
          <div className="grid grid-cols-2 gap-2">
            {(['kualitas', 'kualitas_debit'] as JenisData[]).map((j) => (
              <button key={j} type="button" onClick={() => setJenis(j)}
                className={`rounded-xl border-2 py-3 px-3 text-left transition-colors ${
                  jenis === j ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                <p className={`text-sm font-semibold ${jenis === j ? 'text-blue-700' : 'text-gray-700'}`}>
                  {j === 'kualitas' ? 'Kualitas Air' : 'Kualitas + Debit'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                  {j === 'kualitas' ? 'Suhu, pH, Turbiditas, DO' : 'Termasuk ukur muka air'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Nama & kode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Nama Titik <span className="text-red-400">*</span></label>
            <input type="text" placeholder="cth. Sumber Umbulan Utara"
              value={form.titik} onChange={e => setForm(f => ({ ...f, titik: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Kode Titik</label>
            <input type="text" placeholder="cth. UMB-01"
              value={form.kodeTitik} onChange={e => setForm(f => ({ ...f, kodeTitik: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>

        {/* GPS */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">Koordinat GPS</label>
            <button type="button" onClick={handleGPS} disabled={geoLoading}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors">
              {geoLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              )}
              {geoLoading ? 'Mengambil…' : 'Gunakan Lokasi'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="-7.8xxxx" value={lat} onChange={e => setLat(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <input type="text" placeholder="112.9xxxx" value={lng} onChange={e => setLng(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          {geoError && <p className="text-xs text-red-500">{geoError}</p>}
          {lat && lng && !geoError && <p className="text-xs text-green-600 font-mono">📍 {lat}, {lng}</p>}
        </div>

        {/* Petugas */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Petugas</label>
          <input type="text" placeholder="Nama petugas"
            value={form.petugas} onChange={e => setForm(f => ({ ...f, petugas: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>

        {/* Muka air awal (jika debit) */}
        {withDebit && (
          <div className="border-2 border-blue-100 bg-blue-50 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-blue-700">Muka Air Awal — dicatat saat mulai sesi</p>
            <div className="flex items-center gap-2">
              <input type="number" step="0.1" placeholder="0.0"
                value={mukaAirAwal} onChange={e => setMukaAirAwal(e.target.value)}
                className="w-32 border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <span className="text-sm text-blue-600 font-medium">cm</span>
            </div>
          </div>
        )}

        {/* Catatan */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Catatan awal</label>
          <textarea rows={2} placeholder="Kondisi lapangan, cuaca, dll."
            value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={submitting || !deviceActive}
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
          {submitting ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>Memulai…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Mulai Sesi
            </>
          )}
        </button>
        {!deviceActive && (
          <p className="text-xs text-amber-600 text-center">Tombol aktif setelah sensor DS18B20 mengirim data</p>
        )}
      </form>
    </div>
  );
}

/* ─── Panel Sesi Aktif ─── */
function SesiAktifPanel({ sesi, sensorValues, deviceActive, now, onSelesai }: {
  sesi: SesiAktif;
  sensorValues: Record<string, number | null>;
  deviceActive: boolean;
  now: number;
  onSelesai: (s: any) => void;
}) {
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [showAkhiri, setShowAkhiri] = useState(false);
  const [mukaAirAkhir, setMukaAirAkhir] = useState('');
  const [catatanAkhir, setCatatanAkhir] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sensorRef = useRef(sensorValues);
  sensorRef.current = sensorValues;

  const durasi = now - new Date(sesi.waktu_mulai).getTime();
  const withDebit = sesi.jenis === 'kualitas_debit';

  // Ambil jumlah snapshot awal
  useEffect(() => {
    fetch(`/api/sesi/${sesi.id}/snapshot`)
      .then(r => r.json())
      .then((rows: any[]) => {
        setSnapshotCount(rows.length);
        if (rows.length > 0) setLastSnapshot(rows[rows.length - 1].waktu);
      })
      .catch(() => {});
  }, [sesi.id]);

  // Auto-snapshot tiap 60 detik
  const postSnapshot = useCallback(async () => {
    const vals = sensorRef.current;
    if (!vals.temperature) return;
    try {
      await fetch(`/api/sesi/${sesi.id}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      setSnapshotCount(n => n + 1);
      setLastSnapshot(new Date().toISOString());
    } catch {}
  }, [sesi.id]);

  useEffect(() => {
    // Snapshot pertama segera
    postSnapshot();
    const t = setInterval(postSnapshot, 60_000);
    return () => clearInterval(t);
  }, [postSnapshot]);

  async function handleAkhiri(e: React.FormEvent) {
    e.preventDefault();
    setFinishing(true); setError(null);
    try {
      const res = await fetch(`/api/sesi/${sesi.id}/akhiri`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          muka_air_akhir_cm: withDebit && mukaAirAkhir ? parseFloat(mukaAirAkhir) : null,
          catatan: catatanAkhir || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSelesai(await res.json());
    } catch (err: any) {
      setError(err.message ?? 'Gagal mengakhiri sesi');
      setFinishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Sesi info card */}
      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Sesi Berlangsung</span>
            </div>
            <p className="text-lg font-bold text-gray-800">{sesi.titik}</p>
            {sesi.kode_titik && <p className="text-xs text-gray-500 font-mono">{sesi.kode_titik}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-mono font-bold text-green-700">{formatDuration(durasi)}</p>
            <p className="text-[10px] text-gray-400">durasi</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="bg-white rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400">Mulai</p>
            <p className="font-medium">{new Date(sesi.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400">Skema</p>
            <p className="font-medium">{withDebit ? 'Kualitas + Debit' : 'Kualitas Air'}</p>
          </div>
          {sesi.petugas && (
            <div className="bg-white rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400">Petugas</p>
              <p className="font-medium">{sesi.petugas}</p>
            </div>
          )}
          {sesi.lat && (
            <div className="bg-white rounded-xl px-3 py-2">
              <p className="text-[10px] text-gray-400">Koordinat</p>
              <p className="font-mono text-[11px]">{sesi.lat?.toFixed(4)}, {sesi.lng?.toFixed(4)}</p>
            </div>
          )}
        </div>

        {withDebit && sesi.muka_air_awal_cm != null && (
          <div className="mt-2 bg-blue-50 rounded-xl px-3 py-2 text-xs">
            <span className="text-blue-600 font-medium">Muka Air Awal: </span>
            <span className="font-mono text-blue-800">{Number(sesi.muka_air_awal_cm).toFixed(1)} cm</span>
          </div>
        )}

        {/* Snapshot counter */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-gray-500">
            <span className="font-semibold text-gray-700">{snapshotCount}</span> snapshot terekam
          </span>
          {lastSnapshot && (
            <span className="text-gray-400">
              terakhir {new Date(lastSnapshot).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Snapshot otomatis setiap 60 detik selama sesi berlangsung</p>
      </div>

      {/* Tombol Akhiri */}
      {!showAkhiri ? (
        <button onClick={() => setShowAkhiri(true)}
          className="w-full bg-red-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
          Akhiri Sesi
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Konfirmasi Akhiri Sesi</h3>
          <p className="text-xs text-gray-400 mb-4">
            Durasi: <span className="font-semibold text-gray-600">{formatDuration(durasi)}</span>
            {' · '}Total snapshot: <span className="font-semibold text-gray-600">{snapshotCount}</span>
          </p>

          <form onSubmit={handleAkhiri} className="flex flex-col gap-3">
            {withDebit && (
              <div className="border-2 border-blue-100 bg-blue-50 rounded-xl p-4 flex flex-col gap-2">
                <p className="text-xs font-semibold text-blue-700">Muka Air Akhir — dicatat saat mengakhiri sesi</p>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.1" placeholder="0.0"
                    value={mukaAirAkhir} onChange={e => setMukaAirAkhir(e.target.value)}
                    className="w-32 border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <span className="text-sm text-blue-600 font-medium">cm</span>
                </div>
                {sesi.muka_air_awal_cm != null && mukaAirAkhir && (
                  <p className="text-[11px] text-blue-600 font-mono">
                    Selisih: {Math.abs(parseFloat(mukaAirAkhir) - sesi.muka_air_awal_cm).toFixed(1)} cm
                    {' '}({parseFloat(mukaAirAkhir) >= sesi.muka_air_awal_cm ? '↑ naik' : '↓ turun'})
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Catatan penutup (opsional)</label>
              <textarea rows={2} placeholder="Observasi akhir, kondisi lapangan, dll."
                value={catatanAkhir} onChange={e => setCatatanAkhir(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={finishing}
                className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors">
                {finishing ? 'Menyimpan…' : 'Konfirmasi Selesai'}
              </button>
              <button type="button" onClick={() => setShowAkhiri(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
