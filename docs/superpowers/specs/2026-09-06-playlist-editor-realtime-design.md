# Real-time Collaborative Playlist Editing — Design Spec

**Date:** 2026-09-06
**Scope:** `backend/src/playlist-editor/`, `mobile/src/{context,lib,screens}`
**Branch:** `feat/playlist-editor-realtime`
**Subject requirement:** V.2.3 (p. 9) — *Music Playlist Editor: real-time
multi-user playlist edition*

---

## Problem

The subject requires several users to edit the same playlist at the same time,
with every add / remove / reorder appearing on the other editors' screens
without a manual refresh. It explicitly calls out the hard part: what happens
when two people move the same track concurrently.

Two independent gaps stand between the current code and that requirement.

**1. There is no multi-user write access at all.** Every mutation in
`playlist-editor.service.ts` funnels through `findOwned()` (lines 51–60), which
throws `ForbiddenException('Not your playlist')` for anyone but the owner. A
second user attempting to edit gets a 403. The problem is therefore not merely
that collaborators are *out of sync* — collaboration is impossible in the first
place. A grep across `backend/src` confirms no collaborator/invite concept
exists for playlists; `EventInvite` is the only invitation entity and it belongs
to track-vote.

**2. There is no real-time channel.** `playlist-editor.controller.ts` is plain
REST. No gateway file exists, and `PlaylistEditorScreen.tsx` keeps `tracks` in
local `useState` loaded once on mount (lines 51–67). Each user sees only their
own writes until they reopen the screen.

The reference implementation to follow already exists in this repo: `track-vote`
(gateway + REST that notifies the gateway) and `listening`.

## Out of scope

- **Drag & drop.** `PlaylistEditorScreen.tsx:226–231` already reorders via
  `chevron-up` / `chevron-down`. That is a sufficient reorder gesture to
  exercise real-time and conflicts. Replacing it with a draggable list is a
  separate mobile task.
- **CRDT / operational transform.** Rejected as heavily disproportionate; see
  the conflict section.
- **Offline edit queueing.** When the socket is down we fall back to REST, we do
  not buffer edits locally.

## Decisions taken before design

| Question | Decision |
|---|---|
| Who may edit? | Explicit invited collaborators, modelled on `EventInvite` |
| Concurrency strategy | Version guard on `reorder` only; add/remove stay last-write-wins |
| Drag & drop? | No — keep the existing chevrons |

### Amendment, 2026-09-07 — license mode

The first implementation hard-coded the invited-collaborators rule as the only
behaviour. Re-reading V.2.3 against the PDF showed that is only half the
requirement:

> - By default, everyone can edit the playlist.
> - With the right license, the invited users are the only ones who can edit the playlist.

Editing rights are a **second axis**, independent of visibility — the same
separation `Event` already makes between `visibility` and `licenseMode`.
`Playlist` therefore gains `licenseMode: PlaylistLicenseMode` (`OPEN` default,
`INVITE_ONLY`), and `assertCanEdit` chains the two axes exactly as
`EventService.assertCanVote` does: visibility first, then the license. The
collaborator table built above becomes the invitee list of the restricted mode;
nothing is discarded.

Resulting matrix (verified end to end, see Part 6):

| Visibility | License | Reads | Edits |
|---|---|---|---|
| public | `open` (default) | everyone | **everyone** |
| public | `invite-only` | everyone | owner + collaborators |
| private | `open` | owner + collaborators | owner + collaborators |
| private | `invite-only` | owner + collaborators | owner + collaborators |

The last two rows are identical in effect: on a private playlist the visibility
axis already restricts the audience to invitees, so the license only bites on
public playlists. The same is true of `INVITE_ONLY` on events.

---

## Part 1 — Collaboration model

### New entity

`backend/src/playlist-editor/playlist-collaborator.entity.ts`, deliberately a
copy of the `EventInvite` shape (one-way invitation, no accept/reject
negotiation — the row itself grants the right):

