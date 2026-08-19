import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "../config/theme";
import { usePreviewPlayer } from "../context/PreviewPlayerContext";

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

  if (!activeTrack) return null;

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <View style={styles.bar}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.art}>
        {activeTrack.cover ? (
          <Image source={{ uri: activeTrack.cover }} style={styles.artImg} />
        ) : (
          <Ionicons
            name="musical-note"
            size={18}
            color={colors.textSecondary}
          />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {activeTrack.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {activeTrack.artist}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setTransitionsEnabled(!transitionsEnabled)}
        style={styles.ctrl}
      >
        <MaterialCommunityIcons
          name="transition"
          size={20}
          color={transitionsEnabled ? colors.accent : colors.textSecondary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={previous}
        disabled={!hasPrevious}
        style={styles.ctrl}
      >
        <Ionicons
          name="play-skip-back"
          size={20}
          color={hasPrevious ? colors.textPrimary : colors.surface}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => toggle(activeTrack)} style={styles.ctrl}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={22}
          color={colors.textPrimary}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={next} disabled={!hasNext} style={styles.ctrl}>
        <Ionicons
          name="play-skip-forward"
          size={20}
          color={hasNext ? colors.textPrimary : colors.surface}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={stop} style={styles.ctrl}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  progressTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.surface,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  art: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  artImg: { width: "100%", height: "100%" },
  info: { flex: 1, marginRight: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  artist: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  ctrl: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
});
