import { DeezerTrack, MAX_RESULTS, mapDeezerTrack } from './deezerTypes';

export type { DeezerTrack };

// deezer public api (no key needed)
const BASE_URL = 'https://api.deezer.com';

// search tracks on deezer (native = normal fetch no cors problem)
export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Deezer search failed');
  const json = await res.json();
  const data = Array.isArray(json.data) ? json.data : [];
  return data.slice(0, MAX_RESULTS).map(mapDeezerTrack);
}

// bpm is only in the track details so a second call (0 = null)
export async function getTrackBpm(deezerId: string): Promise<number | null> {
  const res = await fetch(`${BASE_URL}/track/${deezerId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.bpm ? json.bpm : null;
}

