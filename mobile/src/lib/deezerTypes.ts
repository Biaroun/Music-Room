// a track as used in the app (shared by web and native)
export type DeezerTrack = {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  cover: string | null;
  previewUrl: string | null;
  duration: number;
  bpm: number | null;
};

// max results shown per search
export const MAX_RESULTS = 15;

// raw deezer json to our DeezerTrack (bpm null because search dont give it)
export function mapDeezerTrack(raw: any): DeezerTrack {
  return {
    id: String(raw.id),
    title: raw.title,
    artist: raw.artist?.name ?? 'Unknown',
    artistId: raw.artist?.id != null ? String(raw.artist.id) : '',
    cover: raw.album?.cover_medium ?? null,
    // || and not ?? because deezer send an empty string when no preview
    previewUrl: raw.preview || null,
    duration: raw.duration ?? 0,
    bpm: null,
  };
}

