import { useEffect, useRef, useState } from 'react';
import { searchTracks } from './deezer';
import type { DeezerTrack } from './deezerTypes';

const DEBOUNCE_MS = 400;

export function useDeezerSearch(query: string) {
  const [results, setResults] = useState<DeezerTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const tracks = await searchTracks(trimmed);
        if (requestId.current !== id) return;
        setResults(tracks);
      } catch {
        if (requestId.current !== id) return;
        setResults([]);
        setError('Search failed, try again');
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, error };
}
