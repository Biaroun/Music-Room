export const colors = {
    background: '#121212',
    surface: '#282828',
    surfaceAlt: '#181818',
    accent: '#1DB954',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3B3',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const typography = {
    h1: { fontSize: 28, fontWeight: '700' as const, color: colors.textPrimary },
    h2: { fontSize: 20, fontWeight: '700' as const, color: colors.textPrimary },
    body: { fontSize: 14, color: colors.textPrimary },
    caption: { fontSize: 12, color: colors.textSecondary },
};