'use client';

import { useSensorData } from '@/hooks/useSensorData';
import { MetricCard } from '@/components/MetricCard';
import { SensorChart } from '@/components/SensorChart';
import { DeviceStatus } from '@/components/DeviceStatus';
import { Header } from '@/components/layout/Header';
import { deriveFromTemp } from '@/lib/sensorDummy';

export default function OverviewPage() {
  const { latest, history, connected } = useSensorData();

  const toNum = (v: unknown) => { const n = Number(v); return (v == null || isNaN(n)) ? null : n; };

  const temp = toNum(latest?.temperature);
  const deviceActive = temp !== null && temp > 0;
  const derived = deviceActive ? deriveFromTemp(temp!) : null;

  const waterLevel = toNum(latest?.water_level_cm) ?? derived?.waterLevelCm ?? null;
  const discharge  = toNum(latest?.discharge_m3s)  ?? derived?.discharge    ?? null;

  return (
    <>
      <Header
        title="Overview"
        subtitle="Data real-time dari lapangan"
        lastUpdate={latest?.recorded_at ?? null}
        connected={connected}
      />
      <div className="p-3 md:p-6 flex flex-col gap-3 md:gap-5">
        <div className="grid grid-cols-3 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-4">
          <MetricCard label="Suhu" value={latest?.temperature ?? null} unit="°C" color="#f59e0b" />
          <MetricCard label="pH" value={latest?.ph ?? null} unit="pH" color="#8b5cf6" />
          <MetricCard label="Turbiditas" value={latest?.turbidity ?? null} unit="NTU" color="#06b6d4" />
          <MetricCard label="Muka Air" value={waterLevel} unit="cm" color="#3b82f6" />
          <MetricCard label="Debit" value={discharge} unit="m³/s" decimals={4} color="#10b981" />
          <MetricCard label="DO Est." value={latest?.do_estimated ?? null} unit="mg/L" color="#ef4444" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          <DeviceStatus latest={latest} />
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <SensorChart data={history} dataKey="temperature" color="#f59e0b" label="Suhu" unit="°C" />
            <SensorChart data={history} dataKey="ph" color="#8b5cf6" label="pH" unit="pH" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <SensorChart data={history} dataKey="turbidity" color="#06b6d4" label="Turbiditas" unit="NTU" />
          <SensorChart data={history} dataKey="water_level_cm" color="#3b82f6" label="Muka Air" unit="cm" />
          <SensorChart data={history} dataKey="discharge_m3s" color="#10b981" label="Debit" unit="m³/s" />
          <SensorChart data={history} dataKey="do_estimated" color="#ef4444" label="DO Estimasi" unit="mg/L" />
        </div>
      </div>
    </>
  );
}
