import { apiFetch } from '../config/api';

export type SubscriptionPlan = 'free' | 'premium';

// what the api send back after a change
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

// back to the free plan
export function cancelSubscription(token: string | null): Promise<SubscriptionStatus> {
  return apiFetch('/subscription/cancel', token, { method: 'POST' });
}
