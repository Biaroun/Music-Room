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

export const MAX_RESULTS = 15;

export function mapDeezerTrack(raw: any): DeezerTrack {
  return {
    id: String(raw.id),
    title: raw.title,
    artist: raw.artist?.name ?? 'Unknown',
    artistId: raw.artist?.id != null ? String(raw.artist.id) : '',
    cover: raw.album?.cover_medium ?? null,
    previewUrl: raw.preview || null,
    duration: raw.duration ?? 0,
    bpm: null,
  };
}

