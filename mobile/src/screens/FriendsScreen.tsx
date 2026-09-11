import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, ActivityIndicator, TextInput, Modal, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { getAvatar } from '../config/avatars';
import PoolBackground from './PoolBackground';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { useRealtime, type FriendListening } from '../context/RealtimeContext';

const ME_SZ = 82;
const FR_SZ = 58;
const PR_SZ = 50;   // pending recue - taille intermediaire pour se distinguer des inconnus
const PS_SZ = 46;   // pending envoyee
const OT_SZ = 44;
const GREEN = '#1DB954';
const AMBER = '#f59e0b';
// versions rgb : boxShadow a besoin de la couleur et de l'opacite dans la meme valeur
const GREEN_RGB = '29,185,84';
const AMBER_RGB = '245,158,11';
const COLORS = ['#e91e63',
                '#8b5cf6',
                '#f97316',
                '#0ea5e9',
                '#10b981',
                '#f43f5e',
                '#a855f7',
                '#06b6d4'];
const GREY = ['#4b5563', '#78716c', '#52525b', '#475569', '#57534e'];

export type RelStatus = 'friend' | 'pending_sent' | 'pending_received' | 'stranger';

export type Person = {
    key: string;
    relId: number | null;   // friendship id (friend) ou id de la demande pending (pending_sent/pending_received)
    userId: number;
    username: string;
    avatar: string | null;
    color: string;
    ang: number;
    dst: number;
    status: RelStatus;
};

type SearchResult = {
    id: number;
    username: string;
    avatar?: string | null;
};

function toXY(ang: number, dst: number, vmin: number) {
    const rad = (ang * Math.PI) / 180;
    const d = (dst / 100) * vmin;
    return { x: Math.cos(rad) * d, y: Math.sin(rad) * d };
}

function floatOffsets(id: number) {
    const s = id * 137.508;
    return [
        +(Math.sin(s) * 8).toFixed(1),
        +(Math.cos(s * 1.3) * 9).toFixed(1),
        +(Math.sin(s * 0.7) * 6).toFixed(1),
        +(Math.cos(s * 1.1) * 7).toFixed(1),
    ];
}

