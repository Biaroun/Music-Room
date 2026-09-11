import React from 'react';
import { View, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../config/theme';
import { usePreviewPlayer } from '../context/PreviewPlayerContext';

export const MINI_PLAYER_HEIGHT = 60;

// espace a reserver en bas d'un ecran : encoche/barre systeme + mini-player quand il est la.
// sans ca le dernier element d'une liste passe sous le lecteur.
export function useBottomInset() {
  const insets = useSafeAreaInsets();
  const { activeTrack } = usePreviewPlayer();
  return insets.bottom + (activeTrack ? MINI_PLAYER_HEIGHT : 0);
}

type ScreenProps = {
  children: React.ReactNode;
  /** false quand l'ecran gere lui-meme son scroll (FlatList par ex.) */
  scroll?: boolean;
  /** colonne etroite : formulaires d'authentification */
  narrow?: boolean;
  /** colonne large : grilles a plusieurs colonnes (playlists, events) */
  wide?: boolean;
  /** centre le contenu verticalement */
  center?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

// conteneur commun a tous les ecrans.
// son role principal : borner la largeur du contenu et le centrer. sur telephone la
// contrainte ne s'applique jamais (l'ecran est plus etroit), sur le web ca evite des
// formulaires et des lignes de texte etires sur 1500px.
export default function Screen({
  children,
  scroll = true,
  narrow = false,
  wide = false,
  center = false,
  padded = true,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const bottomInset = useBottomInset();
  const column = [
    styles.column,
    { maxWidth: narrow ? layout.maxWidthNarrow : wide ? layout.maxWidthWide : layout.maxWidth },
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
  // sans ScrollView il n'y a pas d'alignItems herite : on centre sur les deux axes
  centerBoth: { justifyContent: 'center', alignItems: 'center' },
});
