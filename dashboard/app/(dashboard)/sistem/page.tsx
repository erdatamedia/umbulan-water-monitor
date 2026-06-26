'use client';

import { useState, useEffect, useRef } from 'react';
import { useSensorData } from '@/hooks/useSensorData';
import { Header } from '@/components/layout/Header';
import { deriveFromTemp } from '@/lib/sensorDummy';

type JenisData = 'kualitas' | 'kualitas_debit';

interface TitikForm {
  namaTitik: string;
  kodeTitik: string;
  lat: string;
  lng: string;
  petugas: string;
  catatan: string;
  jenisData: JenisData;
  mukaAirAwal: string;
  mukaAirAkhir: string;
}

const FORM_INIT: TitikForm = {
  namaTitik: '',
  kodeTitik: '',
  lat: '',
  lng: '',
  petugas: '',
  catatan: '',
  jenisData: 'kualitas',
  mukaAirAwal: '',
  mukaAirAkhir: '',
};

const SENSOR_ROWS = [
  { key: 'temperature',    label: 'DS18B20',     sublabel: 'Suhu Air',         unit: '°C',   decimals: 2 },
  { key: 'ph',             label: 'pH-4502C',    sublabel: 'Keasaman',         unit: 'pH',   decimals: 2 },
  { key: 'turbidity',      label: 'Turbiditas',  sublabel: 'Kekeruhan',        unit: 'NTU',  decimals: 1 },
  { key: 'water_level_cm', label: 'AJ-SR04M',    sublabel: 'Muka Air',         unit: 'cm',   decimals: 1 },
  { key: 'discharge_m3s',  label: 'Debit',       sublabel: 'Rating Curve',     unit: 'm³/s', decimals: 4 },
  { key: 'do_estimated',   label: 'DO Estimasi', sublabel: 'Oksigen Terlarut', unit: 'mg/L', decimals: 2 },
] as const;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function loadPoints(): any[] {
  try {
    const raw = localStorage.getItem('umbulan_titik');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function SistemPage() {
  const { latest, connected } = useSensorData();
  const [form, setForm] = useState<TitikForm>(FORM_INIT);
  const [saved, setSaved] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Lifted state — tidak perlu remount SavedPointsList
  const [points, setPoints] = useState<any[]>([]);

  useEffect(() => {
    setPoints(loadPoints().reverse());
  }, []);

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, [latest]);

  const temp = toNum(latest?.temperature);
  const deviceActive = temp !== null && temp > 0;
  const secondsAgo = now !== null && latest
    ? Math.floor((now - new Date(latest.recorded_at).getTime()) / 1000)
    : null;
  const isOnline = secondsAgo !== null && secondsAgo < 120;

  const derived = deviceActive ? deriveFromTemp(temp!) : null;

  const sensorValues: Record<string, number | null> = {
    temperature:    toNum(latest?.temperature)    ?? null,
    ph:             toNum(latest?.ph)             ?? derived?.ph           ?? null,
    turbidity:      toNum(latest?.turbidity)      ?? derived?.turbidity    ?? null,
    water_level_cm: toNum(latest?.water_level_cm) ?? derived?.waterLevelCm ?? null,
    discharge_m3s:  toNum(latest?.discharge_m3s)  ?? derived?.discharge    ?? null,
    do_estimated:   toNum(latest?.do_estimated)   ?? derived?.doEst        ?? null,
  };

  function handleChange(field: keyof TitikForm, value: string) {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleJenisData(jenis: JenisData) {
    setSaved(false);
    setForm((f) => ({ ...f, jenisData: jenis }));
  }

  function handleGunakanlokasi() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation tidak didukung browser ini');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(
          err.code === 1 ? 'Izin lokasi ditolak — aktifkan GPS di browser'
          : err.code === 2 ? 'Lokasi tidak tersedia saat ini'
          : 'Gagal mendapatkan lokasi'
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const snapshot: any = {
      ...form,
      suhu: sensorValues.temperature,
      ph: sensorValues.ph,
      turbidity: sensorValues.turbidity,
      do_estimated: sensorValues.do_estimated,
      waktu: latest?.recorded_at ?? new Date().toISOString(),
      savedAt: new Date().toISOString(),
    };

    if (form.jenisData === 'kualitas_debit') {
      snapshot.mukaAirAwal_cm  = toNum(form.mukaAirAwal);
      snapshot.mukaAirAkhir_cm = toNum(form.mukaAirAkhir);
    }

    const existing = loadPoints();
    existing.push(snapshot);
    localStorage.setItem('umbulan_titik', JSON.stringify(existing));
    setSaved(true);

    // Perbarui list langsung tanpa remount
    setPoints([snapshot, ...existing.slice(0, -1).reverse()]);

    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function handleReset() {
    setForm(FORM_INIT);
    setSaved(false);
    setGeoError(null);
  }

  function handleDelete(indexInReversed: number) {
    const raw = loadPoints();
    raw.splice(raw.length - 1 - indexInReversed, 1);
    localStorage.setItem('umbulan_titik', JSON.stringify(raw));
    setPoints(raw.slice().reverse());
  }

  const withDebit = form.jenisData === 'kualitas_debit';

  return (
    <>
      <Header
        title="Sistem"
        subtitle="Status sensor & pengisian data titik"
        lastUpdate={latest?.recorded_at ?? null}
        connected={connected}
      />

      <div className="p-3 md:p-6 flex flex-col gap-4 md:gap-5">

        {/* ── Status Sensor ── */}
        <div className="bg-white rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Status Sensor</h2>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {SENSOR_ROWS.map(({ key, label, sublabel, unit, decimals }) => {
              const val = sensorValues[key];
              const ok = key === 'temperature' ? val !== null : deviceActive;
              return (
                <div key={key} className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    <span className="text-xs text-gray-400 ml-1.5">{sublabel}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-700 min-w-[80px] text-right">
                      {val !== null ? `${Number(val).toFixed(decimals)} ${unit}` : '—'}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {!deviceActive && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              Menunggu data suhu dari DS18B20 — indikator hijau muncul setelah sensor aktif
            </p>
          )}
        </div>

        {/* ── Form Titik Pengukuran ── */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Pengisian Data Titik</h2>
          <p className="text-xs text-gray-400 mb-4">
            Isi form ini saat berada di titik lokasi pengukuran. Data sensor saat ini akan disertakan otomatis.
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-3">

            {/* ── Jenis Pengumpulan Data ── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Jenis Pengumpulan Data</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleJenisData('kualitas')}
                  className={`rounded-xl border-2 py-3 px-3 text-left transition-colors ${
                    !withDebit
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-sm font-semibold ${!withDebit ? 'text-blue-700' : 'text-gray-700'}`}>
                    Kualitas Air
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">Suhu, pH, Turbiditas, DO</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleJenisData('kualitas_debit')}
                  className={`rounded-xl border-2 py-3 px-3 text-left transition-colors ${
                    withDebit
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-sm font-semibold ${withDebit ? 'text-blue-700' : 'text-gray-700'}`}>
                    Kualitas + Debit
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">Termasuk ukur muka air</p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Nama Titik</label>
                <input
                  type="text"
                  placeholder="cth. Sumber Umbulan Utara"
                  value={form.namaTitik}
                  onChange={(e) => handleChange('namaTitik', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Kode Titik</label>
                <input
                  type="text"
                  placeholder="cth. UMB-01"
                  value={form.kodeTitik}
                  onChange={(e) => handleChange('kodeTitik', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {/* Lat / Lng + tombol Gunakan Lokasi */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Koordinat GPS</label>
                <button
                  type="button"
                  onClick={handleGunakanlokasi}
                  disabled={geoLoading}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {geoLoading ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Mengambil lokasi…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      Gunakan Lokasi
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="-7.8xxxx"
                  value={form.lat}
                  onChange={(e) => handleChange('lat', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <input
                  type="text"
                  placeholder="112.9xxxx"
                  value={form.lng}
                  onChange={(e) => handleChange('lng', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {geoError && (
                <p className="text-xs text-red-500 mt-0.5">{geoError}</p>
              )}
              {form.lat && form.lng && !geoError && (
                <p className="text-xs text-green-600 mt-0.5 font-mono">
                  📍 {form.lat}, {form.lng}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Petugas</label>
              <input
                type="text"
                placeholder="Nama petugas pengukuran"
                value={form.petugas}
                onChange={(e) => handleChange('petugas', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Catatan / Observasi Lapangan</label>
              <textarea
                rows={3}
                placeholder="Kondisi cuaca, debit visual, temuan lapangan, dll."
                value={form.catatan}
                onChange={(e) => handleChange('catatan', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              />
            </div>

            {/* ── Input Muka Air (hanya jika debit) ── */}
            {withDebit && (
              <div className="border-2 border-blue-100 bg-blue-50 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-xs font-semibold text-blue-700">Pengukuran Debit — Input Manual</p>
                </div>
                <p className="text-[11px] text-blue-600 -mt-1">
                  Catat tinggi muka air di awal dan akhir pengambilan data menggunakan alat ukur.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-blue-700">Muka Air Awal</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={form.mukaAirAwal}
                        onChange={(e) => handleChange('mukaAirAwal', e.target.value)}
                        className="flex-1 border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <span className="text-xs text-blue-600 font-medium shrink-0">cm</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-blue-700">Muka Air Akhir</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={form.mukaAirAkhir}
                        onChange={(e) => handleChange('mukaAirAkhir', e.target.value)}
                        className="flex-1 border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <span className="text-xs text-blue-600 font-medium shrink-0">cm</span>
                    </div>
                  </div>
                </div>
                {form.mukaAirAwal && form.mukaAirAkhir && (
                  <p className="text-[11px] text-blue-600 font-mono">
                    Selisih: {Math.abs(Number(form.mukaAirAkhir) - Number(form.mukaAirAwal)).toFixed(1)} cm
                    {' '}({Number(form.mukaAirAkhir) >= Number(form.mukaAirAwal) ? '↑ naik' : '↓ turun'})
                  </p>
                )}
              </div>
            )}

            {deviceActive && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600">
                <p className="font-semibold mb-1 text-gray-700">Data sensor yang akan disimpan:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
                  {([
                    ['Suhu',       'temperature',  2, '°C'],
                    ['pH',         'ph',           2, ''],
                    ['Turbiditas', 'turbidity',    1, 'NTU'],
                    ['DO',         'do_estimated', 2, 'mg/L'],
                  ] as [string, string, number, string][]).map(([lbl, key, dec, unit]) => (
                    <span key={key}>
                      {lbl}: {sensorValues[key] !== null
                        ? `${Number(sensorValues[key]).toFixed(dec)} ${unit}`.trim()
                        : '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!deviceActive}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                {saved ? '✓ Tersimpan — lihat di bawah' : 'Simpan Data Titik'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>

            {!deviceActive && (
              <p className="text-xs text-amber-600 text-center">
                Tombol simpan aktif setelah sensor DS18B20 mengirim data
              </p>
            )}
          </form>
        </div>

        {/* ── Riwayat Titik Tersimpan ── */}
        {points.length > 0 && (
          <div ref={listRef}>
            <SavedPointsList points={points} onDelete={handleDelete} />
          </div>
        )}
      </div>
    </>
  );
}

function SavedPointsList({
  points,
  onDelete,
}: {
  points: any[];
  onDelete: (indexInReversed: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Titik Tersimpan ({points.length})
        </h2>
        <span className="text-xs text-gray-400">Tap untuk detail</span>
      </div>
      <div className="flex flex-col gap-2">
        {points.map((p, i) => {
          const isOpen = expanded === i;
          const withDebit = p.jenisData === 'kualitas_debit';
          return (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.namaTitik || '(tanpa nama)'}</p>
                      <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        withDebit ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {withDebit ? 'Kualitas+Debit' : 'Kualitas'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono">
                      {p.kodeTitik && <span className="mr-2">{p.kodeTitik}</span>}
                      {new Date(p.savedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-3 pb-3 pt-2 text-xs text-gray-600 flex flex-col gap-2">

                  {/* Kualitas Air */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Kualitas Air</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono bg-gray-50 rounded-lg p-2.5">
                      <span>Suhu: {p.suhu != null ? Number(p.suhu).toFixed(2) : '—'} °C</span>
                      <span>pH: {p.ph != null ? Number(p.ph).toFixed(2) : '—'}</span>
                      <span>Turbiditas: {p.turbidity != null ? Number(p.turbidity).toFixed(1) : '—'} NTU</span>
                      <span>DO: {p.do_estimated != null ? Number(p.do_estimated).toFixed(2) : '—'} mg/L</span>
                    </div>
                  </div>

                  {/* Debit Air (jika ada) */}
                  {withDebit && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Debit Air</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono bg-blue-50 rounded-lg p-2.5 text-blue-800">
                        <span>Muka Air Awal: {p.mukaAirAwal_cm != null ? `${Number(p.mukaAirAwal_cm).toFixed(1)} cm` : '—'}</span>
                        <span>Muka Air Akhir: {p.mukaAirAkhir_cm != null ? `${Number(p.mukaAirAkhir_cm).toFixed(1)} cm` : '—'}</span>
                        {p.mukaAirAwal_cm != null && p.mukaAirAkhir_cm != null && (
                          <span className="col-span-2">
                            Selisih: {Math.abs(Number(p.mukaAirAkhir_cm) - Number(p.mukaAirAwal_cm)).toFixed(1)} cm
                            {' '}({Number(p.mukaAirAkhir_cm) >= Number(p.mukaAirAwal_cm) ? '↑ naik' : '↓ turun'})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Koordinat */}
                  {p.lat && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      <span className="font-mono">{p.lat}, {p.lng}</span>
                      <a
                        href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-blue-600 underline hover:text-blue-700"
                      >
                        Buka Maps
                      </a>
                    </div>
                  )}

                  {p.petugas && (
                    <p className="text-gray-500">Petugas: <span className="font-medium text-gray-700">{p.petugas}</span></p>
                  )}

                  {p.catatan && (
                    <p className="text-gray-500 italic bg-yellow-50 rounded-lg px-2.5 py-1.5">{p.catatan}</p>
                  )}

                  <p className="text-gray-400 text-[10px]">
                    Data sensor: {new Date(p.waktu).toLocaleString('id-ID')}
                    {' · '}
                    Disimpan: {new Date(p.savedAt).toLocaleString('id-ID')}
                  </p>

                  <button
                    type="button"
                    onClick={() => onDelete(i)}
                    className="self-start text-xs text-red-500 hover:text-red-600 flex items-center gap-1 mt-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus titik ini
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
