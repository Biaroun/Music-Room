import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { storage } from '../config/storage';
import { useRealtime } from './RealtimeContext';

// a track the mini player can play (30s preview)
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
  /** 0 (muet) a 1 (plein volume), applique au morceau qui joue actuellement. */
  volume: number;
  setVolume: (volume: number) => void;
  toggle: (track: PreviewTrack, queue?: PreviewTrack[]) => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
};

const PreviewPlayerContext = createContext<PreviewPlayerContextType | null>(null);

// 4s de fondu, tick toutes les 100ms , reste court vu qu'une preview ne fait que 30s.
const CROSSFADE_SEC = 4;
const CROSSFADE_TICK_MS = 100;
// au dela de 8% d'ecart ca sonne bizarre meme avec pitch correction, donc on ne force pas.
const BPM_TOLERANCE = 0.08;
// storage keys of the player settings
const TRANSITIONS_SETTING_KEY = 'transitions_enabled';
const VOLUME_SETTING_KEY = 'preview_volume';

// vitesse a appliquer au morceau qui arrive pour caler son bpm sur celui qui part.
// 70 et 140 bpm peuvent "matcher" en half-time, donc on teste le ratio direct, x2 et /2,
// et on garde celui le plus proche de 1. rien de bon dans les 8% -> null (fondu simple).
function computeSyncRate(outgoingBpm: number, incomingBpm: number): number | null {
  const raw = outgoingBpm / incomingBpm;
  // raw = same tempo /2 and x2 = half time or double time
  const candidates = [raw, raw / 2, raw * 2];
  const best = candidates.reduce((a, b) => (Math.abs(b - 1) < Math.abs(a - 1) ? b : a));
  return Math.abs(best - 1) <= BPM_TOLERANCE ? best : null;
}

