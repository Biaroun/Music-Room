import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, apiFetch } from '../config/api';
import { useAuth } from './AuthContext';

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

type RealtimeContextType = {
    /** true quand le websocket est établi ; sinon on est en repli REST */
    connected: boolean;
    /** écoutes en cours des amis, indexées par userId */
    friendsListening: Record<number, FriendListening>;
    /** déclare ce que j'écoute, ou null quand je m'arrête */
    reportListening: (track: ListeningReport | null) => void;
};

const RealtimeContext = createContext<RealtimeContextType | null>(null);

// Doit rester sous le TTL du backend (120s) pour qu'un heartbeat perdu
// ne fasse pas disparaître l'écoute.
const HEARTBEAT_MS = 45_000;
// Utilisé seulement quand le websocket ne passe pas.
const FALLBACK_POLL_MS = 20_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const [connected, setConnected] = useState(false);
    const [friendsListening, setFriendsListening] = useState<Record<number, FriendListening>>({});
    const socketRef = useRef<Socket | null>(null);
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

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    }, [token]);

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
        <RealtimeContext.Provider value={{ connected, friendsListening, reportListening }}>
            {children}
        </RealtimeContext.Provider>
    );
}

export function useRealtime() {
    const ctx = useContext(RealtimeContext);
    if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
    return ctx;
}
