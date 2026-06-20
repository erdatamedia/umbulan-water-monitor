// Nilai dummy berdasarkan suhu — dipakai selama sensor real belum tersambung.
// Formula deterministik (tanpa random) supaya aman untuk SSR/CSR React.
// Ganti dengan pembacaan sensor real setelah hardware selesai diperbaiki.

export function deriveFromTemp(temp: number) {
  // pH: inversely correlated, mata air pegunungan/kapur netral-sedikit basa
  const ph = parseFloat((7.45 - (temp - 25) * 0.018).toFixed(2));

  // Turbidity: sangat rendah, sedikit naik saat suhu naik
  const turbidity = parseFloat(Math.max(1.0, 2.1 + (temp - 25) * 0.09).toFixed(1));

  // DO: rumus Benson & Krause (sama persis dengan firmware)
  const doEst = parseFloat(
    (14.62 - 0.3898 * temp + 0.006969 * temp * temp - 0.00005896 * temp * temp * temp).toFixed(2)
  );

  // Muka air: rata-rata 1.5m, berfluktuasi kecil mengikuti suhu
  // Umbulan dikenal debit besar — kisaran 1.0–2.0m wajar untuk saluran utama
  const waterLevelM = parseFloat(Math.max(1.0, Math.min(2.0, 1.5 + (temp - 26) * 0.08)).toFixed(2));
  const waterLevelCm = parseFloat((waterLevelM * 100).toFixed(1));

  // Debit: rating curve Q = 0.5 * H^1.5 (sesuai konstanta firmware)
  const discharge = parseFloat((0.5 * Math.pow(waterLevelM, 1.5)).toFixed(4));

  return { ph, turbidity, doEst, waterLevelCm, discharge };
}