function UserBubble({ p, isSelected, onPress, vmin, listening }: { p: Person; isSelected: boolean; onPress: () => void; vmin: number; listening?: FriendListening }) {
    const sz = p.status === 'friend' ? FR_SZ
        : p.status === 'pending_received' ? PR_SZ
        : p.status === 'pending_sent' ? PS_SZ
        : OT_SZ;
    const { x, y } = toXY(p.ang, p.dst, vmin);
    const ini = p.username.slice(0, 2).toUpperCase();
    const avatar = getAvatar(p.avatar);

    const [x1, y1, x2, y2] = floatOffsets(p.userId);
    // demande recue = pulsation plus rapide/marquee pour sauter aux yeux
    const dur = (3200 + (p.userId % 5) * 220) * (p.status === 'pending_received' ? 0.6 : 1);
    const dly = (p.userId * 340) % 1800;

    const floatX = useSharedValue(0);
    const floatY = useSharedValue(0);
    const ringScale = useSharedValue(1);
    const ringOpacity = useSharedValue(
        p.status === 'friend' ? 0.48 : p.status === 'pending_received' ? 0.55 : 0.15,
    );
    const selectScale = useSharedValue(1);

    useEffect(() => {
        const ease = Easing.inOut(Easing.ease);
        floatX.value = withDelay(dly, withRepeat(
            withSequence(
                withTiming(x1, { duration: dur * 0.25, easing: ease }),
                withTiming(x2, { duration: dur * 0.3, easing: ease }),
                withTiming(-x1 * 0.4, { duration: dur * 0.25, easing: ease }),
                withTiming(0, { duration: dur * 0.2, easing: ease }),
            ),
            -1,
        ));
        floatY.value = withDelay(dly, withRepeat(
            withSequence(
                withTiming(y1, { duration: dur * 0.25, easing: ease }),
                withTiming(y2, { duration: dur * 0.3, easing: ease }),
                withTiming(y1 * 0.5, { duration: dur * 0.25, easing: ease }),
                withTiming(0, { duration: dur * 0.2, easing: ease }),
            ),
            -1,
        ));
        const hi = p.status === 'friend' ? 0.48 : p.status === 'pending_received' ? 0.6 : 0.15;
        const lo = p.status === 'friend' ? 0.07 : p.status === 'pending_received' ? 0.12 : 0.025;
        ringScale.value = withDelay(dly + 450, withRepeat(
            withSequence(
                withTiming(1.28, { duration: dur * 0.5, easing: ease }),
                withTiming(1, { duration: dur * 0.5, easing: ease }),
            ),
            -1,
        ));
        ringOpacity.value = withDelay(dly + 450, withRepeat(
            withSequence(
                withTiming(lo, { duration: dur * 0.5, easing: ease }),
                withTiming(hi, { duration: dur * 0.5, easing: ease }),
            ),
            -1,
        ));
    }, []);

    useEffect(() => {
        selectScale.value = withTiming(isSelected ? 1.14 : 1, { duration: 250, easing: Easing.out(Easing.ease) });
    }, [isSelected]);

    const floatStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: floatX.value }, { translateY: floatY.value }],
    }));

    const ringStyle = useAnimatedStyle(() => ({
        opacity: ringOpacity.value,
        transform: [{ scale: ringScale.value }],
    }));

    const circleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: selectScale.value }],
    }));

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[styles.bubble, {
                width: sz,
                height: sz,
                marginLeft: -sz / 2 + x,
                marginTop: -sz / 2 + y,
                zIndex: isSelected ? 20 : 10,
            }]}
            >
            <Animated.View style={floatStyle}>
                <Animated.View style={[styles.bubbleRing, {
                    width: sz * 1.4,
                    height: sz * 1.4,
                    borderRadius: sz * 0.7,
                    left: -sz * 0.2,
                    top: -sz * 0.2,
                    borderColor: p.status === 'friend' ? 'rgba(29,185,84,0.32)'
                        : p.status === 'pending_received' ? 'rgba(245,158,11,0.4)'
                        : p.status === 'pending_sent' ? 'rgba(29,185,84,0.22)'
                        : 'rgba(255,255,255,0.055)',
                }, ringStyle]} />

                <Animated.View style={[
                    styles.bubbleCircle,
                    {
                        width: sz,
                        height: sz,
                        borderRadius: sz / 2,
                        borderWidth: p.status === 'friend' ? 2.5 : p.status === 'pending_received' ? 2 : 1,
                        borderColor: p.status === 'friend' ? GREEN
                            : p.status === 'pending_received' ? AMBER
                            : p.status === 'pending_sent' ? 'rgba(29,185,84,0.5)'
                            : 'rgba(255,255,255,0.1)',
                        boxShadow: p.status === 'friend'
                            ? `0 4px 18px rgba(${GREEN_RGB},0.7)`
                            : p.status === 'pending_received'
                            ? `0 4px 18px rgba(${AMBER_RGB},0.7)`
                            : '0 4px 10px rgba(0,0,0,0.5)',
                    },
                    circleStyle,
                ]}>
                    {avatar ? (
                        <Image source={avatar.source} style={{ width: '100%', height: '100%', borderRadius: sz / 2 }} />
                    ) : (
                        <>
                            <LinearGradient
                                colors={
                                    p.status === 'pending_received' ? ['#f59e0b', '#b45309']
                                    : p.status === 'pending_sent' ? ['#1a5c38', '#123f26']
                                    : [p.color, p.color + '80']
                                }
                                start={{ x: 0.2, y: 0 }}
                                end={{ x: 0.8, y: 1 }}
                                style={[StyleSheet.absoluteFill, { borderRadius: sz / 2 }]}
                            />
                            <Text style={[styles.bubbleIni, { fontSize: p.status === 'friend' ? 14 : 11 }]}>{ini}</Text>
                        </>
                    )}
                </Animated.View>

                {/* pastille : cet ami écoute quelque chose en ce moment */}
                {listening && (
                    <View style={[styles.playingBadge, { left: sz - 14 }]}>
                        <Ionicons name="musical-note" size={10} color="#04150b" />
                    </View>
                )}

                <Text style={[styles.bubbleName, {
                    color: p.status === 'friend' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                }]}>{p.username}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

function MeRipple({ delay }: { delay: number }) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.6);

    useEffect(() => {
        scale.value = withDelay(delay, withRepeat(
            withSequence(
                withTiming(1, { duration: 0 }),
                withTiming(3.6, { duration: 3400, easing: Easing.out(Easing.ease) }),
            ),
            -1,
        ));
        opacity.value = withDelay(delay, withRepeat(
            withSequence(
                withTiming(0.6, { duration: 0 }),
                withTiming(0, { duration: 3400, easing: Easing.out(Easing.ease) }),
            ),
            -1,
        ));
    }, []);

    const ringStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return <Animated.View style={[styles.meRing, ringStyle]} />;
}

