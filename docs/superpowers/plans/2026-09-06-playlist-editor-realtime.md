# Real-time Collaborative Playlist Editing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let several invited users edit the same playlist simultaneously, with every add / remove / reorder pushed live to the other editors and concurrent reorders resolved by a version guard.

**Architecture:** A `PlaylistCollaborator` join table grants write access beyond the owner. A manually-bumped `version` column on `Playlist` guards `reorder` against concurrent reorders. A `PlaylistEditorGateway` on the existing `/realtime` socket.io namespace holds one room per playlist (`playlist:<id>`) and broadcasts the full playlist state after every mutation; the REST controller calls the same broadcast so the REST fallback stays visible to socket clients.

**Tech Stack:** NestJS 11, TypeORM 0.3 (Postgres, `synchronize: true`), socket.io 4 / `@nestjs/websockets`, Jest 30 + ts-jest, React Native / Expo 56, `socket.io-client`.

**Spec:** `docs/superpowers/specs/2026-09-06-playlist-editor-realtime-design.md`

## Global Constraints

- Backend indentation is **4 spaces** in `playlist-editor/*.ts` and `track-vote/*.ts`; mobile is **2 spaces**. Match the file you are editing.
- Code comments in this repo are written in **French**, without accents in backend files (`// Bug backend connu : ...`). Identifiers and API strings stay English.
- Socket namespace is `/realtime` — the same one as `TrackVoteGateway` and `ListeningGateway`. Do **not** create a second namespace; mobile keeps one socket.
- Gateway handshake auth must reject a token present in the cache under `blacklist:${token}`, identical to `track-vote.gateway.ts:59`.
- `AuthModule` does not export `JwtModule`. Any module with a gateway re-registers it with `JWT_SECRET` — copy `track-vote.module.ts:22-28`.
- No DB migration: `app.module.ts:28` runs `synchronize: true`.
- Before writing any mobile code, read the versioned Expo docs at <https://docs.expo.dev/versions/v56.0.0/> as required by `mobile/AGENTS.md`.
- Baseline test suite before this work: **17 suites / 66 tests passing**. It must stay green after every task.
- Run backend tests from `backend/`: `npx jest`.

---

### Task 1: Collaborator entity and permission helpers

**Files:**
- Create: `backend/src/playlist-editor/playlist-collaborator.entity.ts`
- Modify: `backend/src/playlist-editor/playlist.entity.ts` (add `version`)
- Modify: `backend/src/playlist-editor/playlist-editor.service.ts:12-15` (inject repos), `:51-60` (keep `findOwned`, add helpers)
- Modify: `backend/src/playlist-editor/playlist-editor.module.ts:9`
- Test: `backend/src/playlist-editor/playlist-editor.service.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PlaylistCollaborator` entity; `PlaylistEditorService.assertCanEdit(playlistId: number, userId: number): Promise<Playlist>`; `PlaylistEditorService.assertCanView(playlistId: number, userId: number): Promise<Playlist>`; `Playlist.version: number`.

- [ ] **Step 1: Write the failing test**

Replace the body of `playlist-editor.service.spec.ts` with a mocked-repository harness (the current file only asserts `toBeDefined`):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlaylistEditorService } from './playlist-editor.service';
import { Playlist } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistCollaborator } from './playlist-collaborator.entity';
import { User } from '../users/user.entity';

const OWNER = 1;
const COLLABORATOR = 2;
const STRANGER = 3;

describe('PlaylistEditorService', () => {
  let service: PlaylistEditorService;
  let playlists: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock; increment: jest.Mock; manager: { transaction: jest.Mock } };
  let tracks: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock; count: jest.Mock; update: jest.Mock };
  let collaborators: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let users: { findOne: jest.Mock };

  const basePlaylist = (over: Partial<Playlist> = {}) =>
    ({ id: 10, name: 'P', isPublic: true, version: 0, owner: { id: OWNER, username: 'owner' }, ...over }) as Playlist;

  beforeEach(async () => {
    playlists = {
      findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(),
      remove: jest.fn(), increment: jest.fn(), manager: { transaction: jest.fn() },
    };
    tracks = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), remove: jest.fn(), count: jest.fn(), update: jest.fn() };
    collaborators = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
    users = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistEditorService,
        { provide: getRepositoryToken(Playlist), useValue: playlists },
        { provide: getRepositoryToken(PlaylistTrack), useValue: tracks },
        { provide: getRepositoryToken(PlaylistCollaborator), useValue: collaborators },
        { provide: getRepositoryToken(User), useValue: users },
      ],
    }).compile();

    service = module.get<PlaylistEditorService>(PlaylistEditorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertCanEdit', () => {
    it('lets the owner through without looking up collaborators', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());

      await expect(service.assertCanEdit(10, OWNER)).resolves.toMatchObject({ id: 10 });
      expect(collaborators.findOne).not.toHaveBeenCalled();
    });

    it('lets an invited collaborator through', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.assertCanEdit(10, COLLABORATOR)).resolves.toMatchObject({ id: 10 });
    });

    it('rejects a stranger', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      collaborators.findOne.mockResolvedValue(null);

      await expect(service.assertCanEdit(10, STRANGER)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the playlist does not exist', async () => {
      playlists.findOne.mockResolvedValue(null);

      await expect(service.assertCanEdit(10, OWNER)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertCanView', () => {
    it('lets anyone view a public playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: true }));

      await expect(service.assertCanView(10, STRANGER)).resolves.toMatchObject({ id: 10 });
    });

    it('lets a collaborator view a private playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: false }));
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.assertCanView(10, COLLABORATOR)).resolves.toMatchObject({ id: 10 });
    });

    it('rejects a stranger on a private playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: false }));
      collaborators.findOne.mockResolvedValue(null);

      await expect(service.assertCanView(10, STRANGER)).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest playlist-editor.service`
Expected: FAIL — `Cannot find module './playlist-collaborator.entity'`.

- [ ] **Step 3: Create the entity**

`backend/src/playlist-editor/playlist-collaborator.entity.ts`:

```ts
import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Playlist } from './playlist.entity';

// Meme forme que EventInvite : invitation a sens unique, pas de negociation
// accepte/refuse. La ligne suffit a donner le droit d'edition.
@Entity()
@Unique(['playlist', 'collaborator'])
export class PlaylistCollaborator {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
    @JoinColumn()
    playlist: Playlist;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn()
    collaborator: User;

    @CreateDateColumn()
    createdAt: Date;
}
```

- [ ] **Step 4: Add the version column**

In `playlist.entity.ts`, after `isPublic` (line 14):

```ts
    // Incremente a la main par chaque mutation de contenu. @VersionColumn ne
    // conviendrait pas : add/removeTrack sauvegardent un PlaylistTrack, jamais
    // la Playlist, donc la version ne bougerait pas.
    @Column({ type: 'int', default: 0 })
    version: number;
