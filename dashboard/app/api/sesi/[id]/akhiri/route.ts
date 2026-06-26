import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { muka_air_akhir_cm, catatan } = body;

  const db = getDb();
  const sesi = db.prepare('SELECT * FROM sesi WHERE id = ?').get(id) as any;
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
  if (sesi.status === 'selesai') return NextResponse.json({ error: 'Sesi sudah selesai' }, { status: 400 });

  db.prepare(`
    UPDATE sesi SET status = 'selesai', waktu_selesai = ?, muka_air_akhir_cm = ?, catatan = COALESCE(?, catatan)
    WHERE id = ?
  `).run(new Date().toISOString(), muka_air_akhir_cm ?? null, catatan ?? null, id);

  const updated = db.prepare('SELECT * FROM sesi WHERE id = ?').get(id);
  return NextResponse.json(updated);
}
