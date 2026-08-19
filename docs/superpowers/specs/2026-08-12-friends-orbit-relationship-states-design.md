# Friends Orbit — Non-Friend Relationship States — Design Spec

**Date:** 2026-08-12
**Scope:** `backend/src/friendship/` (small additions) + `mobile/src/screens/FriendsScreen.tsx`

---

## Problem

`FriendsScreen` renders friends and "others" as bubbles orbiting the user in
a holographic-style galaxy. The "others" ring is populated from
`GET /users/search?q=` (empty query = everyone), filtered only to exclude
existing friends. This means:

- Blocked users (either direction) still appear as ordinary grey bubbles.
- Users you've already sent a pending request to look identical to total
  strangers — tapping "Ajouter" again would 409.
- Users who sent *you* a pending request are invisible as such — there is no
  way to accept/reject them from this screen, and no pending-request UI
  exists anywhere in `mobile/` at all.
- Tapping a non-friend bubble does nothing: the selection card only renders
  when `selected?.isFriend` is true (`FriendsScreen.tsx:429`).

Goal: give every non-friend bubble a real state (stranger / pending-sent /
pending-received) and a real action (add / cancel / accept / reject /
block), and let blocked users be reviewed/unblocked outside the orbit.

Out of scope: notifications/badges outside this screen (e.g. a counter on
the Home screen tile), pagination of the stranger list beyond the existing
cap, and any change to the accepted-friend card/actions.

---

## Backend changes

All three follow the existing patterns in `friendship.service.ts` /
`friendship.controller.ts` — no new abstractions.

### 1. `GET /friendship/pending/sent`

Mirrors the existing `GET /friendship/pending` (which is receiver-only).

`FriendshipService.getSentPendingRequests(requesterId)`:
```ts
return this.friendshipRepository.find({
  where: { requester: { id: requesterId }, status: FriendshipStatus.PENDING },
  relations: ['requester', 'receiver'],
});
```

Controller returns the same shape as `getPendingRequests`, mirrored:
```ts
{ id, to: request.receiver.username, toId: request.receiver.id, createdAt }
```

### 2. `DELETE /friendship/request/:requestId`

Lets the requester cancel their own pending request (today `rejectRequest`
only matches `receiver: { id: receiverId }`, so the sender has no way to
undo it).

`FriendshipService.cancelSentRequest(requestId, requesterId)`: same lookup/
delete logic as `rejectRequest`, but `where: { id: requestId, requester: { id: requesterId }, status: FriendshipStatus.PENDING }`. Throws
`NotFoundException` if no match (mirrors `rejectRequest`).

Controller: `@Delete('request/:requestId')`, guarded, returns
`{ message: 'Friend request cancelled' }`.

### 3. `GET /friendship/blocked` — add ids to the response

Service is unchanged (`block.requester`/`block.receiver` are already
loaded). Controller's `getBlocks` mapping gains two fields so the mobile
client can match a block entry to a user id:

```ts
return blocks.map(block => ({
    id: block.id,
    blockedBy: block.requester.username,
    blockedById: block.requester.id,
    blockedUser: block.receiver.username,
    blockedUserId: block.receiver.id,
    isBlockedByMe: block.requester.id === user.id,
}));
```

No other backend endpoint changes — `POST /friendship/block/:targetId`,
`DELETE /friendship/block/:blockId`, `POST /friendship/request/:targetId`,
`PATCH /:requestId/accept`, `PATCH /:requestId/reject` are reused as-is.

---

## Mobile data model

`Person` (`FriendsScreen.tsx:35`) changes from `isFriend: boolean` to:

```ts
export type RelStatus = 'friend' | 'pending_sent' | 'pending_received' | 'stranger';

export type Person = {
    key: string;
    relId: number | null;   // friendship id (friend) OR pending request id (pending_sent/pending_received)
    userId: number;
    username: string;
    avatar: string | null;
    color: string;
    ang: number;
    dst: number;
    status: RelStatus;
};
```

`isFriend` is dropped as a stored field; every read site (`UserBubble`,
`PoolBackgroundView` props, sizing/coloring logic) switches to
`p.status === 'friend'`. `PoolBackgroundView` only reads the friends array
today (`friends={friends}` prop, already pre-filtered to `status==='friend'`
before being passed down), so it needs no changes.

---

## `loadData()` — merge logic

Fetch in parallel: `friendship/friends`, `friendship/pending`,
`friendship/pending/sent`, `friendship/blocked`, `users/search?q=`.

1. Build a `Set<number>` of blocked user ids from *both* `blockedById` and
   `blockedUserId` on every blocked entry (covers either direction) —
   these ids are excluded from `others` entirely, before anything else.
2. Build `Map<userId, requestId>` for pending-received and pending-sent
   from their respective endpoints.
3. Walk the `users/search?q=` result (still the source of "everyone"):
   skip friends and blocked ids; for the rest, assign `status` from the
   pending maps, defaulting to `'stranger'`.
4. Split the remaining list into `pendingOnes` (status !== 'stranger') and
   `strangers` (status === 'stranger'). **All** `pendingOnes` are kept;
   `strangers` is capped to 6, same as the current `.slice(0, 6)` — so an
   active pending relationship is never crowded out by decorative filler.
5. `others = [...pendingOnes, ...strangers]`, angles/distances distributed
   across that combined list exactly as today (even spacing by index).

Pending-received count (`pendingOnes.filter(p => p.status === 'pending_received').length`) is stored in state for the header badge.

---

## Visual language in the orbit

