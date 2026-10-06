import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch, getApiUrl } from '../config/api';

WebBrowser.maybeCompleteAuthSession();

export type GoogleFlowResult = { code: string; verifier: string };

function appRedirectUrl(): string {
  return Platform.OS === 'web' ? globalThis.location.origin : Linking.createURL('auth');
}

const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function runGoogleFlow(): Promise<GoogleFlowResult | null> {
  const bytes = Crypto.getRandomBytes(32);
  const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const challenge = toBase64Url(await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  ));

  const redirect = appRedirectUrl();
  const result = await WebBrowser.openAuthSessionAsync(
    `${getApiUrl()}/auth/google/web?redirect=${encodeURIComponent(redirect)}&challenge=${challenge}`,
    redirect,
  );
  if (result.type !== 'success')
    return null;

  const params = new URLSearchParams(result.url.split('#')[1] ?? '');
  const error = params.get('error');
  if (error)
    throw new Error(error);
  const code = params.get('code');
  if (!code)
    throw new Error('Google sign-in did not return anything');
  return { code, verifier };
}

export async function exchangeGoogleCode(flow: GoogleFlowResult): Promise<string> {
  const { access_token } = await apiFetch('/auth/google/exchange', null, {
    method: 'POST',
    body: JSON.stringify(flow),
  });
  return access_token;
}

export function linkGoogleAccount(token: string | null, flow: GoogleFlowResult): Promise<{ message: string }> {
  return apiFetch('/auth/google/link', token, { method: 'POST', body: JSON.stringify(flow) });
}