```

- [ ] **Step 5: Add the helpers to the service**

In `playlist-editor.service.ts`, extend the constructor and add the helpers after `findOwned`:

```ts
    constructor(
        @InjectRepository(Playlist) private playlists: Repository<Playlist>,
        @InjectRepository(PlaylistTrack) private tracks: Repository<PlaylistTrack>,
        @InjectRepository(PlaylistCollaborator) private collaborators: Repository<PlaylistCollaborator>,
        @InjectRepository(User) private users: Repository<User>,
    ) {}
```

```ts
    private isCollaborator(playlistId: number, userId: number): Promise<boolean> {
        return this.collaborators
            .findOne({ where: { playlist: { id: playlistId }, collaborator: { id: userId } } })
            .then((row) => !!row);
    }

    private async load(id: number): Promise<Playlist> {
        // select restreint sur owner : sinon TypeORM renvoie tout l'entity User
        // avec ses tokens de reset/verif.
        const playlist = await this.playlists.findOne({
            where: { id },
            relations: { owner: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        return playlist;
    }

    /** Droit d'ecriture sur le contenu : proprietaire ou collaborateur invite. */
    async assertCanEdit(playlistId: number, userId: number): Promise<Playlist> {
        const playlist = await this.load(playlistId);
        if (playlist.owner.id === userId) return playlist;
        if (await this.isCollaborator(playlistId, userId)) return playlist;
        throw new ForbiddenException('You are not an editor of this playlist');
    }

    /** Droit de lecture : playlist publique, proprietaire, ou collaborateur. */
    async assertCanView(playlistId: number, userId: number): Promise<Playlist> {
        const playlist = await this.load(playlistId);
        if (playlist.isPublic) return playlist;
        if (playlist.owner.id === userId) return playlist;
        if (await this.isCollaborator(playlistId, userId)) return playlist;
        throw new ForbiddenException('This playlist is private');
    }
```

Add the imports: `PlaylistCollaborator` from `./playlist-collaborator.entity`, `User` from `../users/user.entity`.

- [ ] **Step 6: Register the entities in the module**

`playlist-editor.module.ts` line 9 becomes:

```ts
  imports: [TypeOrmModule.forFeature([Playlist, PlaylistTrack, PlaylistCollaborator, User])],
```

with the matching imports.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && npx jest`
Expected: PASS, suite count now 17, test count 66 + 7 new.

- [ ] **Step 8: Commit**

```bash
git add backend/src/playlist-editor/
git commit -m "feat(playlist): add collaborator entity and permission helpers"
```

---

### Task 2: Version bumps and the reorder conflict guard

**Files:**
- Modify: `backend/src/playlist-editor/playlist-editor.service.ts:73-101` (`addTrack`, `removeTrack`, `reorder`)
- Modify: `backend/src/playlist-editor/dto/reorder-tracks.dto.ts`
- Test: `backend/src/playlist-editor/playlist-editor.service.spec.ts`

**Interfaces:**
- Consumes: `assertCanEdit` from Task 1.
- Produces: `reorder(playlistId: number, userId: number, trackIds: number[], expectedVersion?: number): Promise<PlaylistState>`; `addTrack` / `removeTrack` now guarded by `assertCanEdit` and bumping `version`; `ReorderTracksDto.version?: number`.

- [ ] **Step 1: Write the failing test**

Append to `playlist-editor.service.spec.ts`:

```ts
  describe('reorder', () => {
    // La vraie methode passe par manager.transaction ; on execute le callback
    // avec un EntityManager mocke pour tester la logique sans base.
    function runTransactionWith(em: any) {
      playlists.manager.transaction.mockImplementation((cb: any) => cb(em));
    }

    it('rejects a reorder whose version is stale', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = {
        findOne: jest.fn().mockResolvedValue(basePlaylist({ version: 7 })),
        find: jest.fn(), update: jest.fn(), increment: jest.fn(),
      };
      runTransactionWith(em);

      await expect(service.reorder(10, OWNER, [2, 1], 5)).rejects.toThrow(ConflictException);
      expect(em.update).not.toHaveBeenCalled();
    });

    it('applies the new order and bumps the version when the version matches', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = {
        findOne: jest.fn().mockResolvedValue(basePlaylist({ version: 7 })),
        find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
        update: jest.fn(), increment: jest.fn(),
      };
      runTransactionWith(em);
      jest.spyOn(service, 'getState').mockResolvedValue({ id: 10, version: 8 } as any);

      await service.reorder(10, OWNER, [2, 1], 7);

      expect(em.update).toHaveBeenCalledWith(PlaylistTrack, 2, { position: 0 });
      expect(em.update).toHaveBeenCalledWith(PlaylistTrack, 1, { position: 1 });
      expect(em.increment).toHaveBeenCalledWith(Playlist, { id: 10 }, 'version', 1);
    });

    it('still applies when no version is supplied (REST backward compatibility)', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = {
        findOne: jest.fn().mockResolvedValue(basePlaylist({ version: 7 })),
        find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
        update: jest.fn(), increment: jest.fn(),
      };
      runTransactionWith(em);
      jest.spyOn(service, 'getState').mockResolvedValue({ id: 10 } as any);

      await service.reorder(10, OWNER, [2, 1]);

      expect(em.update).toHaveBeenCalledTimes(2);
    });

    it('still rejects a track set that does not match the playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = {
        findOne: jest.fn().mockResolvedValue(basePlaylist({ version: 7 })),
        find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
        update: jest.fn(), increment: jest.fn(),
      };
      runTransactionWith(em);

      await expect(service.reorder(10, OWNER, [2, 1], 7)).rejects.toThrow(ForbiddenException);
      expect(em.update).not.toHaveBeenCalled();
    });
  });

  describe('version bumps', () => {
    it('bumps the version when a track is added', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      tracks.count.mockResolvedValue(2);
      tracks.create.mockReturnValue({ id: 5 });
      tracks.save.mockResolvedValue({ id: 5, position: 2 });

      await service.addTrack(10, OWNER, { deezerId: 'd', title: 't', artist: 'a', previewUrl: 'u' } as any);

      expect(playlists.increment).toHaveBeenCalledWith({ id: 10 }, 'version', 1);
    });

    it('bumps the version when a track is removed', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      tracks.findOne.mockResolvedValue({ id: 5 });

      await service.removeTrack(10, 5, OWNER);

      expect(playlists.increment).toHaveBeenCalledWith({ id: 10 }, 'version', 1);
    });
  });
```

Add `ConflictException` to the `@nestjs/common` import at the top of the spec.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest playlist-editor.service`
Expected: FAIL — `service.getState is not a function`, and the reorder tests fail because no transaction is used yet.

- [ ] **Step 3: Add the optional version to the DTO**

`dto/reorder-tracks.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional } from 'class-validator';

export class ReorderTracksDto {
    @ApiProperty({ type: [Number], description: "ids des lignes de tracks, dans l'ordre voulu" })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    trackIds: number[];

    @ApiProperty({
        required: false,
        description: 'Version de playlist vue par le client. Si elle est perimee, le reorder est refuse en 409.',
    })
    @IsOptional()
    @IsInt()
    version?: number;
}
```

- [ ] **Step 4: Rewrite the three mutations**

In `playlist-editor.service.ts`:

```ts
    private bumpVersion(playlistId: number) {
        return this.playlists.increment({ id: playlistId }, 'version', 1);
    }

    async addTrack(playlistId: number, userId: number, dto: AddTrackDto) {
        const playlist = await this.assertCanEdit(playlistId, userId);
        const position = await this.tracks.count({ where: { playlist: { id: playlist.id } } });
        // juste l'id pour la relation, pas besoin de renvoyer la playlist entiere
        const track = this.tracks.create({ ...dto, position, playlist: { id: playlist.id } as any });
        const saved = await this.tracks.save(track);
        await this.bumpVersion(playlist.id);
        return saved;
    }

    async removeTrack(playlistId: number, trackId: number, userId: number): Promise<void> {
        await this.assertCanEdit(playlistId, userId);
        const track = await this.tracks.findOne({ where: { id: trackId, playlist: { id: playlistId } } });
        if (!track) throw new NotFoundException('Track not found in this playlist');
        await this.tracks.remove(track);
        await this.bumpVersion(playlistId);
    }

    /**
     * expectedVersion absent = dernier ecrit gagne (compatibilite REST).
     * Fourni, il attrape le cas que sameSet laisse passer : quelqu'un a
     * reordonne pendant qu'on deplacait, meme jeu d'ids mais autre ordre.
     * Le tout en transaction : un Promise.all d'updates pouvait laisser un
     * ordre a moitie applique si une requete echouait.
     */
    async reorder(playlistId: number, userId: number, trackIds: number[], expectedVersion?: number) {
        await this.assertCanEdit(playlistId, userId);

        await this.playlists.manager.transaction(async (em) => {
            const playlist = await em.findOne(Playlist, { where: { id: playlistId } });
            if (!playlist) throw new NotFoundException('Playlist not found');
            if (expectedVersion != null && expectedVersion !== playlist.version) {
                throw new ConflictException('Playlist changed while you were reordering');
            }

            const currentTracks = await em.find(PlaylistTrack, { where: { playlist: { id: playlistId } } });
            const currentIds = currentTracks.map((t) => t.id).sort((a, b) => a - b);
            const requestedIds = [...trackIds].sort((a, b) => a - b);
            const sameSet =
                currentIds.length === requestedIds.length && currentIds.every((id, i) => id === requestedIds[i]);
            if (!sameSet) {
                throw new ForbiddenException('trackIds must match exactly the tracks currently in the playlist');
            }

            for (const [index, trackId] of trackIds.entries()) {
                await em.update(PlaylistTrack, trackId, { position: index });
            }
            await em.increment(Playlist, { id: playlistId }, 'version', 1);
        });

        return this.getState(playlistId);
    }
```

Add `ConflictException` to the `@nestjs/common` import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest playlist-editor.service`
Expected: the `getState` tests still fail (it does not exist yet) — that is Task 3. The reorder and version-bump assertions must pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/playlist-editor/
git commit -m "feat(playlist): version guard and transaction on reorder"
```

---

### Task 3: `getState`, widened reads, collaborator CRUD

**Files:**
- Modify: `backend/src/playlist-editor/playlist-editor.service.ts:26-49` (`findMine`, `findOne`)
- Test: `backend/src/playlist-editor/playlist-editor.service.spec.ts`

**Interfaces:**
- Consumes: `assertCanView`, `assertCanEdit`, `findOwned`.
- Produces:
  - `PlaylistState` type (exported from the service file)
  - `getState(playlistId: number): Promise<PlaylistState>`
  - `listCollaborators(playlistId: number, userId: number): Promise<CollaboratorSummary[]>`
  - `addCollaborator(playlistId: number, ownerId: number, userId: number): Promise<PlaylistCollaborator>`
  - `removeCollaborator(playlistId: number, ownerId: number, userId: number): Promise<void>`
  - `findMine` rows gain `isOwner: boolean`

- [ ] **Step 1: Write the failing test**

Append to `playlist-editor.service.spec.ts`:

```ts
  describe('getState', () => {
    it('returns tracks sorted by position with the version and collaborators', async () => {
      playlists.findOne.mockResolvedValue(
        basePlaylist({ version: 3, tracks: [{ id: 2, position: 1 }, { id: 1, position: 0 }] as any }),
      );
      collaborators.find.mockResolvedValue([
        { collaborator: { id: COLLABORATOR, username: 'bob', avatar: 'a.png' } },
      ]);

      const state = await service.getState(10);

      expect(state.version).toBe(3);
      expect(state.tracks.map((t) => t.id)).toEqual([1, 2]);
      expect(state.collaborators).toEqual([{ id: COLLABORATOR, username: 'bob', avatar: 'a.png' }]);
      expect(state.owner).toEqual({ id: OWNER, username: 'owner' });
    });
  });

  describe('findMine', () => {
    it('returns owned playlists and the ones I collaborate on, flagged with isOwner', async () => {
      playlists.find
        .mockResolvedValueOnce([basePlaylist({ id: 10 })])
        .mockResolvedValueOnce([basePlaylist({ id: 20, owner: { id: 42, username: 'someoneElse' } as any })]);
      collaborators.find.mockResolvedValue([{ playlist: { id: 20 } }]);

      const rows = await service.findMine(OWNER);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ id: 10, isOwner: true });
      expect(rows[1]).toMatchObject({ id: 20, isOwner: false });
    });

    it('does not query playlists a second time when I collaborate on none', async () => {
      playlists.find.mockResolvedValueOnce([basePlaylist({ id: 10 })]);
      collaborators.find.mockResolvedValue([]);

      const rows = await service.findMine(OWNER);

      expect(rows).toEqual([expect.objectContaining({ id: 10, isOwner: true })]);
      expect(playlists.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('collaborators', () => {
    it('refuses to add a collaborator when the requester is not the owner', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());

      await expect(service.addCollaborator(10, STRANGER, COLLABORATOR)).rejects.toThrow(ForbiddenException);
    });

    it('refuses to add a user that does not exist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      users.findOne.mockResolvedValue(null);

      await expect(service.addCollaborator(10, OWNER, 404)).rejects.toThrow(NotFoundException);
    });

    it('is idempotent when the collaborator is already invited', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      users.findOne.mockResolvedValue({ id: COLLABORATOR });
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.addCollaborator(10, OWNER, COLLABORATOR)).resolves.toMatchObject({ id: 99 });
      expect(collaborators.save).not.toHaveBeenCalled();
    });

    it('refuses to add the owner as their own collaborator', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());

      await expect(service.addCollaborator(10, OWNER, OWNER)).rejects.toThrow(BadRequestException);
    });
  });
