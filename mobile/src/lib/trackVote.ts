import { apiFetch } from '../config/api';

export type EventVisibility = 'public' | 'private';
export type EventLicenseMode = 'open' | 'invite-only' | 'geo-time-restricted';

// an event as the api send it
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
  /** mon statut sur cet event, calcule par le backend (voir EventService.findVisible/findOneForUser). */
  isOwner: boolean;
  isInvited: boolean;
  /** sans tenir compte de la position : juste un indicatif d'affichage, pas une autorisation. */
  canVote: boolean;
};

// body to create an event (geo fields only for geo time mode)
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

// one line of the vote board
export type BoardTrack = {
  trackId: number;
  deezerId: string;
  title: string;
  artist: string;
  cover: string | null;
  voteCount: number;
  myVote: boolean;
};

// track playing now in the event (startedAt in ms)
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

// the full board (ranked tracks + now playing)
export type Board = {
  tracks: BoardTrack[];
  nowPlaying: NowPlaying | null;
  updatedAt: number;
};

// body to suggest a track
export type SuggestTrackInput = {
  deezerId: string;
  title: string;
  artist: string;
  artistId?: string | null;
  cover?: string | null;
  previewUrl: string;
  bpm?: number | null;
};

// gps position sent with a vote
export type VotePosition = { latitude: number; longitude: number };

// events I can see
export function listEvents(token: string | null): Promise<ApiEvent[]> {
  return apiFetch('/track-vote/events', token);
}

// one event
export function getEvent(id: number, token: string | null): Promise<ApiEvent> {
  return apiFetch(`/track-vote/events/${id}`, token);
}

// create an event (premium only)
export function createEvent(token: string | null, body: CreateEventInput): Promise<ApiEvent> {
  return apiFetch('/track-vote/events', token, { method: 'POST', body: JSON.stringify(body) });
}

// delete an event
export function deleteEvent(id: number, token: string | null): Promise<void> {
  return apiFetch(`/track-vote/events/${id}`, token, { method: 'DELETE' });
}

// update an event
export function updateEvent(id: number, token: string | null, patch: Partial<CreateEventInput>): Promise<ApiEvent> {
  return apiFetch(`/track-vote/events/${id}`, token, { method: 'PATCH', body: JSON.stringify(patch) });
}

// an invite row with the invited user
export type InvitedUser = { id: number; invitee: { id: number; username: string } };

// invited users of an event
export function listInvited(eventId: number, token: string | null): Promise<InvitedUser[]> {
  return apiFetch(`/track-vote/events/${eventId}/invites`, token);
}

// invite a user
export function inviteToEvent(eventId: number, userId: number, token: string | null): Promise<void> {
  return apiFetch(`/track-vote/events/${eventId}/invites/${userId}`, token, { method: 'POST' });
}

// remove an invite
export function uninviteFromEvent(eventId: number, userId: number, token: string | null): Promise<void> {
  return apiFetch(`/track-vote/events/${eventId}/invites/${userId}`, token, { method: 'DELETE' });
}

// the vote board (rest fallback)
export function getBoard(eventId: number, token: string | null): Promise<Board> {
  return apiFetch(`/track-vote/events/${eventId}/board`, token);
}

// suggest a track for the event
export function suggestTrack(eventId: number, token: string | null, dto: SuggestTrackInput): Promise<unknown> {
  return apiFetch(`/track-vote/events/${eventId}/tracks`, token, { method: 'POST', body: JSON.stringify(dto) });
}

// copy one of my playlists in the event
export function importPlaylist(eventId: number, playlistId: number, token: string | null): Promise<{ added: number }> {
  return apiFetch(`/track-vote/events/${eventId}/import-playlist`, token, {
    method: 'POST',
    body: JSON.stringify({ playlistId }),
  });
}

// vote for a track (position spread in the body if given)
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

// remove my vote (DELETE has no body so the position goes in the query)
export function retractVote(
  eventId: number,
  trackId: number,
  token: string | null,
  position?: VotePosition,
): Promise<Board> {
  const query = position ? `?latitude=${position.latitude}&longitude=${position.longitude}` : '';
  return apiFetch(`/track-vote/events/${eventId}/vote/${trackId}${query}`, token, { method: 'DELETE' });
}
