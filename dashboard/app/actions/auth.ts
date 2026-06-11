'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSession, COOKIE_NAME } from '@/lib/auth';

export async function login(_: unknown, formData: FormData) {
  const password = formData.get('password') as string;
  if (password !== process.env.DASHBOARD_PASSWORD) {
    return { error: 'Password salah' };
  }
  const token = await createSession();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
  redirect('/');
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect('/login');
}
