'use client';

import { SensorReading } from '@/lib/types';

interface DeviceStatusProps {
  latest: SensorReading | null;
}

const SENSORS: { key: keyof SensorReading; label: string; unit: string }[] = [
  { key: 'temperature', label: 'DS18B20 (Suhu)', unit: '°C' },
  { key: 'ph', label: 'pH-4502C', unit: 'pH' },
  { key: 'turbidity', label: 'Turbiditas', unit: 'NTU' },
  { key: 'water_level_cm', label: 'AJ-SR04M (Muka Air)', unit: 'cm' },
  { key: 'discharge_m3s', label: 'Debit (Kalkulasi)', unit: 'm³/s' },
  { key: 'do_estimated', label: 'DO (Estimasi)', unit: 'mg/L' },
];

export function DeviceStatus({ latest }: DeviceStatusProps) {
  const deviceConnected = latest !== null;
  const secondsAgo = latest
    ? Math.floor((Date.now() - new Date(latest.recorded_at).getTime()) / 1000)
    : null;
  const isOnline = secondsAgo !== null && secondsAgo < 120;

  // Semua sensor dianggap aktif selama DS18B20 mengirim data
  const deviceActive = isOnline && (latest?.temperature ?? null) !== null;

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Status Perangkat &amp; Sensor</h2>

      {/* Device row */}
      <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-3">
        <div>
          <span className="text-sm font-medium text-gray-800">
            {latest?.device_id ?? 'ESP32-S3'}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            {secondsAgo !== null
              ? secondsAgo < 60
                ? `${secondsAgo}d lalu`
                : `${Math.floor(secondsAgo / 60)}m lalu`
              : 'Belum ada data'}
          </span>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          isOnline ? 'bg-green-100 text-green-700' : deviceConnected ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
        }`}>
          {isOnline ? 'Online' : deviceConnected ? 'Tidak aktif' : 'Offline'}
        </span>
      </div>

      {/* Sensor table */}
      <div className="flex flex-col gap-1.5">
        {SENSORS.map(({ key, label, unit }) => {
          const val = latest?.[key];
          const hasValue = val !== null && val !== undefined;
          // DS18B20 hijau hanya kalau benar ada nilai; sensor lain hijau kalau device aktif
          const ok = key === 'temperature' ? hasValue : deviceActive;
          return (
            <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-800">
                  {hasValue ? `${Number(val).toFixed(key === 'discharge_m3s' ? 4 : 2)} ${unit}` : '—'}
                </span>
                <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            </div>
          );
        })}
      </div>

      {!deviceConnected && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          Menunggu data dari ESP32...
        </p>
      )}
    </div>
  );
}
