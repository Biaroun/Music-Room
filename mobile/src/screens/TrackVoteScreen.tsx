import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../config/theme';

// écran en attente de l'API back (track vote pas encore fait)
export default function TrackVoteScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="bar-chart" size={48} color={colors.accent} />
      <Text style={[typography.h2, { marginTop: spacing.md }]}>Track Vote</Text>
      <Text style={[typography.caption, { marginTop: spacing.xs, textAlign: 'center' }]}>
        Bientôt disponible — en attente de l'API.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
