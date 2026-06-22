import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { colors, spacing, typography } from '../config/theme';
import { useAuth } from '../context/AuthContext';

type ServiceCard = {
    title: string;
    description: string;
    screen: string;
    emoji: string;
}

const SERVICES: ServiceCard[] = [];

export default function HomeScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            <Text style={typography.h1}>Music Room</Text>
            <Text style={[typography.caption, {marginBottom: spacing.xl}]}>
                Your collaborative music experience
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Settings')}>
                <Text style={styles.buttonText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { marginTop: spacing.md }]} onPress={() => navigation.navigate('Profile')}>
                <Text style={styles.buttonText}>My Profile</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: colors.background,
        alignItems: 'center', 
        justifyContent: 'center',
        padding: spacing.md, 
    },
    button: {
        backgroundColor: colors.accent,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: 24,
    },
    buttonText: {
        color: colors.background,
        fontWeight: '700',
        fontSize: 14,
    },
});