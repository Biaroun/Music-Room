import React, { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../config/theme';

type PressableCardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** par défaut : la surface s'éclaircit au survol */
  hoverStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

// Ligne / tuile cliquable. Regroupe le survol (web) et l'appui (mobile) au même endroit
// pour que toutes les listes de l'app réagissent pareil.
export default function PressableCard({
  children,
  onPress,
  disabled = false,
  style,
  hoverStyle,
  accessibilityLabel,
}: PressableCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        style,
        hovered && !disabled && (hoverStyle ?? styles.defaultHover),
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        { cursor: disabled || !onPress ? 'auto' : 'pointer' },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  defaultHover: { backgroundColor: colors.surfaceHover },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.45 },
});
