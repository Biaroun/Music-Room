import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, apiFetch } from '../config/api';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';

export type FriendListening = {
    userId: number;
    username: string;
    avatar: string | null;
    deezerId: string;
    title: string;
    artist: string;
    cover: string | null;
    startedAt: number;
};

export type ListeningReport = {
    deezerId: string;
    title: string;
    artist: string;
    cover?: string;
};

export type VoteBoardTrack = {
    trackId: number;
    deezerId: string;
    title: string;
    artist: string;
    cover: string | null;
    voteCount: number;
    myVote: boolean;
};

export type VoteNowPlaying = {
    trackId: number;
    deezerId: string;
    title: string;
    artist: string;
    cover: string | null;
    previewUrl: string;
    startedAt: number;
    durationMs: number;
};

export type VoteBoard = {
    tracks: VoteBoardTrack[];
    nowPlaying: VoteNowPlaying | null;
    updatedAt: number;
};

type RealtimeContextType = {
    /** true quand le websocket est établi ; sinon on est en repli REST */
    connected: boolean;
    /** écoutes en cours des amis, indexées par userId */
    friendsListening: Record<number, FriendListening>;
    /** déclare ce que j'écoute, ou null quand je m'arrête */
    reportListening: (track: ListeningReport | null) => void;
    /** board du dernier event rejoint (undefined tant qu'aucun snapshot n'est arrivé) */
    voteBoard: VoteBoard | undefined;
    /** rejoint la room de vote de cet event ; le board arrive ensuite via voteBoard */
    joinEvent: (eventId: number) => void;
    leaveEvent: (eventId: number) => void;
    /** vote via le socket quand connecté ; à l'appelant de faire un repli REST sinon */
    castVoteRealtime: (eventId: number, trackId: number, position?: { latitude: number; longitude: number }) => void;
    /** retire un vote pour un morceau précis (un voteur peut voter plusieurs morceaux, un seul vote par morceau) */
    retractVoteRealtime: (eventId: number, trackId: number, position?: { latitude: number; longitude: number }) => void;
};

const RealtimeContext = createContext<RealtimeContextType | null>(null);

// Doit rester sous le TTL du backend (120s) pour qu'un heartbeat perdu
// ne fasse pas disparaître l'écoute.
const HEARTBEAT_MS = 45_000;
// Utilisé seulement quand le websocket ne passe pas.
const FALLBACK_POLL_MS = 20_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [connected, setConnected] = useState(false);
    const [friendsListening, setFriendsListening] = useState<Record<number, FriendListening>>({});
    const [voteBoard, setVoteBoard] = useState<VoteBoard | undefined>(undefined);
    const socketRef = useRef<Socket | null>(null);
    // rejoint automatiquement à la reconnexion si un écran de vote est ouvert
    const joinedEventIdRef = useRef<number | null>(null);
    // dernier morceau déclaré : sert à réémettre le heartbeat et à rejouer
    // l'état après une reconnexion
    const lastReportRef = useRef<ListeningReport | null>(null);

    function indexByUser(list: FriendListening[]): Record<number, FriendListening> {
        return Object.fromEntries(list.map((l) => [l.userId, l]));
    }

    useEffect(() => {
        if (!token) {
            setFriendsListening({});
            return;
        }

        // transports websocket only : en React Native le polling XHR d'engine.io
        // pose plus de problèmes qu'il n'en résout
        const socket = io(`${API_URL}/realtime`, {
            transports: ['websocket'],
            auth: { token },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            // on redéclare l'écoute en cours : le backend a pu perdre l'état
            // pendant la coupure
            if (lastReportRef.current) socket.emit('listening:update', lastReportRef.current);
            // reconnexion : la room de vote n'a pas survécu à la coupure
            if (joinedEventIdRef.current != null) socket.emit('event:join', { eventId: joinedEventIdRef.current });
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => setConnected(false));

        socket.on('listening:snapshot', (list: FriendListening[]) => {
            setFriendsListening(indexByUser(list ?? []));
        });
        socket.on('listening:changed', (entry: FriendListening) => {
            setFriendsListening((prev) => ({ ...prev, [entry.userId]: entry }));
        });
        socket.on('listening:stopped', ({ userId }: { userId: number }) => {
            setFriendsListening((prev) => {
                if (!(userId in prev)) return prev;
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        });

        socket.on('vote:board', (board: VoteBoard) => setVoteBoard(board));
        // sans ça un vote refusé cote serveur (licence/visibilite) echoue en silence :
        // rien ne l'affichait avant, on avait juste l'evenement sans listener.
        socket.on('vote:error', ({ message }: { message: string }) => {
            showToast({ type: 'error', message: message || 'Vote failed' });
        });

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    }, [token]);

    const joinEvent = useCallback((eventId: number) => {
        joinedEventIdRef.current = eventId;
        setVoteBoard(undefined);
        socketRef.current?.emit('event:join', { eventId });
    }, []);

    const leaveEvent = useCallback((eventId: number) => {
        if (joinedEventIdRef.current === eventId) joinedEventIdRef.current = null;
        socketRef.current?.emit('event:leave', { eventId });
    }, []);

    const castVoteRealtime = useCallback(
        (eventId: number, trackId: number, position?: { latitude: number; longitude: number }) => {
            socketRef.current?.emit('vote:cast', { eventId, trackId, ...position });
        },
        [],
    );

    const retractVoteRealtime = useCallback(
        (eventId: number, trackId: number, position?: { latitude: number; longitude: number }) => {
            socketRef.current?.emit('vote:retract', { eventId, trackId, ...position });
        },
        [],
    );

    const reportListening = useCallback(
        (track: ListeningReport | null) => {
            lastReportRef.current = track;
            if (!token) return;

            const socket = socketRef.current;
            if (socket?.connected) {
                if (track) socket.emit('listening:update', track);
                else socket.emit('listening:stop');
                return;
            }
            // repli REST : la fonctionnalité doit marcher même sans websocket
            const request = track
                ? apiFetch('/listening/me', token, { method: 'PUT', body: JSON.stringify(track) })
                : apiFetch('/listening/me', token, { method: 'DELETE' });
            request.catch(() => {});
        },
        [token],
    );

    // Heartbeat : sans rappel régulier la clé expire côté backend et l'écoute
    // disparaît de l'écran des amis.
    useEffect(() => {
        if (!token) return;
        const id = setInterval(() => {
            if (lastReportRef.current) reportListening(lastReportRef.current);
        }, HEARTBEAT_MS);
        return () => clearInterval(id);
    }, [token, reportListening]);

    // Repli : tant que le websocket ne passe pas, on interroge le REST.
    useEffect(() => {
        if (!token || connected) return;
        let active = true;
        const load = () => {
            apiFetch('/listening/friends', token)
                .then((list: FriendListening[]) => { if (active) setFriendsListening(indexByUser(list ?? [])); })
                .catch(() => {});
        };
        load();
        const id = setInterval(load, FALLBACK_POLL_MS);
        return () => { active = false; clearInterval(id); };
    }, [token, connected]);

    return (
        <RealtimeContext.Provider
            value={{
                connected,
                friendsListening,
                reportListening,
                voteBoard,
                joinEvent,
                leaveEvent,
                castVoteRealtime,
                retractVoteRealtime,
            }}
        >
            {children}
        </RealtimeContext.Provider>
    );
}

export function useRealtime() {
    const ctx = useContext(RealtimeContext);
    if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
    return ctx;
}
