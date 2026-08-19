import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../config/theme";
import { useDeezerSearch } from "../lib/useDeezerSearch";
import type { DeezerTrack } from "../lib/deezerTypes";
import { useToast } from "./Toast";
import { usePreviewPlayer, type PreviewTrack } from "../context/PreviewPlayerContext";

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
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.textSecondary}
            style={styles.spinner}
          />
        )}
      </View>

      {query.trim().length > 0 && (
        <View>
          {results.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.row}
              onPress={() => pressRow(r)}
              activeOpacity={0.7}
            >
              <View style={styles.art}>
                {r.cover ? (
                  <Image source={{ uri: r.cover }} style={styles.artImg} />
                ) : (
                  <Text style={styles.artText}>
                    {r.title[0]?.toUpperCase() ?? "?"}
                  </Text>
                )}
              </View>
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {r.artist}
                </Text>
              </View>
              {r.previewUrl && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    toggle(toPreviewTrack(r), playableQueue);
                  }}
                  style={styles.ctrl}
                >
                  <Ionicons
                    name={
                      activeTrack?.id === r.id && isPlaying ? "pause" : "play"
                    }
                    size={16}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              )}
              {onSelect && (
                <Ionicons
                  name="add-circle-outline"
                  size={22}
                  color={colors.accent}
                />
              )}
            </TouchableOpacity>
          ))}
          {!loading && !error && results.length === 0 && (
            <Text style={styles.empty}>No results</Text>
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
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 6,
    padding: spacing.md,
    fontSize: 14,
  },
  spinner: { marginLeft: spacing.sm },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  art: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    overflow: "hidden",
  },
  artImg: { width: "100%", height: "100%" },
  artText: { color: colors.textSecondary, fontSize: 18, fontWeight: "800" },
  info: { flex: 1, marginRight: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  artist: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  ctrl: { paddingHorizontal: 6, paddingVertical: spacing.xs },
  empty: {
    color: colors.textSecondary,
    fontSize: 14,
    paddingVertical: spacing.md,
  },
});
