// tokens de design partages web + natif.
// toute couleur / rayon / ombre doit venir d'ici, pas d'une valeur en dur dans un ecran.

export const colors = {
    // fonds, du plus sombre au plus clair
    background: '#121212',
    surfaceAlt: '#181818',
    surface: '#282828',
    surfaceHover: '#333333',

    // bordures : tres discretes, elles servent a separer sans alourdir
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.18)',

    accent: '#1DB954',
    accentHover: '#1ED760',
    accentPressed: '#169C46',
    accentSoft: 'rgba(29,185,84,0.14)',
    onAccent: '#000000',

    danger: '#F87171',
    dangerSoft: 'rgba(248,113,113,0.14)',
    warning: '#F59E0B',

    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textTertiary: '#7A7A7A',

    overlay: 'rgba(0,0,0,0.6)',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const radius = {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    pill: 999,
};

// largeurs max : sur mobile elles ne s'appliquent jamais (ecran plus etroit),
// sur le web elles evitent des lignes de texte / inputs etires sur tout l'ecran.
export const layout = {
    maxWidth: 760,
    maxWidthNarrow: 420,
    // grilles a 2 colonnes (playlists, events) : des cartes plus chargees en texte
    // que les tuiles de Home, il leur faut plus de place que maxWidth
    maxWidthWide: 1100,
    wideBreakpoint: 700,
};

// boxShadow et pas shadowColor/shadowOpacity/... : les props "shadow*" sont depreciees
// (warning a chaque rendu sur web) et boxShadow marche sur les trois plateformes
// depuis la nouvelle archi, seule disponible en RN 0.85.
export const shadows = {
    card: { boxShadow: '0 4px 10px rgba(0,0,0,0.25)' },
    floating: { boxShadow: '0 8px 16px rgba(0,0,0,0.4)' },
} as const;

export const typography = {
    h1: { fontSize: 28, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.6 },
    h2: { fontSize: 20, fontWeight: '700' as const, color: colors.textPrimary, letterSpacing: -0.3 },
    h3: { fontSize: 16, fontWeight: '700' as const, color: colors.textPrimary },
    body: { fontSize: 14, color: colors.textPrimary },
    bodyStrong: { fontSize: 14, fontWeight: '600' as const, color: colors.textPrimary },
    caption: { fontSize: 12, color: colors.textSecondary },
    label: { fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary, letterSpacing: 0.3 },
};
