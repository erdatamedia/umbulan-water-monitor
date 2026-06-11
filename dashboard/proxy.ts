import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

const PUBLIC_PATHS = ['/login'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('umbulan_session')?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
