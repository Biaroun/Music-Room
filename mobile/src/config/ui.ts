import { StyleSheet } from 'react-native';
import { colors, radius, spacing, shadows } from './theme';

// Styles réutilisables partagés par les écrans.
// Usage : import { ui } from '../config/ui';
//         <View style={ui.card}> ... <View style={[ui.row, { marginTop: spacing.md }]}>
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },

  // Les boutons/inputs sont maintenant des composants (Button, Field) : ces styles
  // restent pour les cas ponctuels qui n'ont pas besoin d'un composant complet.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardFlat: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },

  section: { marginTop: spacing.xl, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },

  chip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  shadowCard: shadows.card,
  shadowFloating: shadows.floating,
});
