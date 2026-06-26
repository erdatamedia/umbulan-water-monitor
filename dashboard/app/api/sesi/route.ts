import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // 'aktif' | 'selesai' | null (all)
  const limit = parseInt(searchParams.get('limit') ?? '50');

  const rows = status
    ? db.prepare('SELECT * FROM sesi WHERE status = ? ORDER BY waktu_mulai DESC LIMIT ?').all(status, limit)
    : db.prepare('SELECT * FROM sesi ORDER BY waktu_mulai DESC LIMIT ?').all(limit);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { titik, kode_titik, lat, lng, petugas, jenis, muka_air_awal_cm, catatan } = body;

  if (!titik || !jenis) {
    return NextResponse.json({ error: 'titik dan jenis wajib diisi' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO sesi (titik, kode_titik, lat, lng, petugas, jenis, waktu_mulai, muka_air_awal_cm, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    titik,
    kode_titik ?? null,
    lat ?? null,
    lng ?? null,
    petugas ?? null,
    jenis,
    new Date().toISOString(),
    muka_air_awal_cm ?? null,
    catatan ?? null,
  );

  const sesi = db.prepare('SELECT * FROM sesi WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(sesi, { status: 201 });
}