```ts
@Entity()
@Unique(['playlist', 'collaborator'])
export class PlaylistCollaborator {
    @PrimaryGeneratedColumn() id: number;

    @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
    @JoinColumn() playlist: Playlist;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn() collaborator: User;

    @CreateDateColumn() createdAt: Date;
}
```

### Permission split

`findOwned()` stays, but stops being the guard for content mutations. The
service gains two helpers:

- `assertCanEdit(playlistId, userId)` — owner **or** a collaborator row exists.
- `assertCanView(playlistId, userId)` — owner, collaborator, or the playlist is
  public.

| Operation | Guard | Rationale |
|---|---|---|
| `addTrack`, `removeTrack`, `reorder` | `assertCanEdit` | the collaborative surface |
| `update` (rename, visibility) | `findOwned` | structural |
| `remove` (delete playlist) | `findOwned` | destructive |
| add / revoke a collaborator | `findOwned` | only the owner grants access |
| `findOne` | `assertCanView` | |

Content is collaborative; structure and destruction stay with the owner.

### Two consequential adjustments

Both are required or the feature is unusable end to end:

- `findOne` (line 44) currently rejects a non-owner on a private playlist. A
  collaborator must be allowed through, otherwise an invited user cannot even
  open the screen.
- `findMine` (line 27) currently returns owned playlists only. It must also
  return playlists where the requester is a collaborator, otherwise an invited
  user has no way to navigate to one. Each row gains a computed `isOwner:
  boolean` so `PlaylistsScreen` / `PlaylistEditorScreen` can hide owner-only
  actions. This is an additive field — existing consumers keep working.

### New REST endpoints

```
GET    /playlist-editor/:id/collaborators           # any viewer
POST   /playlist-editor/:id/collaborators           # owner only, body { userId }
DELETE /playlist-editor/:id/collaborators/:userId   # owner only
```

`POST` validates that the target is an existing user. Adding an already-present
collaborator is idempotent (the `@Unique` constraint is caught and swallowed)
rather than a 409, matching how `EventInvite` is used.

---

## Part 2 — Versioning and conflicts

### The version column

`Playlist` gains:

```ts
@Column({ type: 'int', default: 0 })
version: number;
```

**Why a manual column and not TypeORM's `@VersionColumn`:** `@VersionColumn`
increments only when *that entity* is saved. `addTrack` and `removeTrack` save a
`PlaylistTrack`, never the `Playlist`, so the version would stay at 1 forever
and the guard would be worthless. The column is therefore bumped explicitly by
each content mutation.

No migration is needed: `app.module.ts:28` runs TypeORM with
`synchronize: true`, and existing rows default to `0`.

### The reorder contract

`ReorderTracksDto` gains an optional `version: number`. `reorder()` becomes
`reorder(playlistId, userId, trackIds, expectedVersion?)`:

1. If `expectedVersion` is supplied and differs from the stored `version`, throw
   `ConflictException` (HTTP 409) carrying the current state, so the client can
   adopt it and redraw instead of guessing.
2. The existing `sameSet` check (line 95) is kept unchanged.
3. Apply the new positions and increment `version`.

Omitting `version` keeps the old last-write-wins behaviour, so existing REST
callers are not broken.

### Why this is enough, and why add/remove need no guard

The two guards are complementary and neither subsumes the other:

- `sameSet` catches *someone added or removed a track while I was dragging* —
  the requested id set no longer matches the stored one.
- The version guard catches *someone else reordered while I was dragging* —
  a case `sameSet` accepts today, because the id set is identical and only the
  order differs. This is exactly the scenario the subject asks about.

`addTrack` appends at the tail and `removeTrack` targets a specific row id;
concurrent executions converge to the same set regardless of order, so
rejecting them would produce user-visible failures with no correctness benefit.
They bump the version (invalidating in-flight reorders, which is correct) but
are never themselves rejected on version grounds.

### Atomicity

`reorder` currently issues `Promise.all(trackIds.map(... this.tracks.update ...))`
(line 99). If one update fails, the playlist is left in a half-applied order
that no user requested. Since this method is being modified anyway, the version
re-read, the position updates and the version bump move into a single
`manager.transaction()`.

