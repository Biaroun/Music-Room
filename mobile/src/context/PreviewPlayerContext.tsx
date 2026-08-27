import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { storage } from '../config/storage';
import { useRealtime } from './RealtimeContext';

export type PreviewTrack = {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  cover: string | null;
  previewUrl: string;
  bpm?: number | null;
};

type PreviewPlayerContextType = {
  activeTrack: PreviewTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  hasNext: boolean;
  hasPrevious: boolean;
  transitionsEnabled: boolean;
  setTransitionsEnabled: (enabled: boolean) => void;
  toggle: (track: PreviewTrack, queue?: PreviewTrack[]) => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
};

const PreviewPlayerContext = createContext<PreviewPlayerContextType | null>(null);

// 4s de fondu, tick toutes les 100ms — reste court vu qu'une preview ne fait que 30s.
const CROSSFADE_SEC = 4;
const CROSSFADE_TICK_MS = 100;
// au dela de 8% d'ecart ca sonne bizarre meme avec pitch correction, donc on ne force pas.
const BPM_TOLERANCE = 0.08;
const TRANSITIONS_SETTING_KEY = 'transitions_enabled';

// Vitesse a appliquer au morceau qui arrive pour caler son bpm sur celui qui part.
// 70 et 140 bpm peuvent "matcher" en half-time, donc on teste le ratio direct, x2 et /2,
// et on garde celui le plus proche de 1. Rien de bon dans les 8% -> null (fondu simple).
function computeSyncRate(outgoingBpm: number, incomingBpm: number): number | null {
  const raw = outgoingBpm / incomingBpm;
  const candidates = [raw, raw / 2, raw * 2];
  const best = candidates.reduce((a, b) => (Math.abs(b - 1) < Math.abs(a - 1) ? b : a));
  return Math.abs(best - 1) <= BPM_TOLERANCE ? best : null;
}

