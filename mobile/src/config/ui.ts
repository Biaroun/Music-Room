import { StyleSheet } from 'react-native';
import { colors, spacing } from './theme';

// Styles réutilisables partagés par les écrans.
// Usage : import { ui } from '../config/ui';
//         <View style={ui.screen}> ... <TouchableOpacity style={[ui.button, { marginTop: spacing.md }]}>
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },

  button: { backgroundColor: colors.accent, borderRadius: 24, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '800', fontSize: 16 },
  buttonSecondary: { backgroundColor: colors.surface },
  buttonSecondaryText: { color: colors.textPrimary, fontWeight: '800', fontSize: 16 },

  input: { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm, fontSize: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
