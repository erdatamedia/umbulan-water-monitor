import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { temperature, ph, turbidity, do_estimated, water_level_cm, discharge_m3s } = body;

  const db = getDb();
  const sesi = db.prepare('SELECT * FROM sesi WHERE id = ?').get(id) as any;
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
  if (sesi.status === 'selesai') return NextResponse.json({ error: 'Sesi sudah selesai' }, { status: 400 });

  const result = db.prepare(`
    INSERT INTO snapshot (sesi_id, waktu, temperature, ph, turbidity, do_estimated, water_level_cm, discharge_m3s)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    new Date().toISOString(),
    temperature ?? null,
    ph ?? null,
    turbidity ?? null,
    do_estimated ?? null,
    water_level_cm ?? null,
    discharge_m3s ?? null,
  );

  const snapshot = db.prepare('SELECT * FROM snapshot WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(snapshot, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const snapshots = db.prepare(
    'SELECT * FROM snapshot WHERE sesi_id = ? ORDER BY waktu ASC'
  ).all(id);
  return NextResponse.json(snapshots);
}
