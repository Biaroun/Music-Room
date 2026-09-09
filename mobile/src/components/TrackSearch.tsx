import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Image, ActivityIndicator } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from "../config/theme";
import { useDeezerSearch } from "../lib/useDeezerSearch";
import type { DeezerTrack } from "../lib/deezerTypes";
import { useToast } from "./Toast";
import { usePreviewPlayer, type PreviewTrack } from "../context/PreviewPlayerContext";
import PressableCard from "./PressableCard";

type TrackSearchProps = {
  onSelect?: (track: DeezerTrack) => void;
  placeholder?: string;
};

function toPreviewTrack(t: DeezerTrack): PreviewTrack {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    artistId: t.artistId,
    cover: t.cover,
    previewUrl: t.previewUrl!,
    bpm: t.bpm,
  };
}

export default function TrackSearch({
  onSelect,
  placeholder = "Search a track…",
}: TrackSearchProps) {
  const { showToast } = useToast();
  const { activeTrack, isPlaying, toggle } = usePreviewPlayer();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { results, loading, error } = useDeezerSearch(query);

  useEffect(() => {
    if (error) showToast({ type: "error", message: error });
  }, [error]);

  const playableQueue = results.filter((r) => r.previewUrl).map(toPreviewTrack);

  function pressRow(r: DeezerTrack) {
    if (onSelect) {
      // on ne vide pas la recherche : permet d'ajouter plusieurs sons du meme
      // resultat (ex: meme artiste) sans avoir a retaper la recherche.
      onSelect(r);
      return;
    }
    if (r.previewUrl) toggle(toPreviewTrack(r), playableQueue);
  }

  return (
    <View>
      <View style={[styles.searchRow, focused && styles.searchRowFocused]}>
        <Ionicons name="search" size={17} color={focused ? colors.accent : colors.textSecondary} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={colors.textSecondary} />}
        {!loading && query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8} style={{ cursor: "pointer" }} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {query.trim().length > 0 && (
        <View style={styles.results}>
          {results.map((r) => {
            const isCurrent = activeTrack?.id === r.id;
            return (
              <PressableCard
                key={r.id}
                style={[styles.row, isCurrent && styles.rowActive]}
                hoverStyle={styles.rowHover}
                onPress={() => pressRow(r)}
                accessibilityLabel={`${r.title} — ${r.artist}`}
              >
                <View style={styles.art}>
                  {r.cover ? (
                    <Image source={{ uri: r.cover }} style={styles.artImg} />
                  ) : (
                    <Text style={styles.artText}>{r.title[0]?.toUpperCase() ?? "?"}</Text>
                  )}
                </View>
                <View style={styles.info}>
                  <Text style={[styles.title, isCurrent && { color: colors.accent }]} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>{r.artist}</Text>
                </View>
                {r.previewUrl ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      toggle(toPreviewTrack(r), playableQueue);
                    }}
                    hitSlop={6}
                    style={styles.ctrl}
                    accessibilityLabel="Preview track"
                  >
                    <Ionicons name={isCurrent && isPlaying ? "pause" : "play"} size={16} color={colors.accent} />
                  </Pressable>
                ) : (
                  // deezer ne fournit pas toujours l'extrait de 30s
                  <Text style={styles.noPreview}>No preview</Text>
                )}
                {onSelect && <Ionicons name="add-circle" size={22} color={colors.accent} />}
              </PressableCard>
            );
          })}
          {!loading && !error && results.length === 0 && (
            <Text style={styles.empty}>No results for “{query.trim()}”</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchRowFocused: { borderColor: colors.accent },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    height: "100%",
    outlineWidth: 0,
  },

  results: { marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  rowHover: { backgroundColor: colors.surface },
  rowActive: { backgroundColor: colors.accentSoft },
  art: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
    overflow: "hidden",
  },
  artImg: { width: "100%", height: "100%" },
  artText: { color: colors.textSecondary, fontSize: 18, fontWeight: "800" },
  info: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  artist: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  ctrl: { paddingHorizontal: 6, paddingVertical: spacing.xs, cursor: "pointer" },
  noPreview: { color: colors.textTertiary, fontSize: 11, fontStyle: "italic" },
  empty: { color: colors.textSecondary, fontSize: 13, paddingVertical: spacing.md, textAlign: "center" },
});
