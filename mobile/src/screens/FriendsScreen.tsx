import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');
const ME_SZ = 82;

export default function FriendsScreen() {
    return (
        <View style={styles.container}>
        <LinearGradient
            colors={['#102e52', '#081e38', '#030d1d']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
        />

        <View style={styles.meWrapper}>
            {[0, 1, 2].map(i => (
            <View
                key={i}
                style={[styles.meRing, {
                width: ME_SZ + i * 30,
                height: ME_SZ + i * 30,
                borderRadius: (ME_SZ + i * 30) / 2,
                opacity: 0.3 - i * 0.08,
                }]}
            />
            ))}

            <View style={styles.meCircle}>
            <Text style={styles.meEmoji}>♪</Text>
            </View>

            <Text style={styles.meLabel}>TOI</Text>
        </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    meWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    meRing: {
        position: 'absolute',
        borderWidth: 1.5,
        borderColor: 'rgba(29,185,84,0.22)',
    },
    meCircle: {
        width: ME_SZ,
        height: ME_SZ,
        borderRadius: ME_SZ / 2,
        borderWidth: 3,
        borderColor: 'rgba(29,185,84,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 28,
        elevation: 10,
    },
    meEmoji: {
        fontSize: 26,
        color: '#fff',
    },
    meLabel: {
        marginTop: 10,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        color: 'rgba(255,255,255,0.88)',
    },
});
