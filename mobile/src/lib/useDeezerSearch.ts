import { useEffect, useRef, useState } from 'react';
import { searchTracks } from './deezer';
import type { DeezerTrack } from './deezerTypes';

// wait 400ms after the last key before searching
const DEBOUNCE_MS = 400;

// hook that search deezer with a debounce (results loading error)
export function useDeezerSearch(query: string) {
  const [results, setResults] = useState<DeezerTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // id of the last search so an old answer cant replace a new one
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    // empty query = on reset everything
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

    // new key before 400ms = cancel the previous timer
    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading, error };
}
