import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Image, useWindowDimensions } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../config/theme";
import { usePreviewPlayer } from "../context/PreviewPlayerContext";
import { MINI_PLAYER_HEIGHT } from "./Screen";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function IconButton({
  onPress,
  disabled,
  label,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.ctrl,
        hovered && !disabled && styles.ctrlHover,
        pressed && !disabled && { opacity: 0.7 },
        { cursor: disabled ? "auto" : "pointer" },
      ]}
    >
      {children}
    </Pressable>
  );
}

export default function MiniPlayer() {
  const {
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    hasNext,
    hasPrevious,
    transitionsEnabled,
    setTransitionsEnabled,
    toggle,
    next,
    previous,
    stop,
  } = usePreviewPlayer();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (!activeTrack) return null;

  // sur téléphone la place manque : le temps passe à la trappe avant le titre
  const showTime = width >= 480;

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    // paddingBottom : sur iPhone la barre passerait sous l'indicateur d'accueil sinon
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.row}>
        <View style={styles.art}>
          {activeTrack.cover ? (
            <Image source={{ uri: activeTrack.cover }} style={styles.artImg} />
          ) : (
            <Ionicons name="musical-note" size={18} color={colors.textSecondary} />
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{activeTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{activeTrack.artist}</Text>
        </View>

        {showTime && (
          <Text style={styles.time}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        )}

        <IconButton onPress={() => setTransitionsEnabled(!transitionsEnabled)} label="Toggle transitions">
          {/* Ionicons et pas MaterialCommunityIcons : cette seule icône faisait
              télécharger 1,3 Mo de police alors qu'Ionicons est déjà chargé */}
          <Ionicons
            name="swap-horizontal"
            size={20}
            color={transitionsEnabled ? colors.accent : colors.textSecondary}
          />
        </IconButton>
        <IconButton onPress={previous} disabled={!hasPrevious} label="Previous track">
          <Ionicons name="play-skip-back" size={20} color={hasPrevious ? colors.textPrimary : colors.textTertiary} />
        </IconButton>

        <IconButton onPress={() => toggle(activeTrack)} label={isPlaying ? "Pause" : "Play"}>
          <View style={styles.playBtn}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={18} color={colors.onAccent} />
          </View>
        </IconButton>

        <IconButton onPress={next} disabled={!hasNext} label="Next track">
          <Ionicons name="play-skip-forward" size={20} color={hasNext ? colors.textPrimary : colors.textTertiary} />
        </IconButton>
        <IconButton onPress={stop} label="Close player">
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </IconButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    boxShadow: "0 -4px 12px rgba(0,0,0,0.35)",
  },
  row: {
    height: MINI_PLAYER_HEIGHT - 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.surface,
    zIndex: 1,
  },
  progressFill: { height: "100%", backgroundColor: colors.accent },
  art: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  artImg: { width: "100%", height: "100%" },
  info: { flex: 1, marginRight: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  artist: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  time: {
    color: colors.textSecondary,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    marginRight: spacing.sm,
  },
  ctrl: { padding: spacing.xs, borderRadius: radius.pill },
  ctrlHover: { backgroundColor: "rgba(255,255,255,0.08)" },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
