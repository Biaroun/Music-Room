import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, apiFetch } from '../config/api';
import { DEVICE_CONTEXT } from '../config/device';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';
import type { AddTrackInput, PlaylistState } from '../lib/playlists';

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
    /** true quand le websocket est etabli ; sinon on est en repli rest */
    connected: boolean;
    /** ecoutes en cours des amis, indexees par userId */
    friendsListening: Record<number, FriendListening>;
    /** declare ce que j'ecoute, ou null quand je m'arrete */
    reportListening: (track: ListeningReport | null) => void;
    /** board du dernier event rejoint (undefined tant qu'aucun snapshot n'est arrive) */
    voteBoard: VoteBoard | undefined;
    /** rejoint la room de vote de cet event ; le board arrive ensuite via voteBoard */
    joinEvent: (eventId: number) => void;
    leaveEvent: (eventId: number) => void;
    /** vote via le socket quand connecte ; a l'appelant de faire un repli rest sinon */
    castVoteRealtime: (eventId: number, trackId: number, position?: { latitude: number; longitude: number }) => void;
    /** retire un vote pour un morceau precis (un voteur peut voter plusieurs morceaux, un seul vote par morceau) */
    retractVoteRealtime: (eventId: number, trackId: number, position?: { latitude: number; longitude: number }) => void;
    /** etat de la playlist rejointe (undefined tant qu'aucun snapshot n'est arrive) */
    playlistState: PlaylistState | undefined;
    /** rejoint la room d'edition de cette playlist ; l'etat arrive ensuite via playlistState */
    joinPlaylist: (playlistId: number) => void;
    leavePlaylist: (playlistId: number) => void;
    /** edite via le socket quand connecte ; a l'appelant de faire un repli rest sinon */
    addTrackRealtime: (playlistId: number, dto: AddTrackInput) => void;
    removeTrackRealtime: (playlistId: number, trackId: number) => void;
    /** version = celle du dernier etat recu ; le serveur refuse un reorder perime */
    reorderRealtime: (playlistId: number, trackIds: number[], version: number) => void;
};

const RealtimeContext = createContext<RealtimeContextType | null>(null);

// doit rester sous le ttl du backend (120s) pour qu'un heartbeat perdu
// ne fasse pas disparaitre l'ecoute.
const HEARTBEAT_MS = 45_000;
// utilise seulement quand le websocket ne passe pas.
const FALLBACK_POLL_MS = 20_000;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [connected, setConnected] = useState(false);
    const [friendsListening, setFriendsListening] = useState<Record<number, FriendListening>>({});
    const [voteBoard, setVoteBoard] = useState<VoteBoard | undefined>(undefined);
    const [playlistState, setPlaylistState] = useState<PlaylistState | undefined>(undefined);
    const socketRef = useRef<Socket | null>(null);
    // rejoint automatiquement a la reconnexion si un ecran de vote est ouvert
    const joinedEventIdRef = useRef<number | null>(null);
    // idem pour l'editeur de playlist
    const joinedPlaylistIdRef = useRef<number | null>(null);
    // dernier morceau declare : sert a reemettre le heartbeat et a rejouer
    // l'etat apres une reconnexion
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
        // pose plus de problemes qu'il n'en resout
        const socket = io(`${API_URL}/realtime`, {
            transports: ['websocket'],
            // le triplet v.6 voyage dans le payload du handshake : pas d'en-tete
            // par message en websocket, et une partie des actions ne passe plus
            // par apiFetch depuis le playlist-editor temps reel
            auth: { token, ...DEVICE_CONTEXT },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            // on redeclare l'ecoute en cours : le backend a pu perdre l'etat
            // pendant la coupure
            if (lastReportRef.current) socket.emit('listening:update', lastReportRef.current);
            // reconnexion : la room de vote n'a pas survecu a la coupure
            if (joinedEventIdRef.current != null) socket.emit('event:join', { eventId: joinedEventIdRef.current });
            // idem pour la room d'edition de playlist
            if (joinedPlaylistIdRef.current != null) {
                socket.emit('playlist:join', { playlistId: joinedPlaylistIdRef.current });
            }
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
        // sans ca un vote refuse cote serveur (licence/visibilite) echoue en silence :
        // rien ne l'affichait avant, on avait juste l'evenement sans listener.
        socket.on('vote:error', ({ message }: { message: string }) => {
            showToast({ type: 'error', message: message || 'Vote failed' });
        });

        socket.on('playlist:state', (state: PlaylistState) => setPlaylistState(state));
        socket.on('playlist:error', ({ message }: { message: string }) => {
            showToast({ type: 'error', message: message || 'Playlist update failed' });
        });
        // edition concurrente : le serveur a refuse notre ordre et renvoie le
        // sien. on l'adopte, sinon les deux ecrans divergent durablement.
        socket.on('playlist:conflict', ({ message, state }: { message: string; state: PlaylistState }) => {
            setPlaylistState(state);
            showToast({ type: 'error', message: message || 'Someone else reordered this playlist' });
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

    const joinPlaylist = useCallback((playlistId: number) => {
        joinedPlaylistIdRef.current = playlistId;
        setPlaylistState(undefined);
        socketRef.current?.emit('playlist:join', { playlistId });
    }, []);

    const leavePlaylist = useCallback((playlistId: number) => {
        if (joinedPlaylistIdRef.current === playlistId) joinedPlaylistIdRef.current = null;
        socketRef.current?.emit('playlist:leave', { playlistId });
    }, []);

    const addTrackRealtime = useCallback((playlistId: number, dto: AddTrackInput) => {
        socketRef.current?.emit('playlist:track:add', { playlistId, ...dto });
    }, []);

    const removeTrackRealtime = useCallback((playlistId: number, trackId: number) => {
        socketRef.current?.emit('playlist:track:remove', { playlistId, trackId });
    }, []);

    const reorderRealtime = useCallback((playlistId: number, trackIds: number[], version: number) => {
        socketRef.current?.emit('playlist:reorder', { playlistId, trackIds, version });
    }, []);

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
            // repli rest : la fonctionnalite doit marcher meme sans websocket
            const request = track
                ? apiFetch('/listening/me', token, { method: 'PUT', body: JSON.stringify(track) })
                : apiFetch('/listening/me', token, { method: 'DELETE' });
            request.catch(() => {});
        },
        [token],
    );

    // heartbeat : sans rappel regulier la cle expire cote backend et l'ecoute
    // disparait de l'ecran des amis.
    useEffect(() => {
        if (!token) return;
        const id = setInterval(() => {
            if (lastReportRef.current) reportListening(lastReportRef.current);
        }, HEARTBEAT_MS);
        return () => clearInterval(id);
    }, [token, reportListening]);

    // repli : tant que le websocket ne passe pas, on interroge le REST.
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
                playlistState,
                joinPlaylist,
                leavePlaylist,
                addTrackRealtime,
                removeTrackRealtime,
                reorderRealtime,
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
