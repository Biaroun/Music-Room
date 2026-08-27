import React from 'react';
import { View, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../config/theme';
import { usePreviewPlayer } from '../context/PreviewPlayerContext';

export const MINI_PLAYER_HEIGHT = 60;

// Espace à réserver en bas d'un écran : encoche/barre système + mini-player quand il est là.
// Sans ça le dernier élément d'une liste passe sous le lecteur.
export function useBottomInset() {
  const insets = useSafeAreaInsets();
  const { activeTrack } = usePreviewPlayer();
  return insets.bottom + (activeTrack ? MINI_PLAYER_HEIGHT : 0);
}

type ScreenProps = {
  children: React.ReactNode;
  /** false quand l'écran gère lui-même son scroll (FlatList par ex.) */
  scroll?: boolean;
  /** colonne étroite : formulaires d'authentification */
  narrow?: boolean;
  /** centre le contenu verticalement */
  center?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

// Conteneur commun à tous les écrans.
// Son rôle principal : borner la largeur du contenu et le centrer. Sur téléphone la
// contrainte ne s'applique jamais (l'écran est plus étroit), sur le web ça évite des
// formulaires et des lignes de texte étirés sur 1500px.
export default function Screen({
  children,
  scroll = true,
  narrow = false,
  center = false,
  padded = true,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const bottomInset = useBottomInset();
  const column = [
    styles.column,
    { maxWidth: narrow ? layout.maxWidthNarrow : layout.maxWidth },
    padded && styles.padded,
    contentContainerStyle,
  ];

  if (!scroll) {
    return (
      <View style={[styles.root, style]}>
        <View style={[column, styles.columnFill, center && styles.centerBoth]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, style]}
      contentContainerStyle={[styles.scrollContent, center && styles.center, { paddingBottom: bottomInset + spacing.lg }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={column}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
  columnFill: { flex: 1 },
  padded: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  center: { justifyContent: 'center' },
  // sans ScrollView il n'y a pas d'alignItems hérité : on centre sur les deux axes
  centerBoth: { justifyContent: 'center', alignItems: 'center' },
});
