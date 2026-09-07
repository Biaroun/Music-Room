import { apiFetch } from '../config/api';

export type ApiPlaylistTrack = {
  id: number;
  deezerId: string;
  title: string;
  artist: string;
  artistId: string | null;
  cover: string | null;
  previewUrl: string;
  bpm: number | null;
  position: number;
  addedAt: string;
};

/** Qui peut éditer, indépendamment de isPublic qui ne règle que la lecture. */
export type PlaylistLicenseMode = 'open' | 'invite-only';

export type ApiPlaylist = {
  id: number;
  name: string;
  isPublic: boolean;
  licenseMode: PlaylistLicenseMode;
  version: number;
  owner: { id: number; username: string };
  tracks?: ApiPlaylistTrack[];
  /** false quand la playlist m'est partagée : le mobile masque les actions owner-only */
  isOwner?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlaylistCollaborator = {
  id: number;
  username: string;
  avatar: string | null;
};

/** État complet poussé par la gateway sur playlist:state. */
export type PlaylistState = {
  id: number;
  name: string;
  isPublic: boolean;
  licenseMode: PlaylistLicenseMode;
  version: number;
  owner: { id: number; username: string };
  collaborators: PlaylistCollaborator[];
  tracks: ApiPlaylistTrack[];
  updatedAt: number;
};

export type AddTrackInput = {
  deezerId: string;
  title: string;
  artist: string;
  artistId?: string | null;
  cover?: string | null;
  previewUrl: string;
  bpm?: number | null;
};

export function listMyPlaylists(token: string | null): Promise<ApiPlaylist[]> {
  return apiFetch('/playlist-editor', token);
}

export function getPlaylist(id: number, token: string | null): Promise<ApiPlaylist> {
  return apiFetch(`/playlist-editor/${id}`, token);
}

export function createPlaylist(token: string | null, body: { name: string; isPublic?: boolean }): Promise<ApiPlaylist> {
  return apiFetch('/playlist-editor', token, { method: 'POST', body: JSON.stringify(body) });
}

export function updatePlaylist(
  id: number,
  token: string | null,
  patch: { name?: string; isPublic?: boolean; licenseMode?: PlaylistLicenseMode },
): Promise<ApiPlaylist> {
  return apiFetch(`/playlist-editor/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deletePlaylist(id: number, token: string | null): Promise<void> {
  return apiFetch(`/playlist-editor/${id}`, token, { method: 'DELETE' });
}

export function addTrackToPlaylist(id: number, token: string | null, dto: AddTrackInput): Promise<ApiPlaylistTrack> {
  return apiFetch(`/playlist-editor/${id}/tracks`, token, { method: 'POST', body: JSON.stringify(dto) });
}

export function removeTrackFromPlaylist(playlistId: number, trackId: number, token: string | null): Promise<void> {
  return apiFetch(`/playlist-editor/${playlistId}/tracks/${trackId}`, token, { method: 'DELETE' });
}

// version = celle du dernier état vu. Le backend refuse en 409 si quelqu'un a
// réordonné entre-temps, plutôt que d'écraser son ordre en silence.
export function reorderPlaylistTracks(
  playlistId: number,
  token: string | null,
  trackIds: number[],
  version?: number,
): Promise<PlaylistState> {
  return apiFetch(`/playlist-editor/${playlistId}/tracks/reorder`, token, {
    method: 'PATCH',
    body: JSON.stringify({ trackIds, version }),
  });
}

export function listCollaborators(playlistId: number, token: string | null): Promise<PlaylistCollaborator[]> {
  return apiFetch(`/playlist-editor/${playlistId}/collaborators`, token);
}

export function addCollaborator(playlistId: number, token: string | null, userId: number): Promise<unknown> {
  return apiFetch(`/playlist-editor/${playlistId}/collaborators`, token, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export function removeCollaborator(playlistId: number, token: string | null, userId: number): Promise<void> {
  return apiFetch(`/playlist-editor/${playlistId}/collaborators/${userId}`, token, { method: 'DELETE' });
}
