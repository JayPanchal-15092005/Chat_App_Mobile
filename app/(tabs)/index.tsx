import ChatItem from "@/components/ChatItem";
import EmptyUI from "@/components/EmptyUI";
import { useTheme } from "@/hooks/useTheme";
import { useChats } from "@/hooks/useChats";
import { useApi } from "@/lib/axios";
import { Chat } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { getAvatarUrl } from "@/lib/utils";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ChatsTab = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: chats, isLoading, error, refetch } = useChats();
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  const styles = makeStyles(colors);

  // Sort: pinned chats first, then by lastMessageAt descending
  const sortedChats = chats
    ? [...chats].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      })
    : [];

  const handleChatPress = (chat: Chat) => {
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: chat._id,
        participantId: chat.participant._id,
        name: chat.participant.name,
        avatar: getAvatarUrl(chat.participant.name, chat.participant.avatar),
      },
    });
  };

  const handleTogglePin = useCallback(
    async (chat: Chat) => {
      try {
        await apiWithAuth({
          method: "PATCH",
          url: `/chats/${chat._id}/pin`,
        });

        // Optimistically update cache
        queryClient.setQueryData<Chat[]>(["chats"], (old) =>
          old?.map((c) =>
            c._id === chat._id ? { ...c, isPinned: !c.isPinned } : c
          )
        );
      } catch (e) {
        Alert.alert("Error", "Failed to update pin status.");
      }
    },
    [apiWithAuth, queryClient]
  );

  const handleChatLongPress = useCallback(
    (chat: Chat) => {
      const pinLabel = chat.isPinned ? "Unpin Chat" : "Pin Chat";

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [pinLabel, "Cancel"],
            cancelButtonIndex: 1,
          },
          (buttonIndex) => {
            if (buttonIndex === 0) handleTogglePin(chat);
          }
        );
      } else {
        Alert.alert(
          chat.participant.name,
          undefined,
          [
            { text: pinLabel, onPress: () => handleTogglePin(chat) },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    },
    [handleTogglePin]
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary.default} />
        <Text style={styles.loadingText}>Connecting to server{"\n"}(this may take a moment…)</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load chats</Text>
        <Text style={styles.errorSubText}>Check your internet connection and try again.</Text>
        <Pressable onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedChats}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ChatItem
            chat={item}
            onPress={() => handleChatPress(item)}
            onLongPress={() => handleChatLongPress(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.flatListContent}
        ListHeaderComponent={<Header />}
        ListEmptyComponent={
          <EmptyUI
            title="No chats yet"
            subtitle="Start a conversation!"
            iconName="chatbubbles-outline"
            iconColor={colors.subtleForeground}
            iconSize={64}
            buttonLabel="New Chat"
            onPressButton={() => router.push("/new-chat")}
          />
        }
      />
    </View>
  );
};

export default ChatsTab;

function Header() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Chats</Text>
        <Pressable
          style={styles.newChatButton}
          onPress={() => router.push("/new-chat")}
        >
          <Ionicons name="create-outline" size={20} color={colors.surface.dark} />
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    centerContainer: {
      flex: 1,
      backgroundColor: colors.surface.default,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    loadingText: {
      color: colors.mutedForeground,
      fontSize: 14,
      marginTop: 12,
      textAlign: "center",
      lineHeight: 22,
    },
    errorText: {
      color: "#EF4444",
      fontSize: 16,
      fontWeight: "600",
    },
    errorSubText: {
      color: colors.mutedForeground,
      fontSize: 13,
      textAlign: "center",
      marginHorizontal: 24,
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
    container: {
      flex: 1,
      backgroundColor: colors.surface.default,
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.foreground,
    },
    newChatButton: {
      width: 40,
      height: 40,
      backgroundColor: colors.primary.default,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
  });
