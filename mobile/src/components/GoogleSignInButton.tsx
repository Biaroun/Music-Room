import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../config/theme';
import { exchangeGoogleCode, runGoogleFlow } from '../lib/googleAuth';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import PressableCard from './PressableCard';

export default function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
    const { login: authLogin } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    async function signIn() {
        setLoading(true);
        try {
            const flow = await runGoogleFlow();
            if (!flow) return;
            await authLogin(await exchangeGoogleCode(flow));
        } catch (e: any) {
            showToast({ type: 'error', message: e?.message || 'Google sign-in failed' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.wrapper}>
            {/* or separator line */}
            <View style={styles.separator}>
                <View style={styles.rule} />
                <Text style={styles.separatorText}>or</Text>
                <View style={styles.rule} />
            </View>

            {/* the google button */}
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
