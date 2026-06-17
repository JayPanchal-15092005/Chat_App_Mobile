import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useTheme } from "@/hooks/useTheme";
import { useApi } from "@/lib/axios";
import { useCurrentUser } from "@/hooks/useAuth";

interface CallRecord {
  _id: string;
  caller: { _id: string; name: string; avatar: string };
  receiver: { _id: string; name: string; avatar: string };
  type: "audio" | "video";
  status: "missed" | "rejected" | "answered" | "ongoing";
  startTime?: string;
  endTime?: string;
  duration: number;
  createdAt: string;
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const getCallIcon = (
  status: CallRecord["status"],
  isOutgoing: boolean,
): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (status) {
    case "missed":
      return { name: "call", color: "#FF3B30" };
    case "rejected":
      return { name: "close-circle", color: "#FF3B30" };
    case "answered":
    case "ongoing":
      return isOutgoing
        ? { name: "arrow-up", color: "#007AFF" }
        : { name: "arrow-down", color: "#34C759" };
    default:
      return { name: "call", color: "#8E8E93" };
  }
};

const CallsTab = () => {
  const { colors } = useTheme();
  const { apiWithAuth } = useApi();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const {
    data: calls,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<CallRecord[]>({
    queryKey: ["callHistory"],
    queryFn: async () => {
      const { data } = await apiWithAuth<{ calls: CallRecord[], pagination: any }>({
        method: "GET",
        url: "/calls",
      });
      return data.calls;
    },
  });

  const styles = makeStyles(colors);

  const renderCallItem = useCallback(
    ({ item }: { item: CallRecord }) => {
      const isOutgoing = currentUser?._id === item.caller._id;
      const otherUser = isOutgoing ? item.receiver : item.caller;
      const icon = getCallIcon(item.status, isOutgoing);

      return (
        <View style={styles.callItem}>
          <View style={styles.avatarContainer}>
            {otherUser.avatar ? (
              <Image
                source={{ uri: otherUser.avatar }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons
                  name="person"
                  size={24}
                  color={colors.subtleForeground}
                />
              </View>
            )}
          </View>

          <View style={styles.callInfo}>
            <Text style={styles.callName} numberOfLines={1}>
              {otherUser.name}
            </Text>
            <View style={styles.callMeta}>
              <Ionicons name={icon.name} size={14} color={icon.color} />
              <Text style={styles.callStatus}>
                {isOutgoing ? "Outgoing" : "Incoming"} •{" "}
                {item.type === "video" ? "Video" : "Audio"}
              </Text>
            </View>
          </View>

          <View style={styles.callRight}>
            <Text style={styles.callTime}>
              {formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
              })}
            </Text>
            {item.status === "answered" && item.duration > 0 && (
              <Text style={styles.callDuration}>
                {formatDuration(item.duration)}
              </Text>
            )}
          </View>
        </View>
      );
    },
    [currentUser, colors, styles],
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary.default} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load calls</Text>
        <Pressable onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <FlatList
          data={calls}
          keyExtractor={(item) => item._id}
          renderItem={renderCallItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.flatListContent}
          ListHeaderComponent={<Header />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="call-outline"
                size={64}
                color={colors.subtleForeground}
              />
              <Text style={styles.emptyTitle}>No calls yet</Text>
              <Text style={styles.emptySubtitle}>
                Your call history will appear here
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary.default}
              colors={[colors.primary.default]}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
};

export default CallsTab;

function Header() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>Calls</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.surface.default,
    },
    container: {
      flex: 1,
      backgroundColor: colors.surface.default,
    },
    centerContainer: {
      flex: 1,
      backgroundColor: colors.surface.default,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: {
      color: "#EF4444",
      fontSize: 16,
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary.default,
      borderRadius: 8,
    },
    retryText: {
      color: colors.foreground,
    },
    flatListContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.foreground,
    },
    callItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
    },
    avatarContainer: {
      marginRight: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface.light,
      justifyContent: "center",
      alignItems: "center",
    },
    callInfo: {
      flex: 1,
    },
    callName: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 4,
    },
    callMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    callStatus: {
      color: colors.mutedForeground,
      fontSize: 13,
    },
    callRight: {
      alignItems: "flex-end",
    },
    callTime: {
      color: colors.mutedForeground,
      fontSize: 12,
      marginBottom: 2,
    },
    callDuration: {
      color: colors.subtleForeground,
      fontSize: 12,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 120,
    },
    emptyTitle: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: "600",
      marginTop: 16,
    },
    emptySubtitle: {
      color: colors.mutedForeground,
      fontSize: 14,
      marginTop: 8,
    },
  });
