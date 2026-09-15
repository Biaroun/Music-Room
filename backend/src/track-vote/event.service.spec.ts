// TL;DR test event visibility vote license (invite geo time) and the premium gate
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventService } from './event.service';
import { Event, EventLicenseMode, EventVisibility } from './event.entity';
import { EventInvite } from './event-invite.entity';
import { Playlist } from '../playlist-editor/playlist.entity';
import { SubscriptionService } from '../subscription/subscription.service';

describe('EventService', () => {
  let service: EventService;
  let events: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock };
  let invites: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let playlists: { findOne: jest.Mock };
  let subscription: { isPremium: jest.Mock };

  const owner = { id: 1, username: 'owner' };
  const OTHER_USER = 2;
  const INVITED_USER = 3;

  function baseEvent(overrides: Partial<Event> = {}): Event {
    return {
      id: 10,
      name: 'Party',
      owner,
      visibility: EventVisibility.PUBLIC,
      licenseMode: EventLicenseMode.OPEN,
      licenseLatitude: null,
      licenseLongitude: null,
      licenseRadiusMeters: null,
      licenseStartsAt: null,
      licenseEndsAt: null,
      ...overrides,
    } as Event;
  }

  beforeEach(async () => {
    events = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), remove: jest.fn() };
    invites = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
    playlists = { findOne: jest.fn() };
    // premium par defaut : la plupart des tests ici portent sur
    // assertCanView/assertCanVote, pas sur la gate d'abonnement (testee a part)
    subscription = { isPremium: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Event), useValue: events },
        { provide: getRepositoryToken(EventInvite), useValue: invites },
        { provide: getRepositoryToken(Playlist), useValue: playlists },
        { provide: SubscriptionService, useValue: subscription },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  describe('findVisible', () => {
    it('includes events the user is invited to, reading the event relation off the invite row', async () => {
      invites.find.mockResolvedValue([{ id: 1, event: { id: 99 } }]);
      events.find.mockResolvedValue([]);

      await service.findVisible(INVITED_USER);

      expect(invites.find).toHaveBeenCalledWith({
        where: { invitee: { id: INVITED_USER } },
        relations: { event: true },
      });
      expect(events.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([{ id: 99 }]),
        }),
      );
    });

    it('does not throw when the user has no invites', async () => {
      invites.find.mockResolvedValue([]);
      events.find.mockResolvedValue([]);

      await expect(service.findVisible(OTHER_USER)).resolves.toEqual([]);
    });

    it('flags isOwner/isInvited/canVote per event for the requesting user', async () => {
      invites.find.mockResolvedValue([{ id: 1, event: { id: 20 } }]);
      events.find.mockResolvedValue([
        baseEvent({ id: 10, owner: owner as any, licenseMode: EventLicenseMode.OPEN }),
        baseEvent({ id: 20, owner: { id: 99, username: 'someoneElse' } as any, licenseMode: EventLicenseMode.INVITE_ONLY }),
      ]);

      const result = await service.findVisible(owner.id);

      expect(result[0]).toMatchObject({ id: 10, isOwner: true, isInvited: false, canVote: true });
      expect(result[1]).toMatchObject({ id: 20, isOwner: false, isInvited: true, canVote: true });
    });
  });

  describe('findOneForUser', () => {
    it('returns isOwner/isInvited/canVote for a single event', async () => {
      events.findOne.mockResolvedValue(
        baseEvent({ visibility: EventVisibility.PRIVATE, licenseMode: EventLicenseMode.INVITE_ONLY }),
      );
      invites.findOne.mockResolvedValue({ id: 1 });

      const result = await service.findOneForUser(10, INVITED_USER);

      expect(result).toMatchObject({ isOwner: false, isInvited: true, canVote: true });
    });

    it('marks canVote false for an invite-only event when not invited nor owner', async () => {
      events.findOne.mockResolvedValue(baseEvent({ licenseMode: EventLicenseMode.INVITE_ONLY }));
      invites.findOne.mockResolvedValue(null);

      const result = await service.findOneForUser(10, OTHER_USER);

      expect(result).toMatchObject({ isOwner: false, isInvited: false, canVote: false });
    });
  });

  describe('assertCanView', () => {
    it('allows anyone on a public event', async () => {
      events.findOne.mockResolvedValue(baseEvent());
      await expect(service.assertCanView(10, OTHER_USER)).resolves.toBeDefined();
    });

    it('allows the owner on a private event', async () => {
      events.findOne.mockResolvedValue(baseEvent({ visibility: EventVisibility.PRIVATE }));
      await expect(service.assertCanView(10, owner.id)).resolves.toBeDefined();
    });

    it('allows an invited user on a private event', async () => {
      events.findOne.mockResolvedValue(baseEvent({ visibility: EventVisibility.PRIVATE }));
      invites.findOne.mockResolvedValue({ id: 1 });
      await expect(service.assertCanView(10, INVITED_USER)).resolves.toBeDefined();
    });

    it('rejects a non-invited user on a private event with a 404 (not a 403)', async () => {
      events.findOne.mockResolvedValue(baseEvent({ visibility: EventVisibility.PRIVATE }));
      invites.findOne.mockResolvedValue(null);
      await expect(service.assertCanView(10, OTHER_USER)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertCanVote', () => {
    it('allows anyone under OPEN license', async () => {
      events.findOne.mockResolvedValue(baseEvent({ licenseMode: EventLicenseMode.OPEN }));
      await expect(service.assertCanVote(10, OTHER_USER)).resolves.toBeDefined();
    });

    it('rejects a non-invited user under INVITE_ONLY license', async () => {
      events.findOne.mockResolvedValue(baseEvent({ licenseMode: EventLicenseMode.INVITE_ONLY }));
      invites.findOne.mockResolvedValue(null);
      await expect(service.assertCanVote(10, OTHER_USER)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an invited user under INVITE_ONLY license', async () => {
      events.findOne.mockResolvedValue(baseEvent({ licenseMode: EventLicenseMode.INVITE_ONLY }));
      invites.findOne.mockResolvedValue({ id: 1 });
      await expect(service.assertCanVote(10, INVITED_USER)).resolves.toBeDefined();
    });

    it('rejects when no position is supplied under GEO_TIME_RESTRICTED', async () => {
      events.findOne.mockResolvedValue(
        baseEvent({
          licenseMode: EventLicenseMode.GEO_TIME_RESTRICTED,
          licenseLatitude: 48.85,
          licenseLongitude: 2.35,
          licenseRadiusMeters: 100,
        }),
      );
      await expect(service.assertCanVote(10, OTHER_USER)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows a position inside the radius and time window', async () => {
      events.findOne.mockResolvedValue(
        baseEvent({
          licenseMode: EventLicenseMode.GEO_TIME_RESTRICTED,
          licenseLatitude: 48.85,
          licenseLongitude: 2.35,
          licenseRadiusMeters: 5000,
          licenseStartsAt: new Date(Date.now() - 1000),
          licenseEndsAt: new Date(Date.now() + 1000),
        }),
      );
      await expect(
        service.assertCanVote(10, OTHER_USER, { latitude: 48.851, longitude: 2.351 }),
      ).resolves.toBeDefined();
    });

    it('rejects a position outside the radius', async () => {
      events.findOne.mockResolvedValue(
        baseEvent({
          licenseMode: EventLicenseMode.GEO_TIME_RESTRICTED,
          licenseLatitude: 48.85,
          licenseLongitude: 2.35,
          licenseRadiusMeters: 50,
        }),
      );
      await expect(
        service.assertCanVote(10, OTHER_USER, { latitude: 40.0, longitude: 2.35 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects outside the time window even if inside the radius', async () => {
      events.findOne.mockResolvedValue(
        baseEvent({
          licenseMode: EventLicenseMode.GEO_TIME_RESTRICTED,
          licenseLatitude: 48.85,
          licenseLongitude: 2.35,
          licenseRadiusMeters: 5000,
          licenseStartsAt: new Date(Date.now() - 10_000),
          licenseEndsAt: new Date(Date.now() - 1_000),
        }),
      );
      await expect(
        service.assertCanVote(10, OTHER_USER, { latitude: 48.851, longitude: 2.351 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('bonus VI.3 : creer/gerer un event exige le plan premium', () => {
    it('rejects create() when the requester is not premium', async () => {
      subscription.isPremium.mockResolvedValue(false);

      await expect(
        service.create(owner.id, { name: 'Party', playlistId: 5 } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(playlists.findOne).not.toHaveBeenCalled();
    });

    it('allows create() when the requester is premium', async () => {
      subscription.isPremium.mockResolvedValue(true);
      playlists.findOne.mockResolvedValue({ id: 5 });
      events.create.mockReturnValue({ id: 10 });
      events.save.mockResolvedValue({ id: 10 });

      await expect(service.create(owner.id, { name: 'Party', playlistId: 5 } as any)).resolves.toBeDefined();
    });

    it('rejects managing an existing event (update) once the owner is no longer premium', async () => {
      events.findOne.mockResolvedValue(baseEvent());
      subscription.isPremium.mockResolvedValue(false);

      await expect(service.update(10, owner.id, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('still rejects a non-owner managing the event before even checking premium', async () => {
      events.findOne.mockResolvedValue(baseEvent());
      subscription.isPremium.mockResolvedValue(true);

      await expect(service.update(10, OTHER_USER, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