```

Add `BadRequestException` to the spec's `@nestjs/common` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest playlist-editor.service`
Expected: FAIL — `service.getState is not a function`.

- [ ] **Step 3: Implement**

In `playlist-editor.service.ts`, add the exported types near the top:

```ts
export type CollaboratorSummary = { id: number; username: string; avatar: string | null };

export type PlaylistState = {
    id: number;
    name: string;
    isPublic: boolean;
    version: number;
    owner: { id: number; username: string };
    collaborators: CollaboratorSummary[];
    tracks: PlaylistTrack[];
    updatedAt: number;
};
```

Replace `findMine`, extend `findOne`, and add the new methods:

```ts
    async findMine(userId: number) {
        // tracks charge juste pour le compteur affiche dans la liste cote mobile
        const owned = await this.playlists.find({
            where: { owner: { id: userId } },
            relations: { tracks: true },
            order: { createdAt: 'DESC' },
        });

        const rows = await this.collaborators.find({
            where: { collaborator: { id: userId } },
            relations: { playlist: true },
        });
        const sharedIds = rows.map((row) => row.playlist.id);
        const shared = sharedIds.length
            ? await this.playlists.find({
                  where: { id: In(sharedIds) },
                  relations: { tracks: true, owner: true },
                  select: { owner: { id: true, username: true } },
                  order: { createdAt: 'DESC' },
              })
            : [];

        // isOwner : le mobile masque renommage/visibilite/suppression dessus
        return [
            ...owned.map((playlist) => ({ ...playlist, isOwner: true })),
            ...shared.map((playlist) => ({ ...playlist, isOwner: false })),
        ];
    }

    async findOne(id: number, requesterId: number) {
        await this.assertCanView(id, requesterId);
        const playlist = await this.playlists.findOne({
            where: { id },
            relations: { owner: true, tracks: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        playlist.tracks.sort((a, b) => a.position - b.position);
        return { ...playlist, isOwner: playlist.owner.id === requesterId };
    }

    /**
     * Etat diffuse a toute la room par le gateway. Identique pour tous les
     * spectateurs (contrairement au board de track-vote qui porte un myVote par
     * utilisateur), donc calcule une seule fois par diffusion.
     */
    async getState(playlistId: number): Promise<PlaylistState> {
        const playlist = await this.playlists.findOne({
            where: { id: playlistId },
            relations: { owner: true, tracks: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        playlist.tracks.sort((a, b) => a.position - b.position);

        return {
            id: playlist.id,
            name: playlist.name,
            isPublic: playlist.isPublic,
            version: playlist.version,
            owner: { id: playlist.owner.id, username: playlist.owner.username },
            collaborators: await this.collaboratorSummaries(playlistId),
            tracks: playlist.tracks,
            updatedAt: Date.now(),
        };
    }

    private async collaboratorSummaries(playlistId: number): Promise<CollaboratorSummary[]> {
        const rows = await this.collaborators.find({
            where: { playlist: { id: playlistId } },
            relations: { collaborator: true },
            select: { collaborator: { id: true, username: true, avatar: true } },
        });
        return rows.map((row) => ({
            id: row.collaborator.id,
            username: row.collaborator.username,
            avatar: row.collaborator.avatar ?? null,
        }));
    }

    async listCollaborators(playlistId: number, userId: number): Promise<CollaboratorSummary[]> {
        await this.assertCanView(playlistId, userId);
        return this.collaboratorSummaries(playlistId);
    }

    async addCollaborator(playlistId: number, ownerId: number, userId: number) {
        await this.findOwned(playlistId, ownerId);
        if (userId === ownerId) throw new BadRequestException('The owner is already an editor');

        const user = await this.users.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // idempotent : reinviter quelqu'un ne doit pas casser, la contrainte
        // @Unique est la pour la base, pas pour l'appelant
        const existing = await this.collaborators.findOne({
            where: { playlist: { id: playlistId }, collaborator: { id: userId } },
        });
        if (existing) return existing;

        return this.collaborators.save(
            this.collaborators.create({
                playlist: { id: playlistId } as any,
                collaborator: { id: userId } as any,
            }),
        );
    }

    async removeCollaborator(playlistId: number, ownerId: number, userId: number): Promise<void> {
        await this.findOwned(playlistId, ownerId);
        await this.collaborators.delete({ playlist: { id: playlistId }, collaborator: { id: userId } });
    }
```

