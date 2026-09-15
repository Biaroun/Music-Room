import { Platform } from 'react-native';
import { deviceHeaders } from './device';
import { storage } from './storage';

// web (navigateur) -> localhost ; emulateur Android -> 10.0.2.2 ; iOS sim -> localhost
const DEFAULT_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://10.0.2.2:3000';

// sujet v.5 : l'adresse du back doit se regler dans l'app. le .env donne la
// valeur du build, l'ecran Server (depuis le login) la surcharge sur l'appareil
export const BUILD_API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL;
// storage key for the custom url
const API_URL_KEY = 'api_url';

let apiUrl = BUILD_API_URL;

// toujours lire l'url au moment de l'appel, jamais la garder dans une constante
export function getApiUrl() {
  return apiUrl;
}

// appele au demarrage, avant la premiere requete (AuthProvider)
export async function loadApiUrl() {
  const saved = await storage.getItem(API_URL_KEY).catch(() => null);
  if (saved)
    apiUrl = saved;
}

// null = retour a la valeur du build
export async function setApiUrl(url: string | null) {
  if (url)
    await storage.setItem(API_URL_KEY, url);
  else
    await storage.removeItem(API_URL_KEY);
  apiUrl = url || BUILD_API_URL;
}

// trim + remove the last slashes then check its http or https + host + optional port (sinon null)
export function normalizeApiUrl(input: string): string | null {
  const url = input.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+(:\d+)?$/i.test(url) ? url : null;
}

// verifie que l'adresse repond ET que c'est bien notre api, pas un autre
// service qui ecoute sur le meme port
export async function probeApiUrl(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  // give up after 5s
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${url}/api/docs-json`, { signal: ctrl.signal });
    const doc = await res.json();
    return doc?.info?.title === 'Music Room API';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// fetch on the api with json + device headers + token (throw with the status if not ok)
export async function apiFetch(path: string, token: string | null, options: RequestInit = {}) {
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // sujet v.6 : plateforme, appareil et version sur chaque action mobile
      ...deviceHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  // empty body (204) = {} instead of a crash
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // validation errors come as an array so one per line
    const msg = Array.isArray(data.message) ? data.message.join('\n') : data.message;
    // le statut permet a l'appelant de distinguer un 401 d'une panne reseau
    throw Object.assign(new Error(msg || 'Request failed'), { status: res.status });
  }
  return data;
}
