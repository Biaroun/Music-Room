import { DeezerTrack, MAX_RESULTS, mapDeezerTrack } from './deezerTypes';

export type { DeezerTrack };

const BASE_URL = 'https://api.deezer.com';

export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Deezer search failed');
  const json = await res.json();
  const data = Array.isArray(json.data) ? json.data : [];
  return data.slice(0, MAX_RESULTS).map(mapDeezerTrack);
}

export async function getTrackBpm(deezerId: string): Promise<number | null> {
  const res = await fetch(`${BASE_URL}/track/${deezerId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.bpm ? json.bpm : null;
}