Add `In` to the `typeorm` import and `BadRequestException` to the `@nestjs/common` import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest`
Expected: PASS, all suites green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/playlist-editor/
git commit -m "feat(playlist): getState, collaborator CRUD, shared playlists in findMine"
```

---

### Task 4: Collaborator REST endpoints

**Files:**
- Modify: `backend/src/playlist-editor/playlist-editor.controller.ts`
- Create: `backend/src/playlist-editor/dto/add-collaborator.dto.ts`
- Test: `backend/src/playlist-editor/playlist-editor.controller.spec.ts`

**Interfaces:**
- Consumes: `listCollaborators`, `addCollaborator`, `removeCollaborator` from Task 3.
- Produces: `GET|POST /playlist-editor/:id/collaborators`, `DELETE /playlist-editor/:id/collaborators/:userId`.

- [ ] **Step 1: Write the failing test**

Replace `playlist-editor.controller.spec.ts` with:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistEditorController } from './playlist-editor.controller';
import { PlaylistEditorService } from './playlist-editor.service';
import { PlaylistEditorGateway } from './playlist-editor.gateway';

describe('PlaylistEditorController', () => {
  let controller: PlaylistEditorController;
  let service: Record<string, jest.Mock>;
  let gateway: { broadcastState: jest.Mock };

  beforeEach(async () => {
    service = {
      listCollaborators: jest.fn().mockResolvedValue([]),
      addCollaborator: jest.fn().mockResolvedValue({ id: 1 }),
      removeCollaborator: jest.fn().mockResolvedValue(undefined),
      addTrack: jest.fn().mockResolvedValue({ id: 5 }),
      reorder: jest.fn().mockResolvedValue({ id: 10 }),
    };
    gateway = { broadcastState: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistEditorController],
      providers: [
        { provide: PlaylistEditorService, useValue: service },
        { provide: PlaylistEditorGateway, useValue: gateway },
      ],
    }).compile();

    controller = module.get<PlaylistEditorController>(PlaylistEditorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('adds a collaborator through the service', async () => {
    await controller.addCollaborator({ id: 1 }, 10, { userId: 2 });
    expect(service.addCollaborator).toHaveBeenCalledWith(10, 1, 2);
  });

  it('removes a collaborator through the service', async () => {
    await controller.removeCollaborator({ id: 1 }, 10, 2);
    expect(service.removeCollaborator).toHaveBeenCalledWith(10, 1, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest playlist-editor.controller`
Expected: FAIL — `Cannot find module './playlist-editor.gateway'`.

- [ ] **Step 3: Create the DTO**

`dto/add-collaborator.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AddCollaboratorDto {
    @ApiProperty({ description: "id de l'utilisateur a qui donner le droit d'edition" })
    @IsInt()
    userId: number;
}
```

- [ ] **Step 4: Add the routes**

Append to `playlist-editor.controller.ts`:

```ts
    @ApiOperation({ summary: 'List the editors of a playlist' })
    @Get(':id/collaborators')
    listCollaborators(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.service.listCollaborators(id, user.id);
    }

    @ApiOperation({ summary: 'Grant edit rights on a playlist to another user' })
    @ApiResponse({ status: 403, description: 'Only the owner can invite editors' })
    @Post(':id/collaborators')
    addCollaborator(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AddCollaboratorDto,
    ) {
        return this.service.addCollaborator(id, user.id, dto.userId);
    }

    @ApiOperation({ summary: 'Revoke edit rights' })
    @Delete(':id/collaborators/:userId')
    removeCollaborator(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('userId', ParseIntPipe) userId: number,
    ) {
        return this.service.removeCollaborator(id, user.id, userId);
    }
```

Note: `@Get(':id/collaborators')` must be declared **before** the existing `@Get(':id')` is fine either way in Nest (static segments win over params at the same depth), but keep the collaborator routes grouped at the end of the class for readability.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest playlist-editor.controller`
Expected: still FAIL on the missing gateway module — that is Task 5. Do not commit yet; proceed.

---

### Task 5: The gateway

**Files:**
- Create: `backend/src/playlist-editor/playlist-editor.gateway.ts`
- Create: `backend/src/playlist-editor/playlist-editor.gateway.spec.ts`
- Modify: `backend/src/playlist-editor/playlist-editor.module.ts`
- Modify: `backend/src/playlist-editor/playlist-editor.controller.ts` (inject gateway, broadcast)

**Interfaces:**
- Consumes: `assertCanView`, `assertCanEdit`, `getState`, `addTrack`, `removeTrack`, `reorder`.
- Produces: `PlaylistEditorGateway.broadcastState(playlistId: number): Promise<void>`; `playlistRoomOf(playlistId: number): string`.

- [ ] **Step 1: Write the failing test**

`playlist-editor.gateway.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException } from '@nestjs/common';
import { PlaylistEditorGateway, playlistRoomOf } from './playlist-editor.gateway';
import { PlaylistEditorService } from './playlist-editor.service';

describe('PlaylistEditorGateway', () => {
  let gateway: PlaylistEditorGateway;
  let service: Record<string, jest.Mock>;
  let emit: jest.Mock;

  const STATE = { id: 10, version: 4, tracks: [] } as any;

  function socket(userId = 1) {
    return { data: { userId, username: 'u' }, join: jest.fn(), leave: jest.fn(), emit: jest.fn() } as any;
  }

  beforeEach(async () => {
    service = {
      assertCanView: jest.fn().mockResolvedValue({ id: 10 }),
      getState: jest.fn().mockResolvedValue(STATE),
      addTrack: jest.fn().mockResolvedValue({ id: 5 }),
      removeTrack: jest.fn().mockResolvedValue(undefined),
      reorder: jest.fn().mockResolvedValue(STATE),
    };
    emit = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistEditorGateway,
        { provide: PlaylistEditorService, useValue: service },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    gateway = module.get(PlaylistEditorGateway);
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as any;
  });

  it('sends the state only to the joining socket', async () => {
    const client = socket();

    await gateway.onJoin(client, { playlistId: 10 });

    expect(client.join).toHaveBeenCalledWith(playlistRoomOf(10));
    expect(client.emit).toHaveBeenCalledWith('playlist:state', STATE);
    expect(emit).not.toHaveBeenCalled();
  });

  it('refuses to join a playlist the user cannot view', async () => {
    service.assertCanView.mockRejectedValue(new Error('nope'));
    const client = socket();

    await gateway.onJoin(client, { playlistId: 10 });

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('playlist:error', { message: 'Cannot open this playlist' });
  });

  it('broadcasts the state to the whole room after an add', async () => {
    await gateway.onAddTrack(socket(), { playlistId: 10, deezerId: 'd', title: 't', artist: 'a', previewUrl: 'u' } as any);

    expect(gateway.server.to).toHaveBeenCalledWith(playlistRoomOf(10));
    expect(emit).toHaveBeenCalledWith('playlist:state', STATE);
  });

  it('broadcasts the state to the whole room after a remove', async () => {
    await gateway.onRemoveTrack(socket(), { playlistId: 10, trackId: 5 });

    expect(emit).toHaveBeenCalledWith('playlist:state', STATE);
  });

  it('sends playlist:conflict to the sender and does not broadcast on a stale reorder', async () => {
    service.reorder.mockRejectedValue(new ConflictException('stale'));
    const client = socket();

    await gateway.onReorder(client, { playlistId: 10, trackIds: [2, 1], version: 1 });

    expect(client.emit).toHaveBeenCalledWith('playlist:conflict', { message: 'stale', state: STATE });
    expect(emit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest playlist-editor.gateway`
Expected: FAIL — `Cannot find module './playlist-editor.gateway'`.

- [ ] **Step 3: Write the gateway**

`playlist-editor.gateway.ts`:

```ts
import { ConflictException, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlaylistEditorService } from './playlist-editor.service';
import { AddTrackDto } from './dto/add-track.dto';

type AuthedSocket = Socket & { data: { userId: number; username: string } };

export function playlistRoomOf(playlistId: number): string {
    return `playlist:${playlistId}`;
}

/**
 * Meme namespace '/realtime' que ListeningGateway et TrackVoteGateway : un seul
 * socket cote mobile. Une room par playlist, tous les editeurs recoivent le
 * meme etat.
 * REST reste la source de verite / le repli (voir PlaylistEditorController) ;
 * ce gateway ne fait que pousser l'etat a la room.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class PlaylistEditorGateway implements OnGatewayConnection {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(PlaylistEditorGateway.name);

    constructor(
        private playlists: PlaylistEditorService,
        private jwt: JwtService,
        private config: ConfigService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    async handleConnection(client: AuthedSocket) {
        const token = this.extractToken(client);
        if (!token) return client.disconnect(true);

        try {
            const payload = await this.jwt.verifyAsync<{ sub: number; username: string }>(token, {
                secret: this.config.get<string>('JWT_SECRET'),
            });
            // meme liste noire que JwtStrategy : un token revoque ne doit pas
            // ouvrir un socket alors qu'il est refuse en HTTP
            if (await this.cache.get(`blacklist:${token}`)) return client.disconnect(true);

            client.data.userId = payload.sub;
            client.data.username = payload.username;
        } catch {
            client.disconnect(true);
        }
    }

    @SubscribeMessage('playlist:join')
    async onJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { playlistId: number }) {
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            await this.playlists.assertCanView(dto.playlistId, userId);
        } catch {
            client.emit('playlist:error', { message: 'Cannot open this playlist' });
            return;
        }
        await client.join(playlistRoomOf(dto.playlistId));
        // snapshot immediat : le joiner n'attend pas l'edition de quelqu'un d'autre
        client.emit('playlist:state', await this.playlists.getState(dto.playlistId));
    }

    @SubscribeMessage('playlist:leave')
    async onLeave(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { playlistId: number }) {
        await client.leave(playlistRoomOf(dto.playlistId));
    }

    @SubscribeMessage('playlist:track:add')
    async onAddTrack(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() dto: AddTrackDto & { playlistId: number },
    ) {
        const userId = client.data?.userId;
        if (!userId) return;
        const { playlistId, ...track } = dto;
        try {
            await this.playlists.addTrack(playlistId, userId, track);
        } catch (err) {
            client.emit('playlist:error', { message: err instanceof Error ? err.message : 'Failed to add track' });
            return;
        }
        await this.broadcastState(playlistId);
    }

    @SubscribeMessage('playlist:track:remove')
    async onRemoveTrack(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() dto: { playlistId: number; trackId: number },
    ) {
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            await this.playlists.removeTrack(dto.playlistId, dto.trackId, userId);
        } catch (err) {
            client.emit('playlist:error', { message: err instanceof Error ? err.message : 'Failed to remove track' });
            return;
        }
        await this.broadcastState(dto.playlistId);
    }

    @SubscribeMessage('playlist:reorder')
    async onReorder(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() dto: { playlistId: number; trackIds: number[]; version?: number },
    ) {
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            await this.playlists.reorder(dto.playlistId, userId, dto.trackIds, dto.version);
        } catch (err) {
            // Conflit : on renvoie l'etat frais a l'emetteur seul, pour qu'il
            // adopte l'ordre du serveur au lieu de deviner.
            if (err instanceof ConflictException) {
                client.emit('playlist:conflict', {
                    message: err.message,
                    state: await this.playlists.getState(dto.playlistId),
                });
                return;
            }
            client.emit('playlist:error', { message: err instanceof Error ? err.message : 'Failed to reorder' });
            return;
        }
        await this.broadcastState(dto.playlistId);
    }

    /**
     * Un etat de playlist est identique pour tous les spectateurs, contrairement
     * au board de track-vote qui porte un myVote par utilisateur : une seule
     * lecture et un seul emit suffisent, pas de boucle sur fetchSockets().
     */
    async broadcastState(playlistId: number) {
        const state = await this.playlists.getState(playlistId);
        this.server.to(playlistRoomOf(playlistId)).emit('playlist:state', state);
    }

    private extractToken(client: Socket): string | null {
        const fromAuth = client.handshake.auth?.token;
        if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
        const header = client.handshake.headers?.authorization;
        if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
        return null;
    }
}
```

- [ ] **Step 4: Wire the module**

`playlist-editor.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlaylistEditorController } from './playlist-editor.controller';
import { PlaylistEditorService } from './playlist-editor.service';
import { PlaylistEditorGateway } from './playlist-editor.gateway';
import { Playlist } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistCollaborator } from './playlist-collaborator.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Playlist, PlaylistTrack, PlaylistCollaborator, User]),
    // AuthModule n'exporte pas JwtModule : on le reenregistre avec le meme
    // secret pour que le gateway puisse verifier le token de la poignee de main
    // (meme pattern que TrackVoteModule).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [PlaylistEditorController],
  providers: [PlaylistEditorService, PlaylistEditorGateway],
  exports: [PlaylistEditorService],
})
export class PlaylistEditorModule {}
```

- [ ] **Step 5: Make REST notify the room**

In `playlist-editor.controller.ts`, inject the gateway and broadcast after every mutation — the same shape as `track-vote.controller.ts:43`:

```ts
    constructor(
        private readonly service: PlaylistEditorService,
        private readonly gateway: PlaylistEditorGateway,
    ) {}
```

```ts
    @Patch(':id')
    async update(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlaylistDto) {
        const playlist = await this.service.update(id, user.id, dto);
        await this.gateway.broadcastState(id);
        return playlist;
    }

    @Post(':id/tracks')
    async addTrack(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: AddTrackDto) {
        const track = await this.service.addTrack(id, user.id, dto);
        await this.gateway.broadcastState(id);
        return track;
    }

    @Delete(':id/tracks/:trackId')
    async removeTrack(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('trackId', ParseIntPipe) trackId: number,
    ) {
        await this.service.removeTrack(id, trackId, user.id);
        await this.gateway.broadcastState(id);
    }

    @ApiResponse({ status: 409, description: 'Playlist changed while you were reordering' })
    @Patch(':id/tracks/reorder')
    async reorder(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: ReorderTracksDto) {
        const state = await this.service.reorder(id, user.id, dto.trackIds, dto.version);
        await this.gateway.broadcastState(id);
        return state;
    }
```

Keep the existing `@ApiOperation` decorators on each route.

- [ ] **Step 6: Run the full suite**

Run: `cd backend && npx jest`
Expected: PASS — all suites, including the controller spec from Task 4.

- [ ] **Step 7: Typecheck**

Run: `cd backend && npx tsc -p tsconfig.build.json --noEmit`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add backend/src/playlist-editor/
git commit -m "feat(playlist): realtime gateway with room per playlist"
```

---

### Task 6: Mobile API layer

**Files:**
- Modify: `mobile/src/lib/playlists.ts`

**Interfaces:**
- Consumes: the REST routes from Tasks 4 and 5.
- Produces: `PlaylistState`, `PlaylistCollaborator` types; `listCollaborators`, `addCollaborator`, `removeCollaborator`; `reorderPlaylistTracks(..., version?)`; `ApiPlaylist.isOwner`.

- [ ] **Step 1: Extend the types**

In `mobile/src/lib/playlists.ts`, add `isOwner` and `version` to `ApiPlaylist` and add the new surface:

```ts
export type ApiPlaylist = {
  id: number;
  name: string;
  isPublic: boolean;
  version: number;
  owner: { id: number; username: string };
  tracks?: ApiPlaylistTrack[];
  isOwner?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlaylistCollaborator = {
  id: number;
  username: string;
  avatar: string | null;
};

/** Etat pousse par le gateway sur playlist:state. */
export type PlaylistState = {
  id: number;
  name: string;
  isPublic: boolean;
  version: number;
  owner: { id: number; username: string };
  collaborators: PlaylistCollaborator[];
  tracks: ApiPlaylistTrack[];
  updatedAt: number;
};

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
```

Change the reorder signature to carry the version:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/lib/playlists.ts
git commit -m "feat(mobile): playlist collaborator and state API types"
```

---

### Task 7: `RealtimeContext` playlist room

**Files:**
- Modify: `mobile/src/context/RealtimeContext.tsx`

**Interfaces:**
- Consumes: `PlaylistState` from Task 6; the gateway events from Task 5.
- Produces: on the context value — `playlistState: PlaylistState | undefined`, `joinPlaylist(playlistId: number): void`, `leavePlaylist(playlistId: number): void`, `addTrackRealtime(playlistId: number, dto: AddTrackInput): void`, `removeTrackRealtime(playlistId: number, trackId: number): void`, `reorderRealtime(playlistId: number, trackIds: number[], version: number): void`.

- [ ] **Step 1: Read the Expo docs**

Per `mobile/AGENTS.md`, skim <https://docs.expo.dev/versions/v56.0.0/> before editing. No new native module is added here — `socket.io-client` is already a dependency.

- [ ] **Step 2: Add state, ref and type**

Import `PlaylistState` and `AddTrackInput` from `../lib/playlists`. Next to `voteBoard` (line 83) and `joinedEventIdRef` (line 86):

```tsx
    const [playlistState, setPlaylistState] = useState<PlaylistState | undefined>(undefined);
    // rejoint automatiquement à la reconnexion si un éditeur de playlist est ouvert
    const joinedPlaylistIdRef = useRef<number | null>(null);
```

- [ ] **Step 3: Replay the room on reconnect and add the listeners**

Inside the `socket.on('connect', ...)` handler, after the existing event rejoin (line 115):

```tsx
            // reconnexion : la room de playlist n'a pas survécu à la coupure
            if (joinedPlaylistIdRef.current != null) {
                socket.emit('playlist:join', { playlistId: joinedPlaylistIdRef.current });
            }
```

After the `vote:error` listener (line 140):

```tsx
        socket.on('playlist:state', (state: PlaylistState) => setPlaylistState(state));
        socket.on('playlist:error', ({ message }: { message: string }) => {
            showToast({ type: 'error', message: message || 'Playlist update failed' });
        });
        // Conflit d'édition concurrente : le serveur a refusé notre ordre et
        // renvoie le sien. On l'adopte plutôt que de laisser deux écrans diverger.
        socket.on('playlist:conflict', ({ message, state }: { message: string; state: PlaylistState }) => {
            setPlaylistState(state);
            showToast({ type: 'error', message: message || 'Someone else reordered this playlist' });
        });
```

- [ ] **Step 4: Add the emitters**

After `retractVoteRealtime` (line 173):

```tsx
    const joinPlaylist = useCallback((playlistId: number) => {
        joinedPlaylistIdRef.current = playlistId;
        setPlaylistState(undefined);
        socketRef.current?.emit('playlist:join', { playlistId });
    }, []);

    const leavePlaylist = useCallback((playlistId: number) => {
        if (joinedPlaylistIdRef.current === playlistId) joinedPlaylistIdRef.current = null;
        socketRef.current?.emit('playlist:leave', { playlistId });
    }, []);

    const addTrackRealtime = useCallback((playlistId: number, dto: AddTrackInput) => {
        socketRef.current?.emit('playlist:track:add', { playlistId, ...dto });
    }, []);

    const removeTrackRealtime = useCallback((playlistId: number, trackId: number) => {
        socketRef.current?.emit('playlist:track:remove', { playlistId, trackId });
    }, []);

    const reorderRealtime = useCallback((playlistId: number, trackIds: number[], version: number) => {
        socketRef.current?.emit('playlist:reorder', { playlistId, trackIds, version });
    }, []);
```

- [ ] **Step 5: Extend the context type and the provider value**

Add to `RealtimeContextType`:

```tsx
    /** état de la playlist rejointe (undefined tant qu'aucun snapshot n'est arrivé) */
    playlistState: PlaylistState | undefined;
    /** rejoint la room d'édition de cette playlist */
    joinPlaylist: (playlistId: number) => void;
    leavePlaylist: (playlistId: number) => void;
    /** édite via le socket quand connecté ; à l'appelant de faire un repli REST sinon */
    addTrackRealtime: (playlistId: number, dto: AddTrackInput) => void;
    removeTrackRealtime: (playlistId: number, trackId: number) => void;
    /** version = celle du dernier état reçu ; le serveur refuse un reorder périmé */
    reorderRealtime: (playlistId: number, trackIds: number[], version: number) => void;
```

and the six names to the `value={{ ... }}` object.

- [ ] **Step 6: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/context/RealtimeContext.tsx
git commit -m "feat(mobile): playlist room in RealtimeContext"
```

---

### Task 8: `PlaylistEditorScreen` driven by realtime

**Files:**
- Modify: `mobile/src/screens/PlaylistEditorScreen.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 6 and 7.
- Produces: no new exports.

- [ ] **Step 1: Join the room and adopt pushed state**

Replace the mount effect (lines 51–67) with a REST first load kept as the fallback, plus the room join:

```tsx
  const { connected, playlistState, joinPlaylist, leavePlaylist,
          addTrackRealtime, removeTrackRealtime, reorderRealtime } = useRealtime();
  const [version, setVersion] = useState(0);
  const [isOwner, setIsOwner] = useState(true);
  const [collaborators, setCollaborators] = useState<PlaylistCollaborator[]>([]);

  useEffect(() => {
    joinPlaylist(playlistId);
    return () => leavePlaylist(playlistId);
  }, [playlistId, joinPlaylist, leavePlaylist]);

  // Le socket est la source temps réel ; ce chargement REST couvre le premier
  // affichage et le cas où le websocket ne passe pas.
  const loadFromRest = useCallback(() => {
    return getPlaylist(playlistId, token)
      .then((playlist) => {
        setName(playlist.name);
        setIsPublic(playlist.isPublic);
        setTracks(playlist.tracks ?? []);
        setVersion(playlist.version);
        setIsOwner(playlist.isOwner ?? true);
      })
      .catch(() => showToast({ type: 'error', message: 'Failed to load playlist' }));
  }, [playlistId, token]);

  useEffect(() => {
    loadFromRest().finally(() => setLoading(false));
  }, [loadFromRest]);

  // Repli : tant que le websocket ne passe pas, on interroge le REST.
  useEffect(() => {
    if (connected) return;
    const id = setInterval(loadFromRest, 20_000);
    return () => clearInterval(id);
  }, [connected, loadFromRest]);

  // Un état poussé par le serveur fait toujours autorité sur l'état local.
  useEffect(() => {
    if (!playlistState || playlistState.id !== playlistId) return;
    setName(playlistState.name);
    setIsPublic(playlistState.isPublic);
    setTracks(playlistState.tracks);
    setVersion(playlistState.version);
    setCollaborators(playlistState.collaborators);
    setIsOwner(playlistState.owner.id === user?.id);
  }, [playlistState, playlistId, user?.id]);
```

Take `user` from `useAuth()` alongside `token`.

- [ ] **Step 2: Route the mutations through the socket when connected**

```tsx
  async function pickTrack(dt: DeezerTrack) {
    const bpm = dt.bpm ?? (await getTrackBpm(dt.id).catch(() => null));
    const dto = {
      deezerId: dt.id,
      title: dt.title,
      artist: dt.artist,
      artistId: dt.artistId || undefined,
      cover: dt.cover ?? undefined,
      previewUrl: dt.previewUrl!,
      bpm: bpm ?? undefined,
    };
    if (connected) {
      // l'état revient par playlist:state, pas besoin de toucher tracks ici
      addTrackRealtime(playlistId, dto);
      return;
    }
    try {
      const track = await addTrackToPlaylist(playlistId, token, dto);
      setTracks((t) => [...t, track]);
    } catch {
      showToast({ type: 'error', message: 'Failed to add track' });
    }
  }

  async function removeTrack(trackId: number) {
    if (connected) {
      removeTrackRealtime(playlistId, trackId);
      return;
    }
    try {
      await removeTrackFromPlaylist(playlistId, trackId, token);
      setTracks((t) => t.filter((x) => x.id !== trackId));
    } catch {
      showToast({ type: 'error', message: 'Failed to remove track' });
    }
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= tracks.length) return;
    const copy = [...tracks];
    [copy[index], copy[j]] = [copy[j], copy[index]];
    // optimiste : le broadcast (ou playlist:conflict) réconcilie ensuite
    setTracks(copy);
    const ids = copy.map((tk) => tk.id);
    if (connected) {
      reorderRealtime(playlistId, ids, version);
      return;
    }
    reorderPlaylistTracks(playlistId, token, ids, version)
      .then((state) => setVersion(state.version))
      .catch(() => {
        showToast({ type: 'error', message: 'Failed to save order' });
        loadFromRest();
      });
  }
```

- [ ] **Step 3: Gate the owner-only controls**

Wrap the `TextInput` for the name so a non-owner gets a plain `Text`, and render the visibility toggle only when `isOwner`:

```tsx
          {isOwner ? (
            <TextInput
              style={styles.titleInput}
              value={name}
              onChangeText={setName}
              onBlur={saveName}
              placeholder="Playlist name"
              placeholderTextColor={colors.textSecondary}
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.titleInput} numberOfLines={2}>{name}</Text>
          )}
```

and in the meta row replace the hardcoded `You` with `{isOwner ? 'You' : playlistState?.owner.username ?? ''}`, guarding the visibility `PressableCard` with `{isOwner && ( ... )}`.

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/PlaylistEditorScreen.tsx
git commit -m "feat(mobile): drive the playlist editor from the realtime socket"
```

---

### Task 9: Collaborators UI and shared playlists in the list

**Files:**
- Modify: `mobile/src/screens/PlaylistEditorScreen.tsx` (collaborators section)
- Modify: `mobile/src/screens/PlaylistsScreen.tsx` (shared rows)

**Interfaces:**
- Consumes: `listCollaborators`, `addCollaborator`, `removeCollaborator` from Task 6; `isOwner` from Task 3.
- Produces: no new exports.

- [ ] **Step 1: Add the collaborators section**

Below the `TrackSearch` block in `PlaylistEditorScreen`, owner-only. Friends come from the existing `GET /friendship/friends`, which returns `{ id, friendId, username, avatar }`:

```tsx
  const [friends, setFriends] = useState<{ friendId: number; username: string; avatar: string | null }[]>([]);

  useEffect(() => {
    if (!isOwner) return;
    apiFetch('/friendship/friends', token)
      .then(setFriends)
      .catch(() => {});
  }, [isOwner, token]);

  async function toggleCollaborator(friendId: number, isCollaborator: boolean) {
    try {
      if (isCollaborator) await removeCollaborator(playlistId, token, friendId);
      else await addCollaborator(playlistId, token, friendId);
      setCollaborators(await listCollaborators(playlistId, token));
    } catch {
      showToast({ type: 'error', message: 'Failed to update editors' });
    }
  }
```

```tsx
        {isOwner && (
          <>
            <Text style={styles.addTitle}>Editors</Text>
            {friends.length === 0 && (
              <Text style={styles.trackArtist}>Add friends to invite them as editors.</Text>
            )}
            {friends.map((f) => {
              const isCollaborator = collaborators.some((c) => c.id === f.friendId);
              return (
                <PressableCard
                  key={f.friendId}
                  style={styles.row}
                  hoverStyle={styles.rowHover}
                  onPress={() => toggleCollaborator(f.friendId, isCollaborator)}
                >
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle}>{f.username}</Text>
                  </View>
                  <Ionicons
                    name={isCollaborator ? 'checkmark-circle' : 'add-circle-outline'}
                    size={20}
                    color={isCollaborator ? colors.accent : colors.textSecondary}
                  />
                </PressableCard>
              );
            })}
          </>
        )}
```

For a non-owner, render a read-only line listing `collaborators.map((c) => c.username).join(', ')`.

- [ ] **Step 2: Show shared playlists in the list**

In `PlaylistsScreen`, the rows now carry `isOwner`. Hide the delete affordance when `isOwner === false` and add a "Shared" badge:

```tsx
  {item.isOwner === false && (
    <View style={styles.sharedBadge}>
      <Ionicons name="people" size={11} color={colors.textSecondary} />
      <Text style={styles.sharedText}>Shared</Text>
    </View>
  )}
```

with styles matching the file's existing conventions, and guard the existing `handleDelete` control with `item.isOwner !== false`.

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/
git commit -m "feat(mobile): manage playlist editors and surface shared playlists"
```

---

### Task 10: Full verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Backend suite**

Run: `cd backend && npx jest`
Expected: all suites pass; the count is the 66 baseline plus the tests added in Tasks 1–5.

- [ ] **Step 2: Backend typecheck**

Run: `cd backend && npx tsc -p tsconfig.build.json --noEmit`
Expected: no output.

- [ ] **Step 3: Mobile typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Manual two-client check**

Postgres and Redis must be up (`make docker-up`). Start the backend (`make dev-back`) and open the app twice (`make dev-web` in two browser windows, logged in as two seeded users — see `make seed-users`). Owner invites the second user as an editor, both open the same playlist, then verify:

1. adding a track on one screen appears on the other with no refresh
2. removing a track on one screen disappears on the other
3. reordering on one screen reorders on the other
4. with both screens showing the same playlist, reorder on A and then immediately reorder on B: B is told the playlist changed and snaps to the server order rather than silently overwriting A

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(playlist): address findings from the two-client check"
```

---

## Known deviations from the spec

- `apiFetch` (`mobile/src/config/api.ts:19-22`) throws a plain `Error` carrying only `message`; it does not expose the HTTP status or the response body. The REST fallback therefore cannot read the fresh state out of a 409 — it reloads via `loadFromRest()` instead. The socket path, which is the real-time one, does carry the state on `playlist:conflict`.
- Revoking a collaborator does not disconnect their open socket from the room; they keep receiving state until they leave the screen. Every mutation is re-checked server-side, so they cannot write. Accepted, and recorded in the spec's risk list.