---

## Part 3 — The gateway

`backend/src/playlist-editor/playlist-editor.gateway.ts`.

**Namespace `/realtime`** — the same one used by `TrackVoteGateway:34` and
`ListeningGateway:34`, so the mobile app keeps a *single* socket for listening,
voting and playlist editing. **Room `playlist:<id>`**, one per playlist.

Handshake authentication is copied verbatim from the two existing gateways: read
the token from `handshake.auth.token` or the `Authorization` header, verify it
against `JWT_SECRET`, reject if `blacklist:${token}` is present in the cache,
then stash `userId` / `username` on `client.data`.

### Event contract

| Direction | Event | Payload |
|---|---|---|
| in | `playlist:join` | `{ playlistId }` |
| in | `playlist:leave` | `{ playlistId }` |
| in | `playlist:track:add` | `{ playlistId, ...AddTrackDto }` |
| in | `playlist:track:remove` | `{ playlistId, trackId }` |
| in | `playlist:reorder` | `{ playlistId, trackIds, version }` |
| out (room) | `playlist:state` | full `PlaylistState` |
| out (sender) | `playlist:error` | `{ message }` |
| out (sender) | `playlist:conflict` | `{ message, state }` |

`playlist:join` checks `assertCanView`, joins the room, and emits
`playlist:state` to that socket alone so a joiner does not wait for someone
else's edit. Every successful mutation triggers a room-wide broadcast.

### State shape

```ts
export type PlaylistState = {
    id: number;
    name: string;
    isPublic: boolean;
    version: number;
    owner: { id: number; username: string };
    collaborators: { id: number; username: string; avatar: string | null }[];
    tracks: PlaylistTrack[];   // sorted by position
    updatedAt: number;         // Date.now(), mirrors VoteBoard.updatedAt
};
```

**Full state rather than deltas.** This matches what `broadcastBoard` already
does, a playlist is a few dozen rows, and it removes an entire class of
divergence bugs where a dropped delta leaves two clients permanently
disagreeing.

**One simplification over track-vote.** `broadcastBoard:134` recomputes a board
*per socket* because `myVote` is user-specific, which is why it does
`fetchSockets()` and loops. A playlist state is identical for every viewer, so
`broadcastState` is a single `server.to(room).emit('playlist:state', state)`.

### Module wiring

`playlist-editor.module.ts` registers `PlaylistCollaborator` in
`forFeature`, adds `PlaylistEditorGateway` to `providers`, and re-registers
`JwtModule` with `JWT_SECRET` — `AuthModule` does not export `JwtModule`, the
same reason and the same code as `track-vote.module.ts:22`.

---

## Part 4 — REST parity

REST stays the source of truth for first load and the fallback when the socket
does not connect, exactly as documented in `track-vote.controller.ts:13`.

For that to hold, REST mutations must also notify socket clients, or an edit
made over the REST fallback would be invisible to everyone else. The controller
injects the gateway and calls `await this.gateway.broadcastState(id)` after
`addTrack`, `removeTrack`, `reorder` and `update` — the same shape as
`track-vote.controller.ts` lines 43, 57, 75 and 92. There is no dependency
cycle: controller → gateway → service.

`reorder` over REST returns 409 on a stale version, carrying the fresh state in
the exception body.

---

## Part 5 — Mobile

### `RealtimeContext.tsx`

Extends the existing provider rather than adding a second socket:

- state `playlistState: PlaylistState | undefined`
- `joinPlaylist(id)` / `leavePlaylist(id)`
- `addTrackRealtime(id, dto)`, `removeTrackRealtime(id, trackId)`,
  `reorderRealtime(id, trackIds, version)`
- a `joinedPlaylistIdRef`, re-emitted on `connect`, mirroring how
  `joinedEventIdRef` is replayed at line 115 — a room does not survive a
  reconnection
- `playlist:error` → toast, mirroring the `vote:error` listener at line 138
- `playlist:conflict` → toast plus adoption of the server state

### `PlaylistEditorScreen.tsx`

