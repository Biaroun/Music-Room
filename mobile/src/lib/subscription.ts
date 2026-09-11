import { apiFetch } from '../config/api';

export type SubscriptionPlan = 'free' | 'premium';

export type SubscriptionStatus = {
  plan: SubscriptionPlan;
  subscribedAt: string | null;
};

// Bonus VI.3 : aucune logique de paiement, juste la bascule d'etat cote
// serveur (voir backend/src/subscription). Un email de confirmation part a
// chaque changement.
export function subscribe(token: string | null): Promise<SubscriptionStatus> {
  return apiFetch('/subscription/subscribe', token, { method: 'POST' });
}

export function cancelSubscription(token: string | null): Promise<SubscriptionStatus> {
  return apiFetch('/subscription/cancel', token, { method: 'POST' });
}
