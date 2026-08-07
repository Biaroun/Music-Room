# Deezer Search Integration — Design Spec

**Date:** 2026-08-07
**Scope:** `mobile/` only (no backend changes)
**Branch:** `feat/deezer-search`

---

## Problem

`PlaylistEditorScreen` lets a user "add a track" via two free-text `TextInput`s
(title, artist) that just get pushed into local state — there is no real
music data behind it (no Deezer id, no cover, no audio preview). This blocks
any future work on real playback or on the tempo-sync playlist transitions
already scoped in `mobile/AGENTS.md` (which needs `bpm` and a preview URL per
track).

Goal: replace the manual entry with a live search against the Deezer public
API, so tracks added to a playlist carry real metadata.

Out of scope: actual audio playback, the beatmatch/crossfade transition logic
itself (both already deferred by `mobile/AGENTS.md`), and any backend changes
— `GET /music/search` proxy is not part of this iteration.

---

## Technical constraint: CORS

`api.deezer.com` does not send CORS headers, so a direct `fetch`/`XHR` from a
browser context is blocked. This affects Expo web (`expo start --web`) and
any Chromium-based packaged web build, but **not** native (Android/iOS),
where requests don't go through browser CORS checks at all.

Solution: platform-specific implementation behind one shared interface,
resolved automatically by the Expo/Metro bundler via the `.web.ts` filename
convention already used in this codebase (see `PoolBackground.web.tsx`,
`bootstrap.web.ts`):

- **Native** (`deezer.ts`): plain `fetch` against `api.deezer.com`.
- **Web** (`deezer.web.ts`): JSONP — inject a `<script src="https://api.deezer.com/search?...&output=jsonp&callback=...">`, resolve a promise from the global callback, reject + remove the script after an 8s timeout if Deezer never responds. JSONP bypasses CORS because it's a `<script>` load, not `fetch`/`XHR`, so it works the same in a plain browser tab and in a Chromium-based packaged web executable.

---

## Architecture

```
mobile/src/lib/
  deezer.ts            # shared types + native impl (fetch)
  deezer.web.ts         # web impl (JSONP), same exports as deezer.ts
  useDeezerSearch.ts     # debounced search hook, used by PlaylistEditorScreen
```

### `deezer.ts` / `deezer.web.ts`

Same exported surface on both files:

```ts
export type DeezerTrack = {
  id: string;
  title: string;
  artist: string;
  cover: string | null;      // album.cover_medium
  previewUrl: string | null; // preview (30s mp3)
  duration: number;          // seconds
  bpm: number | null;        // NOT in search results, see below
};

export function searchTracks(query: string): Promise<DeezerTrack[]>;
export function getTrackBpm(deezerId: string): Promise<number | null>;
```

- `searchTracks` hits `GET /search?q=<query>` (native: `fetch` + `.json()`;
  web: JSONP as described above), maps `data[]` into `DeezerTrack[]` with
  `bpm: null` (Deezer's search response does not include `bpm` — confirmed
  against the Deezer API and consistent with `mobile/AGENTS.md`, which
  sources `bpm` from `/track/{id}` specifically). Cap to the first 15
  results.
- `getTrackBpm` hits `GET /track/<id>` (same native/web split) and returns
  the `bpm` field (or `null` if `0`/missing, matching the "missing/0" check
  already defined in `mobile/AGENTS.md` for the transition feature).

### `useDeezerSearch(query: string)`

```ts
{ results: DeezerTrack[]; loading: boolean; error: string | null }
```

- Debounces `query` by 400ms.
- Empty/whitespace query → clears results immediately, no request.
- Tracks an internal `requestId` counter; increments on every new search and
  only applies a response if its `requestId` is still the latest — guards
  against an older, slower response overwriting a newer one. Same mechanism
  covers both the native fetch path and the web JSONP path, so no
  platform-specific cancellation logic is needed.
- On error (network failure, JSONP timeout) or empty `data[]`: `results` set
  to `[]`, `error` set to a message for empty results, `null` otherwise. The
  caller decides how to render "no results" vs "error" (see UX below).

---

## PlaylistEditorScreen changes

- `Track` type extended: `{ id: string; title: string; artist: string; cover: string | null; previewUrl: string | null; bpm: number | null }`. `INITIAL` mock tracks get the three new fields set to `null` (no cover/preview/bpm for demo data — no upstream Deezer id to look one up).
- The "Add a track" block (two `TextInput`s + `Add track` button) is removed entirely and replaced with:
  - One `TextInput` "Search a track…" wired to `useDeezerSearch`.
  - Below it, a live results list (only rendered while the field is non-empty): each row shows `cover` (44×44, fallback to the existing musical-note placeholder box when `null`) + `title` + `artist`.
  - Tapping a result: appends it to `tracks` immediately with the fields already known (`id`, `title`, `artist`, `cover`, `previewUrl`, `duration`, `bpm: null`), clears the search field. Then fires `getTrackBpm(id)` in the background and patches that track's `bpm` in state when it resolves (keyed by `id` — a no-op if the track was removed from the playlist in the meantime).
- Rest of the screen (reordering via `move`, `removeTrack`, playlist name/visibility) is unchanged.

---

## Error handling & edge cases

| Case | Behavior |
|---|---|
| Empty search field | Results list hidden, no request fired |
| No results for query | "No results" text under the field |
| Network error / Deezer down | Toast via existing `useToast` (`type: 'error'`), results cleared |
| JSONP script never loads/responds (web) | Rejects after 8s timeout, script tag removed from DOM, surfaces as the same network-error toast |
| `getTrackBpm` fails after a track was added | Silent — track keeps `bpm: null`, same as today's mock tracks; not worth a toast for a background enrichment call |
| Same track added twice | Allowed (duplicates permitted, matches current manual-entry behavior which has no dedup either) |

---

## Testing

No automated test runner exists in `mobile/` (`package.json` has no test
script). Verification is manual, on both platforms this feature branches on:

- `expo start --web`: search returns results, add a track, confirm cover/bpm
  populate, confirm behavior on a query with no results and on airplane
  mode (error toast).
- `expo start` on Android emulator (or a physical device): same checks,
  confirms the native `fetch` path works independently of the web JSONP path.

---

## Files to create / modify

| File | Action |
|---|---|
| `mobile/src/lib/deezer.ts` | Create — types + native `searchTracks`/`getTrackBpm` |
| `mobile/src/lib/deezer.web.ts` | Create — same exports, JSONP-based |
| `mobile/src/lib/useDeezerSearch.ts` | Create — debounced search hook |
| `mobile/src/screens/PlaylistEditorScreen.tsx` | Modify — replace manual add UI with search, extend `Track` type, wire bpm enrichment |

---

## Out of scope

- Backend Deezer proxy (`GET /music/search`) — revisit if/when Track Vote or
  Music Delegation need the same data server-side.
- Audio playback of `previewUrl` — separate feature, already noted in
  `mobile/AGENTS.md`.
- Beatmatch/crossfade transition logic using `bpm` — separate feature,
  already scoped in `mobile/AGENTS.md`.
- Removing duplicate tracks / dedup logic.
