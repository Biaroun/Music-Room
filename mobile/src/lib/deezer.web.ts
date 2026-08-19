import { DeezerTrack, MAX_RESULTS, mapDeezerTrack } from './deezerTypes';

export type { DeezerTrack };

const BASE_URL = 'https://api.deezer.com';
const JSONP_TIMEOUT_MS = 8000;

let callbackCounter = 0;

function jsonp(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = `__deezerJsonp${Date.now()}_${callbackCounter++}`;
    const script = document.createElement('script');
    let settled = false;

    function cleanup() {
      delete (window as any)[callbackName];
      script.remove();
      clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Deezer request timed out'));
    }, JSONP_TIMEOUT_MS);

    (window as any)[callbackName] = (data: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Deezer request failed'));
    };

    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  const json = await jsonp(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  const data = Array.isArray(json.data) ? json.data : [];
  return data.slice(0, MAX_RESULTS).map(mapDeezerTrack);
}

export async function getTrackBpm(deezerId: string): Promise<number | null> {
  const json = await jsonp(`${BASE_URL}/track/${deezerId}`);
  return json.bpm ? json.bpm : null;
}