export function PreviewPlayerProvider({ children }: { children: React.ReactNode }) {
  // Deux platines comme un DJ: pendant que l'une joue (le "front"), l'autre precharge le
  // morceau suivant. Impossible d'avoir deux sons en meme temps avec un seul player.
  const deckA = useAudioPlayer(null);
  const deckB = useAudioPlayer(null);
  const statusA = useAudioPlayerStatus(deckA);
  const statusB = useAudioPlayerStatus(deckB);

  const [activeTrack, setActiveTrack] = useState<PreviewTrack | null>(null);
  const [frontKey, setFrontKey] = useState<'A' | 'B'>('A');
  const [transitionsEnabled, setTransitionsEnabledState] = useState(true);

  const queueRef = useRef<PreviewTrack[] | null>(null);
  // Copies "toujours a jour" du state, pour que le listener audio (branche une seule fois
  // plus bas) lise la vraie valeur au lieu d'une valeur figee au moment de sa creation.
  const activeTrackRef = useRef<PreviewTrack | null>(null);
  const frontKeyRef = useRef<'A' | 'B'>('A');
  const transitionsEnabledRef = useRef(true);
  const crossfadingRef = useRef(false);
  const crossfadeTriggeredForRef = useRef<string | null>(null);
  const crossfadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { activeTrackRef.current = activeTrack; }, [activeTrack]);
  useEffect(() => { frontKeyRef.current = frontKey; }, [frontKey]);
  useEffect(() => { transitionsEnabledRef.current = transitionsEnabled; }, [transitionsEnabled]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    // relit le reglage sauve au demarrage (sinon on reste sur le defaut le temps que ca charge)
    storage.getItem(TRANSITIONS_SETTING_KEY).then((v) => {
      if (v != null) setTransitionsEnabledState(v === '1');
    });
  }, []);

  function setTransitionsEnabled(enabled: boolean) {
    setTransitionsEnabledState(enabled);
    storage.setItem(TRANSITIONS_SETTING_KEY, enabled ? '1' : '0').catch(() => {});
  }

  function getDeck(key: 'A' | 'B'): AudioPlayer {
    return key === 'A' ? deckA : deckB;
  }

  function clearCrossfadeTimer() {
    if (crossfadeTimerRef.current) {
      clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
  }

  // Annule un fondu en cours (skip manuel par exemple) et remet les deux decks au propre.
  function abortCrossfade(key: 'A' | 'B') {
    clearCrossfadeTimer();
    crossfadingRef.current = false;
    crossfadeTriggeredForRef.current = null;
    getDeck(key).volume = 1;
    const otherKey = key === 'A' ? 'B' : 'A';
    getDeck(otherKey).pause();
    getDeck(otherKey).volume = 1;
  }

  // Lance un morceau depuis zero sur le deck donne (volume/vitesse remis a la normale avant).
  function playAt(track: PreviewTrack, key: 'A' | 'B') {
    const deck = getDeck(key);
    deck.volume = 1;
    deck.setPlaybackRate(1, 'high');
    deck.replace(track.previewUrl);
    deck.play();
    setActiveTrack(track);
    setFrontKey(key);
    frontKeyRef.current = key;
    crossfadeTriggeredForRef.current = null;
  }

  // Fallback brutal, pas de fondu: transitions off, ou morceau fini avant d'avoir pu declencher.
  function advanceHardCut() {
    const queue = queueRef.current;
    const current = activeTrackRef.current;
    const idx = queue?.findIndex((t) => t.id === current?.id) ?? -1;
    const next = queue && idx >= 0 ? queue[idx + 1] : undefined;
    if (next) {
      playAt(next, frontKeyRef.current);
    } else {
      queueRef.current = null;
      setActiveTrack(null);
    }
  }

  // Le coeur du fondu. outDeck descend, inDeck (charge le morceau suivant) monte. Un
  // setInterval bouge les deux volumes a l'oppose a chaque tick jusqu'a 1, puis outDeck
  // est mis en pause et inDeck devient le nouveau front.
  function startCrossfade(current: PreviewTrack, next: PreviewTrack) {
    const outKey = frontKeyRef.current;
    const inKey = outKey === 'A' ? 'B' : 'A';
    const outDeck = getDeck(outKey);
    const inDeck = getDeck(inKey);

    crossfadingRef.current = true;
    crossfadeTriggeredForRef.current = current.id;

    const rate = current.bpm && next.bpm ? computeSyncRate(current.bpm, next.bpm) : null;
    inDeck.volume = 0;
    inDeck.setPlaybackRate(rate ?? 1, 'high');
    inDeck.replace(next.previewUrl);
    inDeck.play();

    const steps = Math.round((CROSSFADE_SEC * 1000) / CROSSFADE_TICK_MS);
    let step = 0;
    clearCrossfadeTimer();
    crossfadeTimerRef.current = setInterval(() => {
      step += 1;
      const t = Math.min(step / steps, 1);
      outDeck.volume = 1 - t;
      inDeck.volume = t;

      if (t >= 1) {
        clearCrossfadeTimer();
        outDeck.pause();
        outDeck.volume = 1;
        outDeck.setPlaybackRate(1, 'high'); // on remet la vitesse normale pour la prochaine fois
        crossfadingRef.current = false;
        crossfadeTriggeredForRef.current = null;
        setActiveTrack(next);
        setFrontKey(inKey);
        frontKeyRef.current = inKey;
      }
    }, CROSSFADE_TICK_MS);
  }

  // Appele a chaque update de statut d'un deck. On ignore ce qui vient du deck non-front,
  // et ce qui arrive pendant un fondu deja en cours (il se termine tout seul). Deux cas
  // interessants: le morceau vient de finir (hard cut de secours), ou il reste moins de
  // CROSSFADE_SEC avant la fin (on lance le fondu si transitions actives + morceau suivant).
  function handleStatusUpdate(key: 'A' | 'B', s: { currentTime: number; duration: number; didJustFinish: boolean }) {
    if (frontKeyRef.current !== key) return;
    if (crossfadingRef.current) return;

    if (s.didJustFinish) {
      advanceHardCut();
      return;
    }

    if (!transitionsEnabledRef.current || s.duration <= 0) return;
    if (s.duration - s.currentTime > CROSSFADE_SEC) return;

    const queue = queueRef.current;
    const current = activeTrackRef.current;
    const idx = queue?.findIndex((t) => t.id === current?.id) ?? -1;
    const next = queue && idx >= 0 ? queue[idx + 1] : undefined;
    if (!next || !current) return;
    // sans ca on relancerait un fondu a chaque update tant qu'on est dans les 4 dernieres secondes
    if (crossfadeTriggeredForRef.current === current.id) return;

    startCrossfade(current, next);
  }

  // Listener natif plutot qu'un useEffect sur status.didJustFinish: react ne redeclenche
  // un effect que si la valeur change entre deux renders, donc un evenement pourrait se
  // perdre. Le listener, lui, recoit chaque update une fois, sans dependre du render cycle.
  useEffect(() => {
    const subA = deckA.addListener('playbackStatusUpdate', (s) => handleStatusUpdate('A', s));
    const subB = deckB.addListener('playbackStatusUpdate', (s) => handleStatusUpdate('B', s));
    return () => {
      subA.remove();
      subB.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckA, deckB]);

  const queue = queueRef.current;
  const activeIndex = queue?.findIndex((t) => t.id === activeTrack?.id) ?? -1;
  const hasNext = !!queue && activeIndex >= 0 && activeIndex < queue.length - 1;
  const hasPrevious = !!queue && activeIndex > 0;
  const frontStatus = frontKey === 'A' ? statusA : statusB;

  function toggle(track: PreviewTrack, newQueue?: PreviewTrack[]) {
    if (activeTrack?.id === track.id) {
      frontStatus.playing ? getDeck(frontKey).pause() : getDeck(frontKey).play();
      return;
    }
    abortCrossfade(frontKey);
    queueRef.current = newQueue ?? null;
    playAt(track, frontKey);
  }

  // Skip manuel = coupe toujours net, meme transitions activees. Le fondu c'est pour un
  // enchainement naturel, pas pour un clic ou l'utilisateur veut changer tout de suite.
  function next() {
    if (!hasNext || !queue) return;
    abortCrossfade(frontKey);
    playAt(queue[activeIndex + 1], frontKey);
  }

  function previous() {
    if (!hasPrevious || !queue) return;
    abortCrossfade(frontKey);
    playAt(queue[activeIndex - 1], frontKey);
  }

  function stop() {
    abortCrossfade(frontKey);
    queueRef.current = null;
    getDeck(frontKey).pause();
    setActiveTrack(null);
  }

  // On déclare au backend ce qu'on écoute, pour que nos amis le voient sur l'écran
  // Amis. Une pause compte comme "plus rien en cours" : c'est ce que l'écran affiche.
  const { reportListening } = useRealtime();
  const isPlaying = frontStatus.playing;
  useEffect(() => {
    if (activeTrack && isPlaying) {
      reportListening({
        deezerId: activeTrack.id,
        title: activeTrack.title,
        artist: activeTrack.artist,
        cover: activeTrack.cover ?? undefined,
      });
    } else {
      reportListening(null);
    }
  }, [activeTrack?.id, isPlaying, reportListening]);

  return (
    <PreviewPlayerContext.Provider
      value={{
        activeTrack,
        isPlaying,
        currentTime: frontStatus.currentTime,
        duration: frontStatus.duration,
        hasNext,
        hasPrevious,
        transitionsEnabled,
        setTransitionsEnabled,
        toggle,
        next,
        previous,
        stop,
      }}
    >
      {children}
    </PreviewPlayerContext.Provider>
  );
}

export function usePreviewPlayer() {
  const ctx = useContext(PreviewPlayerContext);
  if (!ctx) throw new Error('usePreviewPlayer must be used inside PreviewPlayerProvider');
  return ctx;
}
