export interface SensorReading {
  id: number;
  device_id: string;
  recorded_at: string;
  temperature: number | null;
  ph: number | null;
  turbidity: number | null;
  water_level_cm: number | null;
  discharge_m3s: number | null;
  do_estimated: number | null;
}
