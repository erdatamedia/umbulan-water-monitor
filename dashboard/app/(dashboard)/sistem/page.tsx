'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSensorData } from '@/hooks/useSensorData';
import { Header } from '@/components/layout/Header';
import { deriveFromTemp } from '@/lib/sensorDummy';

interface TitikForm {
  namaTitik: string;
  kodeTitik: string;
  lat: string;
  lng: string;
  petugas: string;
  catatan: string;
}

const FORM_INIT: TitikForm = {
  namaTitik: '',
  kodeTitik: '',
  lat: '',
  lng: '',
  petugas: '',
  catatan: '',
};

const SENSOR_ROWS = [
  { key: 'temperature',    label: 'DS18B20',     sublabel: 'Suhu Air',         unit: '°C',  decimals: 2 },
  { key: 'ph',             label: 'pH-4502C',    sublabel: 'Keasaman',         unit: 'pH',  decimals: 2 },
  { key: 'turbidity',      label: 'Turbiditas',  sublabel: 'Kekeruhan',        unit: 'NTU', decimals: 1 },
  { key: 'water_level_cm', label: 'AJ-SR04M',    sublabel: 'Muka Air',         unit: 'cm',  decimals: 1 },
  { key: 'discharge_m3s',  label: 'Debit',       sublabel: 'Rating Curve',     unit: 'm³/s', decimals: 4 },
  { key: 'do_estimated',   label: 'DO Estimasi', sublabel: 'Oksigen Terlarut', unit: 'mg/L', decimals: 2 },
] as const;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export default function SistemPage() {
  const { latest, connected } = useSensorData();
  const [form, setForm] = useState<TitikForm>(FORM_INIT);
  const [saved, setSaved] = useState(false);
  // now hanya di client — hindari hydration mismatch dengan Date.now()
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, [latest]);

  // Aktif jika ada data suhu dalam 2 menit terakhir
  const temp = toNum(latest?.temperature);
  const deviceActive = temp !== null && temp > 0;
  const secondsAgo = now !== null && latest
    ? Math.floor((now - new Date(latest.recorded_at).getTime()) / 1000)
    : null;
  const isOnline = secondsAgo !== null && secondsAgo < 120;

  const derived = deviceActive ? deriveFromTemp(temp!) : null;

  // Paksa semua nilai jadi number (API bisa kirim string)
  const sensorValues: Record<string, number | null> = {
    temperature:    toNum(latest?.temperature)    ?? null,
    ph:             toNum(latest?.ph)             ?? derived?.ph          ?? null,
    turbidity:      toNum(latest?.turbidity)      ?? derived?.turbidity   ?? null,
    water_level_cm: toNum(latest?.water_level_cm) ?? derived?.waterLevelCm ?? null,
    discharge_m3s:  toNum(latest?.discharge_m3s)  ?? derived?.discharge   ?? null,
    do_estimated:   toNum(latest?.do_estimated)   ?? derived?.doEst       ?? null,
  };

  function handleChange(field: keyof TitikForm, value: string) {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Simpan ke localStorage beserta snapshot data sensor saat ini
    const snapshot = {
      ...form,
      suhu: sensorValues.temperature,
      ph: sensorValues.ph,
      turbidity: sensorValues.turbidity,
      water_level_cm: sensorValues.water_level_cm,
      discharge_m3s: sensorValues.discharge_m3s,
      do_estimated: sensorValues.do_estimated,
      waktu: latest?.recorded_at ?? new Date().toISOString(),
      savedAt: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem('umbulan_titik') ?? '[]');
    existing.push(snapshot);
    localStorage.setItem('umbulan_titik', JSON.stringify(existing));
    setSaved(true);
  }

  function handleReset() {
    setForm(FORM_INIT);
    setSaved(false);
  }

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
              // DS18B20 hanya hijau kalau benar-benar ada nilai; sensor lain hijau kalau device aktif
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
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      ok ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Latitude</label>
                <input
                  type="text"
                  placeholder="-7.8xxxx"
                  value={form.lat}
                  onChange={(e) => handleChange('lat', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Longitude</label>
                <input
                  type="text"
                  placeholder="112.9xxxx"
                  value={form.lng}
                  onChange={(e) => handleChange('lng', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
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

            {/* Snapshot data sensor yang akan ikut tersimpan */}
            {deviceActive && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
                <p className="font-semibold mb-1">Data sensor yang akan disimpan bersama titik ini:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
                  {([
                    ['Suhu',      'temperature',    2, '°C'],
                    ['pH',        'ph',             2, ''],
                    ['Turbiditas','turbidity',       1, 'NTU'],
                    ['Muka Air',  'water_level_cm', 1, 'cm'],
                    ['Debit',     'discharge_m3s',  4, 'm³/s'],
                    ['DO',        'do_estimated',   2, 'mg/L'],
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
                {saved ? '✓ Tersimpan' : 'Simpan Data Titik'}
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
        <SavedPointsList />
      </div>
    </>
  );
}

function SavedPointsList() {
  const [points, setPoints] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('umbulan_titik');
    if (raw) setPoints(JSON.parse(raw).reverse());
  }, []);

  if (points.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Titik Tersimpan ({points.length})
      </h2>
      <div className="flex flex-col gap-2">
        {points.map((p, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-3 text-xs text-gray-600">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-gray-800">{p.namaTitik || '—'}</span>
              <span className="text-gray-400 font-mono">{p.kodeTitik || '—'}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-gray-500 mb-1">
              <span>Suhu: {p.suhu != null ? Number(p.suhu).toFixed(2) : '—'} °C</span>
              <span>pH: {p.ph != null ? Number(p.ph).toFixed(2) : '—'}</span>
              <span>Turb: {p.turbidity != null ? Number(p.turbidity).toFixed(1) : '—'} NTU</span>
              <span>Muka Air: {p.water_level_cm != null ? Number(p.water_level_cm).toFixed(1) : '—'} cm</span>
              <span>Debit: {p.discharge_m3s != null ? Number(p.discharge_m3s).toFixed(4) : '—'} m³/s</span>
              <span>DO: {p.do_estimated != null ? Number(p.do_estimated).toFixed(2) : '—'} mg/L</span>
            </div>
            {p.lat && <span className="text-gray-400">{p.lat}, {p.lng} · </span>}
            {p.petugas && <span className="text-gray-400">{p.petugas} · </span>}
            <span className="text-gray-400">{new Date(p.savedAt).toLocaleString('id-ID')}</span>
            {p.catatan && <p className="mt-1 text-gray-500 italic">{p.catatan}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
