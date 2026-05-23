import ChatItem from "@/components/ChatItem";
import EmptyUI from "@/components/EmptyUI";
import { useTheme } from "@/hooks/useTheme";
import { useChats } from "@/hooks/useChats";
import { Chat } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ChatsTab = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: chats, isLoading, error, refetch } = useChats();

  const styles = makeStyles(colors);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size={"large"} color={colors.primary.default} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load chats</Text>
        <Pressable onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const handleChatPress = (chat: Chat) => {
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: chat._id,
        participantId: chat.participant._id,
        name: chat.participant.name,
        avatar: chat.participant.avatar,
      },
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ChatItem chat={item} onPress={() => handleChatPress(item)} />
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
          <Ionicons
            name="create-outline"
            size={20}
            color={colors.surface.dark}
          />
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
    },
    errorText: {
      color: "#EF4444",
      fontSize: 30,
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
