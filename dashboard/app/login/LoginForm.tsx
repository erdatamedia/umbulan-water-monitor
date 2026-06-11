'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Masukkan password"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Masuk...' : 'Masuk'}
      </button>
    </form>
  );
}
