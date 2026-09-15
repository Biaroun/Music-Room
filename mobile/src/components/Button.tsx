import React, { useState } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '../config/theme';

// the 4 looks of a button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

// bouton unique de l'app : gere survol (web), appui, desactive et chargement.
// avant chaque ecran refaisait son propre TouchableOpacity sans aucun de ces etats.
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  style,
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  // loading also block the press (no double submit)
  const inactive = disabled || loading;
  const v = VARIANTS[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        fullWidth && styles.fullWidth,
        { backgroundColor: v.bg, borderColor: v.border },
        hovered && !inactive && { backgroundColor: v.bgHover },
        pressed && !inactive && { backgroundColor: v.bgPressed, transform: [{ scale: 0.985 }] },
        inactive && styles.inactive,
        // cursor is only used on web
        { cursor: inactive ? 'auto' : 'pointer' },
        style,
      ]}
    >
      {/* spinner while loading sinon icon + title */}
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={v.fg} />}
          <Text style={[styles.text, size === 'sm' && styles.textSm, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// colors of each variant (normal hover pressed text border)
const VARIANTS: Record<Variant, { bg: string; bgHover: string; bgPressed: string; fg: string; border: string }> = {
  primary: {
    bg: colors.accent,
    bgHover: colors.accentHover,
    bgPressed: colors.accentPressed,
    fg: colors.onAccent,
    border: 'transparent',
  },
  secondary: {
    bg: colors.surface,
    bgHover: colors.surfaceHover,
    bgPressed: colors.surfaceAlt,
    fg: colors.textPrimary,
    border: colors.border,
  },
  ghost: {
    bg: 'transparent',
    bgHover: 'rgba(255,255,255,0.06)',
    bgPressed: 'rgba(255,255,255,0.03)',
    fg: colors.textSecondary,
    border: 'transparent',
  },
  danger: {
    bg: colors.dangerSoft,
    bgHover: 'rgba(248,113,113,0.22)',
    bgPressed: 'rgba(248,113,113,0.1)',
    fg: colors.danger,
    border: 'transparent',
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // 48 = min touch size
    minHeight: 48,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sm: { minHeight: 36, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, gap: spacing.xs },
  fullWidth: { alignSelf: 'stretch' },
  inactive: { opacity: 0.45 },
  text: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  textSm: { fontSize: 13, fontWeight: '700' },
});
