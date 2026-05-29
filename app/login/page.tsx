'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) router.push('/');
    }).catch(() => {});
  }, [router]);

  async function handleRegister() {
    if (!username.trim()) { setError('Username required'); return; }
    setLoading(true);
    setError('');
    try {
      const optRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const options = await optRes.json();
      if (!optRes.ok) { setError(options.error); return; }

      const response = await startRegistration(options);

      const verRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), response }),
      });
      const result = await verRes.json();
      if (result.success) {
        router.push('/');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!username.trim()) { setError('Username required'); return; }
    setLoading(true);
    setError('');
    try {
      const optRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const options = await optRes.json();
      if (!optRes.ok) { setError(options.error); return; }

      const response = await startAuthentication(options);

      const verRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), response }),
      });
      const result = await verRes.json();
      if (result.success) {
        router.push('/');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Todo App</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Sign in or register with a passkey</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter your username"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRegister}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {loading ? '…' : 'Register'}
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 transition-colors"
          >
            {loading ? '…' : 'Login'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Uses passkeys — no password required
        </p>

        {typeof window !== 'undefined' && !window.PublicKeyCredential && (
          <p className="text-xs text-red-500 mt-2 text-center">
            Your browser does not support passkeys
          </p>
        )}
      </div>
    </div>
  );
}
