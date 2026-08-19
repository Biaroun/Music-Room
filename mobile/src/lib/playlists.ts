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

export type ApiPlaylist = {
  id: number;
  name: string;
  isPublic: boolean;
  owner: { id: number; username: string };
  tracks?: ApiPlaylistTrack[];
  createdAt: string;
  updatedAt: string;
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

export function updatePlaylist(id: number, token: string | null, patch: { name?: string; isPublic?: boolean }): Promise<ApiPlaylist> {
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

export function reorderPlaylistTracks(playlistId: number, token: string | null, trackIds: number[]): Promise<ApiPlaylist> {
  return apiFetch(`/playlist-editor/${playlistId}/tracks/reorder`, token, {
    method: 'PATCH',
    body: JSON.stringify({ trackIds }),
  });
}