Driven by `playlistState` while `connected`; otherwise it keeps today's REST
behaviour plus a 20 s poll reusing the existing `FALLBACK_POLL_MS` constant.

`move()` stays optimistic locally (it already is, line 114) and is reconciled by
the next broadcast; it sends the `version` it last saw. On conflict the server
state wins and a toast explains why the row snapped back.

Owner-only controls (rename, visibility toggle, delete) are hidden when
`isOwner` is false.

### Collaborators UI

A minimal section in `PlaylistEditorScreen`, visible to the owner only: the
friend list from `GET /friendship/friends` with an add/remove toggle per friend,
plus a read-only list of current collaborators for everyone. Without it the
feature cannot be exercised from the app at all.

### Expo

`mobile/AGENTS.md` requires reading the versioned docs at
<https://docs.expo.dev/versions/v56.0.0/> before writing mobile code. No new
native dependency is expected — `socket.io-client` is already in use.

---

## Part 6 — Testing

Existing style: mocked repositories injected via `getRepositoryToken`, as in
`event.service.spec.ts:44`.

`playlist-editor.service.spec.ts` (extended):

- `assertCanEdit` matrix: owner allowed, collaborator allowed, stranger 403
- private playlist: collaborator may `findOne`, stranger may not
- `findMine` returns owned + collaborating rows, with `isOwner` set correctly
- `addTrack` / `removeTrack` / `reorder` each bump `version`
- `reorder` with a stale `version` throws `ConflictException`
- `reorder` with no `version` still applies (backward compatibility)
- `sameSet` rejection still fires when the id set differs

`playlist-editor.gateway.spec.ts` (new):

- a socket with no token, or a blacklisted token, is disconnected
- `playlist:join` on a playlist the user cannot view emits `playlist:error` and
  does not join
- `playlist:join` emits `playlist:state` to the joining socket only
- add / remove / reorder each broadcast `playlist:state` to the room
- a stale reorder emits `playlist:conflict` to the sender and does not broadcast

Full suite must stay green: baseline before this work is 17 suites / 66 tests.

---

## Files touched

**Backend**

| File | Change |
|---|---|
| `playlist-collaborator.entity.ts` | new |
| `playlist-editor.gateway.ts` | new |
| `dto/add-collaborator.dto.ts` | new |
| `dto/reorder-tracks.dto.ts` | optional `version` |
| `playlist.entity.ts` | `version` column |
| `playlist-editor.service.ts` | `assertCanEdit` / `assertCanView`, version bumps, conflict, transaction, `findMine` + `findOne` widened, collaborator CRUD, `getState` |
| `playlist-editor.controller.ts` | collaborator routes, gateway broadcasts |
| `playlist-editor.module.ts` | entity, gateway, `JwtModule` |
| `playlist-editor.service.spec.ts` | extended |
| `playlist-editor.gateway.spec.ts` | new |

**Mobile**

| File | Change |
|---|---|
| `context/RealtimeContext.tsx` | playlist room, emitters, listeners |
| `lib/playlists.ts` | `version` on reorder, collaborator calls, `PlaylistState` type |
| `screens/PlaylistEditorScreen.tsx` | realtime-driven state, conflict handling, collaborators UI, owner-only gating |
| `screens/PlaylistsScreen.tsx` | show collaborating playlists |

---

## Known risks

- **`synchronize: true` on a live DB.** Adding `version` and the collaborator
  table is additive, so the sync is safe here, but this project has no migration
  story; anything destructive later will need one.
- **No pessimistic lock.** Two reorders landing inside the same millisecond can
  both read the same version inside their transactions. Postgres' default READ
  COMMITTED makes this rare and the losing writer's set is still coherent
  (the guard is a correctness aid, not a hard serialisation). A
  `SELECT ... FOR UPDATE` is the escalation if it ever bites.
- **Room membership vs. revoked access.** Revoking a collaborator does not kick
  their open socket out of the room; they keep receiving state until they leave
  the screen. Mutations are re-checked server-side on every event, so they
  cannot *write* — only observe. Accepted for this iteration.
