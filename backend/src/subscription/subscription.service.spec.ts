// TL;DR test subscribe cancel and isPremium
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { User, SubscriptionPlan } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let users: { findOne: jest.Mock; save: jest.Mock };
  let mail: { sendSubscriptionConfirmedEmail: jest.Mock; sendSubscriptionCancelledEmail: jest.Mock };

  beforeEach(async () => {
    users = { findOne: jest.fn(), save: jest.fn() };
    mail = { sendSubscriptionConfirmedEmail: jest.fn(), sendSubscriptionCancelledEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  describe('subscribe', () => {
    it('upgrades a free user to premium and emails them', async () => {
      const user = { id: 1, email: 'a@b.com', plan: SubscriptionPlan.FREE, subscribedAt: null };
      users.findOne.mockResolvedValue(user);
      users.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.subscribe(1);

      expect(result.plan).toBe(SubscriptionPlan.PREMIUM);
      expect(result.subscribedAt).toBeInstanceOf(Date);
      expect(mail.sendSubscriptionConfirmedEmail).toHaveBeenCalledWith('a@b.com');
    });

    it('rejects subscribing when already premium', async () => {
      users.findOne.mockResolvedValue({ id: 1, email: 'a@b.com', plan: SubscriptionPlan.PREMIUM });

      await expect(service.subscribe(1)).rejects.toBeInstanceOf(ConflictException);
      expect(mail.sendSubscriptionConfirmedEmail).not.toHaveBeenCalled();
    });

    it('404s for an unknown user', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.subscribe(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('downgrades a premium user to free and emails them', async () => {
      const user = { id: 1, email: 'a@b.com', plan: SubscriptionPlan.PREMIUM, subscribedAt: new Date() };
      users.findOne.mockResolvedValue(user);
      users.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.cancel(1);

      expect(result.plan).toBe(SubscriptionPlan.FREE);
      expect(result.subscribedAt).toBeNull();
      expect(mail.sendSubscriptionCancelledEmail).toHaveBeenCalledWith('a@b.com');
    });

    it('rejects cancelling when there is no active subscription', async () => {
      users.findOne.mockResolvedValue({ id: 1, email: 'a@b.com', plan: SubscriptionPlan.FREE });

      await expect(service.cancel(1)).rejects.toBeInstanceOf(ConflictException);
      expect(mail.sendSubscriptionCancelledEmail).not.toHaveBeenCalled();
    });
  });

  describe('isPremium', () => {
    it('returns true only for a premium user', async () => {
      users.findOne.mockResolvedValue({ id: 1, plan: SubscriptionPlan.PREMIUM });
      await expect(service.isPremium(1)).resolves.toBe(true);
    });

    it('returns false for a free user or one that does not exist', async () => {
      users.findOne.mockResolvedValueOnce({ id: 1, plan: SubscriptionPlan.FREE });
      await expect(service.isPremium(1)).resolves.toBe(false);

      users.findOne.mockResolvedValueOnce(null);
      await expect(service.isPremium(2)).resolves.toBe(false);
    });
  });
});