// the audio player of the app (2 decks crossfade bpm sync queue volume)
export function PreviewPlayerProvider({ children }: { children: React.ReactNode }) {
  // deux platines comme un DJ: pendant que l'une joue (le "front"), l'autre precharge le
  // morceau suivant. impossible d'avoir deux sons en meme temps avec un seul player.
  const deckA = useAudioPlayer(null);
  const deckB = useAudioPlayer(null);
  const statusA = useAudioPlayerStatus(deckA);
  const statusB = useAudioPlayerStatus(deckB);

  const [activeTrack, setActiveTrack] = useState<PreviewTrack | null>(null);
  const [frontKey, setFrontKey] = useState<'A' | 'B'>('A');
  const [transitionsEnabled, setTransitionsEnabledState] = useState(true);
  const [volume, setVolumeState] = useState(1);

  // the list we play in (null = single track no next no previous)
  const queueRef = useRef<PreviewTrack[] | null>(null);
  // copies "toujours a jour" du state, pour que le listener audio (branche une seule fois
  // plus bas) lise la vraie valeur au lieu d'une valeur figee au moment de sa creation.
  const activeTrackRef = useRef<PreviewTrack | null>(null);
  const frontKeyRef = useRef<'A' | 'B'>('A');
  const transitionsEnabledRef = useRef(true);
  const volumeRef = useRef(1);
  const crossfadingRef = useRef(false);
  // id of the track we already started a fade for
  const crossfadeTriggeredForRef = useRef<string | null>(null);
  const crossfadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // keep the refs in sync with the state
  useEffect(() => { activeTrackRef.current = activeTrack; }, [activeTrack]);
  useEffect(() => { frontKeyRef.current = frontKey; }, [frontKey]);
  useEffect(() => { transitionsEnabledRef.current = transitionsEnabled; }, [transitionsEnabled]);

  useEffect(() => {
    // play even when the phone is on silent (ios)
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    // relit les reglages sauves au demarrage (sinon on reste sur le defaut le temps que ca charge)
    storage.getItem(TRANSITIONS_SETTING_KEY).then((v) => {
      if (v != null) setTransitionsEnabledState(v === '1');
    });
    storage.getItem(VOLUME_SETTING_KEY).then((v) => {
      if (v == null) return;
      const parsed = parseFloat(v);
      if (!Number.isNaN(parsed)) {
        volumeRef.current = parsed;
        setVolumeState(parsed);
      }
    });
  }, []);

  // turn the crossfade on or off and save it (1 or 0)
  function setTransitionsEnabled(enabled: boolean) {
    setTransitionsEnabledState(enabled);
    storage.setItem(TRANSITIONS_SETTING_KEY, enabled ? '1' : '0').catch(() => {});
  }

  // applique tout de suite au deck audible (sauf pendant un fondu : le tick
  // du fondu relit volumeRef a chaque pas, la nouvelle valeur y est prise en
  // compte automatiquement sans a-coup).
  function setVolume(v: number) {
    // locationX cote web n'est pas toujours fiable (Pressable RN-Web) et peut
    // remonter NaN : sans ce garde-fou, assigner ca a HTMLMediaElement.volume
    // fait planter l'element audio entier.
    if (!Number.isFinite(v)) return;
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    storage.setItem(VOLUME_SETTING_KEY, String(clamped)).catch(() => {});
    if (!crossfadingRef.current) {
      getDeck(frontKeyRef.current).volume = clamped;
    }
  }

  // the player behind the key A or B
  function getDeck(key: 'A' | 'B'): AudioPlayer {
    return key === 'A' ? deckA : deckB;
  }

  // stop the fade interval if there is one
  function clearCrossfadeTimer() {
    if (crossfadeTimerRef.current) {
      clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
  }

  // annule un fondu en cours (skip manuel par exemple) et remet les deux decks au propre.
  function abortCrossfade(key: 'A' | 'B') {
    clearCrossfadeTimer();
    crossfadingRef.current = false;
    crossfadeTriggeredForRef.current = null;
    getDeck(key).volume = volumeRef.current;
    const otherKey = key === 'A' ? 'B' : 'A';
    getDeck(otherKey).pause();
    getDeck(otherKey).volume = volumeRef.current;
  }

  // lance un morceau depuis zero sur le deck donne (volume/vitesse remis a la normale avant).
  function playAt(track: PreviewTrack, key: 'A' | 'B') {
    const deck = getDeck(key);
    deck.volume = volumeRef.current;
    deck.setPlaybackRate(1, 'high');
    deck.replace(track.previewUrl);
    deck.play();
    setActiveTrack(track);
    setFrontKey(key);
    frontKeyRef.current = key;
    crossfadeTriggeredForRef.current = null;
  }

  // fallback brutal, pas de fondu: transitions off, ou morceau fini avant d'avoir pu declencher.
  function advanceHardCut() {
    const queue = queueRef.current;
    const current = activeTrackRef.current;
    // position of the current track in the queue (idx + 1 = the next one)
    const idx = queue?.findIndex((t) => t.id === current?.id) ?? -1;
    const next = queue && idx >= 0 ? queue[idx + 1] : undefined;
    if (next) {
      playAt(next, frontKeyRef.current);
    } else {
      queueRef.current = null;
      setActiveTrack(null);
    }
  }

  // le coeur du fondu. outDeck descend, inDeck (charge le morceau suivant) monte. un
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

    // 4000ms / 100ms = 40 steps
    const steps = Math.round((CROSSFADE_SEC * 1000) / CROSSFADE_TICK_MS);
    let step = 0;
    clearCrossfadeTimer();
    crossfadeTimerRef.current = setInterval(() => {
      step += 1;
      const t = Math.min(step / steps, 1);
      // volumeRef relu a chaque tick : un ajustement du volume pendant un
      // fondu s'applique immediatement, sans casser la rampe en cours.
      outDeck.volume = (1 - t) * volumeRef.current;
      inDeck.volume = t * volumeRef.current;

      if (t >= 1) {
        clearCrossfadeTimer();
        outDeck.pause();
        outDeck.volume = volumeRef.current;
        outDeck.setPlaybackRate(1, 'high'); // on remet la vitesse normale pour la prochaine fois
        crossfadingRef.current = false;
        crossfadeTriggeredForRef.current = null;
        setActiveTrack(next);
        setFrontKey(inKey);
        frontKeyRef.current = inKey;
      }
    }, CROSSFADE_TICK_MS);
  }

  // appele a chaque update de statut d'un deck. on ignore ce qui vient du deck non-front,
  // et ce qui arrive pendant un fondu deja en cours (il se termine tout seul). deux cas
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

  // listener natif plutot qu'un useEffect sur status.didJustFinish: react ne redeclenche
  // un effect que si la valeur change entre deux renders, donc un evenement pourrait se
  // perdre. le listener, lui, recoit chaque update une fois, sans dependre du render cycle.
  useEffect(() => {
    const subA = deckA.addListener('playbackStatusUpdate', (s) => handleStatusUpdate('A', s));
    const subB = deckB.addListener('playbackStatusUpdate', (s) => handleStatusUpdate('B', s));
    return () => {
      subA.remove();
      subB.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckA, deckB]);

  // computed at each render for the next and previous buttons
  const queue = queueRef.current;
  const activeIndex = queue?.findIndex((t) => t.id === activeTrack?.id) ?? -1;
  const hasNext = !!queue && activeIndex >= 0 && activeIndex < queue.length - 1;
  const hasPrevious = !!queue && activeIndex > 0;
  const frontStatus = frontKey === 'A' ? statusA : statusB;

  // same track = play pause sinon start the new track with its queue
  function toggle(track: PreviewTrack, newQueue?: PreviewTrack[]) {
    if (activeTrack?.id === track.id) {
      frontStatus.playing ? getDeck(frontKey).pause() : getDeck(frontKey).play();
      return;
    }
    abortCrossfade(frontKey);
    queueRef.current = newQueue ?? null;
    playAt(track, frontKey);
  }

  // skip manuel = coupe toujours net, meme transitions activees. le fondu c'est pour un
  // enchainement naturel, pas pour un clic ou l'utilisateur veut changer tout de suite.
  function next() {
    if (!hasNext || !queue) return;
    abortCrossfade(frontKey);
    playAt(queue[activeIndex + 1], frontKey);
  }

  // go back one track (hard cut too)
  function previous() {
    if (!hasPrevious || !queue) return;
    abortCrossfade(frontKey);
    playAt(queue[activeIndex - 1], frontKey);
  }

  // stop everything and hide the mini player
  function stop() {
    abortCrossfade(frontKey);
    queueRef.current = null;
    getDeck(frontKey).pause();
    setActiveTrack(null);
  }

  // on declare au backend ce qu'on ecoute, pour que nos amis le voient sur l'ecran
  // amis. une pause compte comme "plus rien en cours" : c'est ce que l'ecran affiche.
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
        volume,
        setVolume,
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

// hook to use the player (crash if outside the provider)
export function usePreviewPlayer() {
  const ctx = useContext(PreviewPlayerContext);
  if (!ctx) throw new Error('usePreviewPlayer must be used inside PreviewPlayerProvider');
  return ctx;
}
