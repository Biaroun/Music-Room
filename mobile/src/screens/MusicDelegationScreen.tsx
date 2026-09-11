import React from 'react';
import Screen from '../components/Screen';
import EmptyState from '../components/EmptyState';

// ecran en attente de l'api back (delegation pas encore faite)
export default function MusicDelegationScreen() {
  return (
    <Screen scroll={false} center>
      <EmptyState
        icon="git-network-outline"
        title="Music Delegation"
        message="Bientôt disponible — en attente de l'API. Vous pourrez déléguer le contrôle de la lecture à vos amis."
      />
    </Screen>
  );
}
