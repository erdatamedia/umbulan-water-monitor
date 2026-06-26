import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const sesi = db.prepare('SELECT * FROM sesi WHERE id = ?').get(id);
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });

  const snapshots = db.prepare(
    'SELECT * FROM snapshot WHERE sesi_id = ? ORDER BY waktu ASC'
  ).all(id);

  return NextResponse.json({ ...sesi as object, snapshots });
}
