import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../config/theme';

// écran en attente de l'API back (delegation pas encore faite)
export default function MusicDelegationScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="git-network" size={48} color={colors.accent} />
      <Text style={[typography.h2, { marginTop: spacing.md }]}>Music Delegation</Text>
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