| Status | Size | Ring color | Fill (no avatar) | Pulse |
|---|---|---|---|---|
| `friend` | `FR_SZ` (58) | `GREEN` solid | existing per-user `COLORS` gradient | existing |
| `pending_received` | 50 (new `PR_SZ`) | `#f59e0b` (amber) | amber gradient `['#f59e0b', '#b45309']` | ring animation duration ×0.6 (noticeably faster/more urgent) |
| `pending_sent` | 46 (new `PS_SZ`) | `rgba(29,185,84,0.5)` (muted green) | muted green gradient `['#1a5c38', '#123f26']` | unchanged speed |
| `stranger` | `OT_SZ` (44) | `rgba(255,255,255,0.1)` (unchanged) | existing `GREY` round-robin | unchanged |

Name label opacity: keep the existing two-tier logic (`friend` bright,
everything else dim) — `pending_received`/`pending_sent` are visually
distinguished by ring/fill color, not by label brightness.

**Header badge**: small circular amber badge (`#f59e0b` background, white
bold count text, ~18px), absolutely positioned overlapping the top-right
corner of the existing green logo icon (`styles.logo`, `FriendsScreen.tsx:396`).
Rendered only when the pending-received count is > 0.

---

## Card actions per status

The selection card (`FriendsScreen.tsx:429`) currently renders only when
`selected?.isFriend`. It now renders for any `selected`, with a status-driven
action row instead of the hardcoded `['Voir le profil', 'Inviter à ecouter']`:

| Status | Actions |
|---|---|
| `friend` | Voir le profil / Inviter à ecouter (unchanged) |
| `stranger` | Ajouter en ami / Bloquer |
| `pending_sent` | (label, not a button) "Demande envoyee" / Annuler la demande |
| `pending_received` | Accepter / Refuser |

"Bloquer" shows a confirmation `Alert.alert` (Annuler / Bloquer, destructive
style) before calling `POST /friendship/block/:targetId` — blocking removes
the person from the orbit on the next `loadData()`, so it deserves a
confirmation step. All other actions call their endpoint directly and
`loadData()` on success, reusing the existing `Alert.alert('Erreur', e.message)`
pattern for failures.

---

## Blocked-users modal

New small icon button (Ionicons `shield-outline`) in `styles.headerLeft`,
same 36×36 style as the existing back button, placed right after it.
Opens a new `Modal` (same visual pattern as the existing search modal:
`modalOverlay`/`modalCard`) titled "Utilisateurs bloques", listing entries
from `GET /friendship/blocked` filtered to `isBlockedByMe === true` — entries
where someone else blocked you are excluded from this list entirely, since
there is no action to take on them. Each row: username + "Debloquer" button calling
`DELETE /friendship/block/:blockId`, then refreshing both the blocked list
and `loadData()`. Empty state: "Aucun utilisateur bloque".

---

## Error handling & edge cases

| Case | Behavior |
|---|---|
| Tap "Ajouter" on a `stranger` who blocked you (server returns 403) | `Alert.alert('Erreur', e.message)` — existing generic path, no special-casing needed since the backend message is already descriptive |
| Cancel a pending-sent request that the receiver just accepted/rejected in the meantime | `DELETE` 404s → generic error alert, then `loadData()` on next screen focus resolves the mismatch |
| Accept/reject a pending-received request that was cancelled by the sender in the meantime | Same — 404 → generic error alert |
| Block a user while their card is open | Card closes (`setSelKey(null)`) after successful `loadData()` refresh, since that person is no longer in `everyone` |
| `users/search` briefly includes a user whose block just landed (race) | Acceptable — resolves on next `loadData()`, no different from existing eventual-consistency in this screen |

---

## Testing

No test runner exists in `mobile/`. Backend gets unit tests for the three
new/changed methods, colocated per existing convention:

- `friendship.service.spec.ts`: `getSentPendingRequests` (mirrors the
  existing `getPendingRequests` test), `cancelSentRequest` (success +
  not-found-when-not-requester, mirroring `rejectRequest`'s tests).
- `friendship.controller.spec.ts`: new route wiring for
  `GET /pending/sent` and `DELETE /request/:requestId`; assert `getBlocks`
  response includes `blockedById`/`blockedUserId`.

Manual verification on mobile (`expo start` + `expo start --web`): seed two
accounts, send a request from A to B, confirm B sees an amber pending-received
bubble + header badge, A sees a muted-green pending-sent bubble; accept from
B, confirm both sides show a green friend bubble; block from A, confirm the
blocked user's bubble disappears from A's orbit and appears in A's "Utilisateurs
bloques" modal; unblock, confirm the bubble reappears as a stranger.

---

## Files to create / modify

| File | Action |
|---|---|
| `backend/src/friendship/friendship.service.ts` | Modify — add `getSentPendingRequests`, `cancelSentRequest` |
| `backend/src/friendship/friendship.controller.ts` | Modify — add `GET /pending/sent`, `DELETE /request/:requestId`, extend `getBlocks` mapping |
| `backend/src/friendship/friendship.service.spec.ts` | Modify — tests for the two new service methods |
| `backend/src/friendship/friendship.controller.spec.ts` | Modify — tests for the two new routes + extended `getBlocks` shape |
| `mobile/src/screens/FriendsScreen.tsx` | Modify — `Person.status` model, `loadData()` merge logic, per-status bubble styling, per-status card actions, header badge, blocked-users modal |

---

## Out of scope

- Any badge/counter outside `FriendsScreen` (e.g. Home screen tile).
- Pagination or search integration for the stranger ring beyond the
  existing 6-item decorative cap.
- Changing friend-card actions ("Voir le profil" / "Inviter à ecouter"
  remain placeholder `Alert`s, unrelated to this feature).
- Read-only handling of "who blocked me" beyond excluding them from the
  orbit (no dedicated UI to review who blocked you, since there is no
  action to take on them).
