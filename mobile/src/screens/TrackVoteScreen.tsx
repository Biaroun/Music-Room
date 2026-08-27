import React from 'react';
import Screen from '../components/Screen';
import EmptyState from '../components/EmptyState';

// écran en attente de l'API back (track vote pas encore fait)
export default function TrackVoteScreen() {
  return (
    <Screen scroll={false} center>
      <EmptyState
        icon="bar-chart-outline"
        title="Track Vote"
        message="Bientôt disponible — en attente de l'API. Vous pourrez voter en direct pour le prochain morceau d'une session."
      />
    </Screen>
  );
}
