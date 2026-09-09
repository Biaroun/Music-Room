import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { colors, radius, spacing, typography } from '../config/theme';
import { API_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import PressableCard from './PressableCard';

WebBrowser.maybeCompleteAuthSession();

/**
 * sujet v.5 : l'app doit proposer une connexion via un reseau social.
 *
 * on passe par le flux du backend (/auth/google/web) plutot que de parler a
 * google directement : la seule uri de redirection enregistree dans la console
 * cloud est celle du callback backend. l'app ouvre donc ce flux, google renvoie
 * au backend, le backend cree notre jwt et redirige vers l'app avec le token
 * dans le fragment (OAUTH_APP_REDIRECT cote back).
 *
 * demander l'id token depuis l'app aurait impose d'enregistrer une seconde uri
 * chez google, celle de l'app elle-meme.
 */
export default function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
    const { login: authLogin } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    /** le backend renvoie ...#token=<jwt> */
    function tokenFromUrl(url: string): string | null {
        const hash = url.split('#')[1];
        if (!hash) return null;
        const found = new URLSearchParams(hash).get('token');
        return found || null;
    }

    async function signIn() {
        setLoading(true);
        try {
            const appUrl = Platform.OS === 'web' ? globalThis.location?.origin : undefined;
            const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/google/web`, appUrl);

            if (result.type !== 'success') return; // l'utilisateur a ferme la fenetre

            const token = tokenFromUrl(result.url);
            if (!token) {
                showToast({ type: 'error', message: 'Google sign-in did not return a session' });
                return;
            }
            await authLogin(token);
        } catch {
            showToast({ type: 'error', message: 'Google sign-in failed' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.wrapper}>
            <View style={styles.separator}>
                <View style={styles.rule} />
                <Text style={styles.separatorText}>or</Text>
                <View style={styles.rule} />
            </View>

            <PressableCard
                style={styles.button}
                disabled={loading}
                onPress={signIn}
                accessibilityLabel={label}
            >
                <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
                <Text style={styles.label}>{loading ? 'Opening Google…' : label}</Text>
            </PressableCard>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { width: '100%', marginTop: spacing.lg },
    separator: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    rule: { flex: 1, height: 1, backgroundColor: colors.border },
    separatorText: { ...typography.caption, color: colors.textTertiary },

    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md - 2,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderStrong,
    },
    label: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
});
