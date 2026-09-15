import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../config/theme';

type FieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

// champ texte unique de l'app : label optionnel, bordure qui reagit au focus
// (indispensable sur web ou il n'y a aucun retour visuel sinon) et etat erreur.
export default function Field({ label, hint, error, containerStyle, style, ...inputProps }: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textTertiary}
        {...inputProps}
        // track the focus for the border and still call the parent handlers
        onFocus={(e) => { setFocused(true); inputProps.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); inputProps.onBlur?.(e); }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          inputProps.multiline && styles.inputMultiline,
          style,
        ]}
      />
      {/* error wins over the hint */}
      {(error || hint) && (
        <Text style={[styles.hint, !!error && styles.errorText]}>{error || hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.sm, alignSelf: 'stretch' },
  label: { ...typography.label, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    // pas de halo natif du navigateur : le focus est rendu par la bordure ci-dessous
    outlineWidth: 0,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.surface },
  inputError: { borderColor: colors.danger },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.sm + 4 },
  hint: { fontSize: 11, color: colors.textTertiary, marginTop: spacing.xs, marginLeft: 2 },
  errorText: { color: colors.danger },
});