function MeBubble({ avatarId }: { avatarId: string | null }) {
    const breathScale = useSharedValue(1);
    const avatar = getAvatar(avatarId);

    useEffect(() => {
        breathScale.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
        );
    }, []);

    const breathStyle = useAnimatedStyle(() => ({
        transform: [{ scale: breathScale.value }],
    }));

    return (
        <View style={styles.meWrapper}>
            {[0, 1, 2].map(i => (
                <MeRipple key={i} delay={i * 1130} />
            ))}

            <Animated.View style={[styles.meCircle, breathStyle]}>
                {avatar ? (
                    <Image source={avatar.source} style={{ width: '100%', height: '100%', borderRadius: ME_SZ / 2 }} />
                ) : (
                    <>
                        <LinearGradient
                            colors={['#22c55e', '#15803d']}
                            start={{ x: 0.2, y: 0 }}
                            end={{ x: 0.8, y: 1 }}
                            style={[StyleSheet.absoluteFill, { borderRadius: ME_SZ / 2 }]}
                        />
                        <Ionicons name="musical-note" size={26} color="#fff" />
                    </>
                )}
            </Animated.View>

            <Text style={styles.meLabel}>TOI</Text>
        </View>
    );
}

export default function FriendsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { showToast } = useToast();
    const { friendsListening } = useRealtime();
    const { width: W, height: H } = useWindowDimensions();
    const vmin = Math.min(W, H);
    const cx = W / 2;
    const cy = H / 2;
    const { token } = useAuth();
    const [friends, setFriends] = useState<Person[]>([]);
    const [others, setOthers] = useState<Person[]>([]);
    const [pendingReceivedCount, setPendingReceivedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selKey, setSelKey] = useState<string | null>(null);
    const [myAvatar, setMyAvatar] = useState<string | null>(null);

    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchUnavailable, setSearchUnavailable] = useState(false);
    const [blockTarget, setBlockTarget] = useState<{ id: number; username: string } | null>(null);

    const loadData = useCallback(async () => {
        let mappedFriends: Person[] = [];
        try {
            const friendData = await apiFetch('/friendship/friends', token);
            mappedFriends = friendData.map((f: any, i: number) => ({
                key: `f-${f.id}`,
                relId: f.id,
                userId: f.friendId,
                username: f.username,
                avatar: f.avatar ?? null,
                color: COLORS[i % COLORS.length],
                ang: friendData.length ? (360 / friendData.length) * i : 0,
                dst: 22 + (i % 2) * 4,
                status: 'friend' as const,
            }));
            setFriends(mappedFriends);
        } catch (e: any) {
            console.warn('chargement des amis KO:', e?.message ?? e);
        }

        // "Inconnus"/pending = comptes via /users/search (q vide = tout le monde),
        // croises avec les demandes en cours et les blocages pour donner un statut a chacun.
        try {
            const friendIds = new Set(mappedFriends.map(f => f.userId));

            const [pendingReceived, pendingSent, blocked, allUsers] = (await Promise.all([
                apiFetch('/friendship/pending', token).catch(() => []),
                apiFetch('/friendship/pending/sent', token).catch(() => []),
                apiFetch('/friendship/blocked', token).catch(() => []),
                apiFetch('/users/search?q=', token),
            ])) as [any[], any[], any[], SearchResult[]];

            const receivedByUserId = new Map<number, number>(
                pendingReceived.map((r: any) => [r.fromId, r.id]),
            );
            const sentByUserId = new Map<number, number>(
                pendingSent.map((r: any) => [r.toId, r.id]),
            );
            const blockedIds = new Set<number>();
            blocked.forEach((b: any) => {
                blockedIds.add(b.blockedById);
                blockedIds.add(b.blockedUserId);
            });

            const candidates = allUsers.filter(u => !friendIds.has(u.id) && !blockedIds.has(u.id));

            const withStatus = candidates.map(u => {
                const status: RelStatus = receivedByUserId.has(u.id) ? 'pending_received'
                    : sentByUserId.has(u.id) ? 'pending_sent'
                    : 'stranger';
                const relId = receivedByUserId.get(u.id) ?? sentByUserId.get(u.id) ?? null;
                return { u, status, relId };
            });

            const pendingOnes = withStatus.filter(w => w.status !== 'stranger');
            const strangers = withStatus.filter(w => w.status === 'stranger').slice(0, 6);
            const combined = [...pendingOnes, ...strangers];

            setPendingReceivedCount(pendingOnes.filter(w => w.status === 'pending_received').length);

            const mappedOthers: Person[] = combined.map(({ u, status, relId }, i) => ({
                key: `o-${u.id}`,
                relId,
                userId: u.id,
                username: u.username,
                avatar: u.avatar ?? null,
                color: GREY[i % GREY.length],
                ang: (360 / Math.max(combined.length, 1)) * i + 30,
                dst: 36 + (i % 3) * 2,
                status,
            }));
            setOthers(mappedOthers);
        } catch {
            setOthers([]);
            setPendingReceivedCount(0);
        }

        setLoading(false);
    }, [token]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        apiFetch('/users/me', token).then(me => setMyAvatar(me.avatar || null)).catch(() => {});
    }, [token]);

    async function searchUsers(q: string) {
        setSearchQuery(q);
        setSearching(true);
        try {
            const data = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`, token);
            setSearchResults(data);
            setSearchUnavailable(false);
        } catch {
            setSearchResults([]);
            setSearchUnavailable(true);
        } finally {
            setSearching(false);
        }
    }

    useEffect(() => {
        if (searchOpen) searchUsers('');
    }, [searchOpen]);

    async function sendRequest(targetId: number) {
        try {
            const res = await apiFetch(`/friendship/request/${targetId}`, token, { method: 'POST' });
            showToast({ type: 'success', message: `Demande envoyée à ${res.receiver}` });
            setSearchQuery('');
            setSearchResults([]);
            setSearchOpen(false);
            loadData();
        } catch (e: any) {
            showToast({ type: 'error', message: e.message });
        }
    }

    async function cancelSentRequest(requestId: number) {
        try {
            await apiFetch(`/friendship/request/${requestId}`, token, { method: 'DELETE' });
            loadData();
        } catch (e: any) {
            showToast({ type: 'error', message: e.message });
        }
    }

    async function respondToRequest(requestId: number, action: 'accept' | 'reject') {
        try {
            await apiFetch(`/friendship/${requestId}/${action}`, token, { method: 'PATCH' });
            loadData();
        } catch (e: any) {
            showToast({ type: 'error', message: e.message });
        }
    }

    function confirmBlock(targetId: number, username: string) {
        setBlockTarget({ id: targetId, username });
    }

    async function performBlock() {
        if (!blockTarget) return;
        const { id, username } = blockTarget;
        setBlockTarget(null);
        try {
            await apiFetch(`/friendship/block/${id}`, token, { method: 'POST' });
            showToast({ type: 'success', message: `${username} a été bloqué` });
            loadData();
        } catch (e: any) {
            showToast({ type: 'error', message: e.message });
        }
    }

    const everyone = useMemo(() => [...friends, ...others], [friends, others]);
    const selected = everyone.find(p => p.key === selKey) ?? null;
    const selectedListening = selected?.status === 'friend' ? friendsListening[selected.userId] : undefined;

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <LinearGradient colors={['#102e52', '#081e38', '#030d1d']} style={StyleSheet.absoluteFill} />
                <ActivityIndicator color={GREEN} size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <PoolBackground friends={friends} width={W} height={H} vmin={vmin} cx={cx} cy={cy} />

            <View style={[styles.header, { top: insets.top + 16 }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.logo}>
                        <Ionicons name="musical-note" size={18} color="#000" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Amis</Text>
                        <Text style={styles.headerSubtitle}>{friends.length} ami{friends.length !== 1 ? 's' : ''}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => setSearchOpen(true)}>
                    <Text style={styles.addButtonPlus}>+</Text>
                    <Text style={styles.addButtonText}>Ajouter un ami</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.orbitZone}>
                {everyone.map(p => (
                    <UserBubble
                        key={p.key}
                        p={p}
                        vmin={vmin}
                        isSelected={selKey === p.key}
                        listening={p.status === 'friend' ? friendsListening[p.userId] : undefined}
                        onPress={() => setSelKey(prev => prev === p.key ? null : p.key)}
                    />
                ))}

                <MeBubble avatarId={myAvatar} />
            </View>

            {friends.length === 0 && (
                <Text style={styles.emptyText}>Aucun ami pour l'instant</Text>
            )}

            {/* Carte de la personne selectionnee */}
            {selected && (
                <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => setSelKey(null)}>
                    <View style={styles.cardTop}>
                        <View style={styles.cardAvatar}>
                            {getAvatar(selected.avatar) ? (
                                <Image source={getAvatar(selected.avatar)!.source} style={{ width: '100%', height: '100%', borderRadius: 23 }} />
                            ) : (
                                <>
                                    <LinearGradient
                                        colors={[selected.color, selected.color + '66']}
                                        start={{ x: 0.2, y: 0 }}
                                        end={{ x: 0.8, y: 1 }}
                                        style={[StyleSheet.absoluteFill, { borderRadius: 23 }]}
                                    />
                                    <Text style={styles.cardAvatarIni}>{selected.username.slice(0, 2).toUpperCase()}</Text>
                                </>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardName}>{selected.username}</Text>
                            {selected.status === 'friend' && selectedListening ? (
                                <View style={styles.nowPlaying}>
                                    {selectedListening.cover ? (
                                        <Image source={{ uri: selectedListening.cover }} style={styles.nowPlayingCover} />
                                    ) : (
                                        <View style={styles.nowPlayingCover}>
                                            <Ionicons name="musical-note" size={12} color={GREEN} />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.nowPlayingTitle} numberOfLines={1}>{selectedListening.title}</Text>
                                        <Text style={styles.nowPlayingArtist} numberOfLines={1}>{selectedListening.artist}</Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={styles.cardStatus}>
                                    {selected.status === 'friend' && 'Aucune ecoute en cours'}
                                    {selected.status === 'pending_sent' && 'Demande envoyee, en attente'}
                                    {selected.status === 'pending_received' && "t'a envoye une demande d'ami"}
                                    {selected.status === 'stranger' && 'Pas encore ami'}
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={styles.cardActions}>
                        {selected.status === 'friend' && ['Voir le profil', 'Inviter à ecouter'].map(lbl => (
                            <TouchableOpacity
                                key={lbl}
                                style={styles.cardAction}
                                onPress={() => showToast({ type: 'info', message: `« ${lbl} » arrive bientôt` })}
                            >
                                <Text style={styles.cardActionText}>{lbl}</Text>
                            </TouchableOpacity>
                        ))}
                        {selected.status === 'stranger' && (
                            <>
                                <TouchableOpacity style={styles.cardAction} onPress={() => sendRequest(selected.userId)}>
                                    <Text style={styles.cardActionText}>Ajouter en ami</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cardAction} onPress={() => confirmBlock(selected.userId, selected.username)}>
                                    <Text style={styles.cardActionText}>Bloquer</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        {selected.status === 'pending_sent' && selected.relId != null && (
                            <TouchableOpacity style={styles.cardAction} onPress={() => cancelSentRequest(selected.relId!)}>
                                <Text style={styles.cardActionText}>Annuler la demande</Text>
                            </TouchableOpacity>
                        )}
                        {selected.status === 'pending_received' && selected.relId != null && (
                            <>
                                <TouchableOpacity style={styles.cardAction} onPress={() => respondToRequest(selected.relId!, 'accept')}>
                                    <Text style={styles.cardActionText}>Accepter</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.cardAction} onPress={() => respondToRequest(selected.relId!, 'reject')}>
                                    <Text style={styles.cardActionText}>Refuser</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            )}

            {/* Legende */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={styles.legendDotFriend} />
                    <Text style={styles.legendTextFriend}>Amis</Text>
                </View>
                <Text style={styles.legendSep}>|</Text>
                <View style={styles.legendItem}>
                    <View style={styles.legendDotPendingReceived} />
                    <Text style={styles.legendTextPendingReceived}>Demande recue</Text>
                </View>
                <Text style={styles.legendSep}>|</Text>
                <View style={styles.legendItem}>
                    <View style={styles.legendDotPendingSent} />
                    <Text style={styles.legendTextPendingSent}>Demande envoyee</Text>
                </View>
                <Text style={styles.legendSep}>|</Text>
                <View style={styles.legendItem}>
                    <View style={styles.legendDotOther} />
                    <Text style={styles.legendTextOther}>Inconnus</Text>
                </View>
            </View>

            <Modal visible={searchOpen} animationType="slide" transparent onRequestClose={() => setSearchOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ajouter un ami</Text>
                            <TouchableOpacity onPress={() => setSearchOpen(false)}>
                                <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Rechercher un username..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            value={searchQuery}
                            onChangeText={searchUsers}
                            autoCapitalize="none"
                            autoFocus
                        />

                        {searching && <ActivityIndicator color={GREEN} style={{ marginTop: 16 }} />}

                        {!searching && searchUnavailable && (
                            <Text style={styles.searchUnavailableText}>
                                Recherche indisponible pour le moment — en attente de l'API.
                            </Text>
                        )}

                        {!searching && !searchUnavailable && searchResults.map(u => (
                            <View key={u.id} style={styles.resultRow}>
                                <Text style={styles.resultUsername}>{u.username}</Text>
                                <TouchableOpacity style={styles.resultButton} onPress={() => sendRequest(u.id)}>
                                    <Text style={styles.resultButtonText}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>
            </Modal>

            <ConfirmDialog
                visible={!!blockTarget}
                title="Bloquer cet utilisateur ?"
                message={blockTarget ? `${blockTarget.username} disparaitra de ton holographe.` : undefined}
                confirmLabel="Bloquer"
                destructive
                onConfirm={performBlock}
                onCancel={() => setBlockTarget(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#030d1d',
    },
    header: {
        position: 'absolute',
        left: 24,
        right: 24,
        zIndex: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 18px rgba(${GREEN_RGB},0.55)`,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 1,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 22,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    addButtonPlus: {
        fontSize: 16,
        color: GREEN,
        fontWeight: '700',
    },
    addButtonText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#0c1d33',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 320,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    searchInput: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontSize: 14,
    },
    searchUnavailableText: {
        marginTop: 16,
        textAlign: 'center',
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    resultUsername: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    resultButton: {
        backgroundColor: GREEN,
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 14,
    },
    resultButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#000',
    },
    orbitZone: {
        width: 0,
        height: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubble: {
        position: 'absolute',
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubbleRing: {
        position: 'absolute',
        borderWidth: 1,
    },
    bubbleCircle: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    playingBadge: {
        position: 'absolute',
        top: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#030d1d',
        zIndex: 30,
    },
    nowPlaying: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    nowPlayingCover: {
        width: 28,
        height: 28,
        borderRadius: 4,
        backgroundColor: 'rgba(29,185,84,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    nowPlayingTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: GREEN,
    },
    nowPlayingArtist: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.45)',
        marginTop: 1,
    },
    bubbleIni: {
        fontWeight: '700',
        color: 'rgba(255,255,255,0.95)',
        letterSpacing: 0.5,
    },
    bubbleName: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 7,
        fontSize: 9.5,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    emptyText: {
        position: 'absolute',
        bottom: 120,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
    },
    meWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    meRing: {
        position: 'absolute',
        width: ME_SZ,
        height: ME_SZ,
        borderRadius: ME_SZ / 2,
        borderWidth: 1.5,
        borderColor: 'rgba(29,185,84,0.9)',
    },
    meCircle: {
        width: ME_SZ,
        height: ME_SZ,
        borderRadius: ME_SZ / 2,
        borderWidth: 3,
        borderColor: 'rgba(29,185,84,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: `0 0 28px rgba(${GREEN_RGB},0.6)`,
    },
    meLabel: {
        marginTop: 10,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        color: 'rgba(255,255,255,0.88)',
    },
    card: {
        position: 'absolute',
        bottom: 90,
        alignSelf: 'center',
        zIndex: 50,
        minWidth: 260,
        backgroundColor: 'rgba(4,14,28,0.93)',
        borderWidth: 1,
        borderColor: 'rgba(29,185,84,0.3)',
        borderRadius: 18,
        padding: 18,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    cardAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 2.5,
        borderColor: GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    cardAvatarIni: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    cardName: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    cardStatus: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        marginTop: 4,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
    },
    cardAction: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 10,
        paddingVertical: 8,
    },
    cardActionText: {
        fontSize: 10.5,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    legend: {
        position: 'absolute',
        bottom: 26,
        alignSelf: 'center',
        zIndex: 50,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        maxWidth: '92%',
        backgroundColor: 'rgba(2,8,18,0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        borderRadius: 24,
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    legendDotFriend: {
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: GREEN,
        backgroundColor: 'rgba(29,185,84,0.15)',
    },
    legendTextFriend: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.65)',
    },
    legendSep: {
        color: 'rgba(255,255,255,0.1)',
        fontSize: 14,
    },
    legendDotPendingReceived: {
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.15)',
    },
    legendTextPendingReceived: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(245,158,11,0.85)',
    },
    legendDotPendingSent: {
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: 'rgba(29,185,84,0.5)',
        backgroundColor: 'rgba(29,185,84,0.08)',
    },
    legendTextPendingSent: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.4)',
    },
    legendDotOther: {
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.16)',
    },
    legendTextOther: {
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.3)',
    },
});
