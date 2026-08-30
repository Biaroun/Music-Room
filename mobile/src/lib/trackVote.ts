import { apiFetch } from '../config/api';

export type EventVisibility = 'public' | 'private';
export type EventLicenseMode = 'open' | 'invite-only' | 'geo-time-restricted';

export type ApiEvent = {
  id: number;
  name: string;
  playlist: { id: number; name: string };
  owner: { id: number; username: string };
  visibility: EventVisibility;
  licenseMode: EventLicenseMode;
  licenseLatitude: number | null;
  licenseLongitude: number | null;
  licenseRadiusMeters: number | null;
  licenseStartsAt: string | null;
  licenseEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Mon statut sur cet event, calcule par le backend (voir EventService.findVisible/findOneForUser). */
  isOwner: boolean;
  isInvited: boolean;
  /** Sans tenir compte de la position : juste un indicatif d'affichage, pas une autorisation. */
  canVote: boolean;
};

export type CreateEventInput = {
  name: string;
  playlistId: number;
  visibility?: EventVisibility;
  licenseMode?: EventLicenseMode;
  licenseLatitude?: number;
  licenseLongitude?: number;
  licenseRadiusMeters?: number;
  licenseStartsAt?: string;
  licenseEndsAt?: string;
};

export type BoardTrack = {
  trackId: number;
  deezerId: string;
  title: string;
  artist: string;
  cover: string | null;
  voteCount: number;
  myVote: boolean;
};

export type NowPlaying = {
  trackId: number;
  deezerId: string;
  title: string;
  artist: string;
  cover: string | null;
  previewUrl: string;
  startedAt: number;
  durationMs: number;
};

export type Board = {
  tracks: BoardTrack[];
  nowPlaying: NowPlaying | null;
  updatedAt: number;
};

export type SuggestTrackInput = {
  deezerId: string;
  title: string;
  artist: string;
  artistId?: string | null;
  cover?: string | null;
  previewUrl: string;
  bpm?: number | null;
};

export type VotePosition = { latitude: number; longitude: number };

export function listEvents(token: string | null): Promise<ApiEvent[]> {
  return apiFetch('/track-vote/events', token);
}

export function getEvent(id: number, token: string | null): Promise<ApiEvent> {
  return apiFetch(`/track-vote/events/${id}`, token);
}

export function createEvent(token: string | null, body: CreateEventInput): Promise<ApiEvent> {
  return apiFetch('/track-vote/events', token, { method: 'POST', body: JSON.stringify(body) });
}

export function deleteEvent(id: number, token: string | null): Promise<void> {
  return apiFetch(`/track-vote/events/${id}`, token, { method: 'DELETE' });
}

export function updateEvent(id: number, token: string | null, patch: Partial<CreateEventInput>): Promise<ApiEvent> {
  return apiFetch(`/track-vote/events/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) });
}

export type InvitedUser = { id: number; invitee: { id: number; username: string } };

export function listInvited(eventId: number, token: string | null): Promise<InvitedUser[]> {
  return apiFetch(`/track-vote/events/${eventId}/invites`, token);
}

export function inviteToEvent(eventId: number, userId: number, token: string | null): Promise<void> {
  return apiFetch(`/track-vote/events/${eventId}/invites/${userId}`, token, { method: 'POST' });
}

export function uninviteFromEvent(eventId: number, userId: number, token: string | null): Promise<void> {
  return apiFetch(`/track-vote/events/${eventId}/invites/${userId}`, token, { method: 'DELETE' });
}

export function getBoard(eventId: number, token: string | null): Promise<Board> {
  return apiFetch(`/track-vote/events/${eventId}/board`, token);
}

export function suggestTrack(eventId: number, token: string | null, dto: SuggestTrackInput): Promise<unknown> {
  return apiFetch(`/track-vote/events/${eventId}/tracks`, token, { method: 'POST', body: JSON.stringify(dto) });
}

export function importPlaylist(eventId: number, playlistId: number, token: string | null): Promise<{ added: number }> {
  return apiFetch(`/track-vote/events/${eventId}/import-playlist`, token, {
    method: 'POST',
    body: JSON.stringify({ playlistId }),
  });
}

export function castVote(
  eventId: number,
  trackId: number,
  token: string | null,
  position?: VotePosition,
): Promise<Board> {
  return apiFetch(`/track-vote/events/${eventId}/vote`, token, {
    method: 'PUT',
    body: JSON.stringify({ trackId, ...position }),
  });
}

export function retractVote(
  eventId: number,
  trackId: number,
  token: string | null,
  position?: VotePosition,
): Promise<Board> {
  const query = position ? `?latitude=${position.latitude}&longitude=${position.longitude}` : '';
  return apiFetch(`/track-vote/events/${eventId}/vote/${trackId}${query}`, token, { method: 'DELETE' });
}
