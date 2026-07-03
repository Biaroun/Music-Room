import { Platform } from 'react-native';

// Web (navigateur) → localhost ; émulateur Android → 10.0.2.2 ; iOS sim → localhost
const DEFAULT_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://10.0.2.2:3000';

// URL configurable via .env (sujet V.5), sinon valeur par défaut
export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL;

export async function apiFetch(path: string, token: string | null, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join('\n') : data.message;
    throw new Error(msg || 'Request failed');
  }
  return data;
}
