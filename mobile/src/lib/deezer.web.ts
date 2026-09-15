import { DeezerTrack, MAX_RESULTS, mapDeezerTrack } from './deezerTypes';

export type { DeezerTrack };

const BASE_URL = 'https://api.deezer.com';
// give up the jsonp after 8s
const JSONP_TIMEOUT_MS = 8000;

// counter so 2 calls in the same ms dont get the same callback name
let callbackCounter = 0;

// deezer has no cors so on web we load the url in a script tag (jsonp)
function jsonp(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = `__deezerJsonp${Date.now()}_${callbackCounter++}`;
    const script = document.createElement('script');
    let settled = false;

    // nettoyer the global callback the script tag and the timer
    function cleanup() {
      delete (window as any)[callbackName];
      script.remove();
      clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      // settled = already resolved or rejected (on skip the rest)
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

// same as the native version but with jsonp
export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  const json = await jsonp(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  const data = Array.isArray(json.data) ? json.data : [];
  return data.slice(0, MAX_RESULTS).map(mapDeezerTrack);
}

// bpm of a track with jsonp (0 = null)
export async function getTrackBpm(deezerId: string): Promise<number | null> {
  const json = await jsonp(`${BASE_URL}/track/${deezerId}`);
  return json.bpm ? json.bpm : null;
}
