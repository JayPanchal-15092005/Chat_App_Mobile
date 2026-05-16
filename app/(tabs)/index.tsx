import ChatItem from "@/components/ChatItem";
import EmptyUI from "@/components/EmptyUI";
import { Colors } from "@/constants/Colors";
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
  const { data: chats, isLoading, error, refetch } = useChats();

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size={"large"} color={Colors.primary.default} />
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
            iconColor={Colors.subtleForeground}
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
            color={Colors.surface.dark}
          />
        </Pressable>
      </View>
    </View>
  );
}

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  // Shared center container for Loading and Error states
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.surface.default,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#EF4444", // Tailwind red-500
    fontSize: 30, // Tailwind 3xl
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary.default,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.foreground,
  },
  // Main container
  container: {
    flex: 1,
    backgroundColor: Colors.surface.default,
  },
  flatListContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  // Header styles
  headerContainer: {
    paddingHorizontal: 20, // Replaces "px-5"
    paddingTop: 8, // Replaces "pt-2"
    paddingBottom: 16, // Replaces "pb-4"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 24, // Replaces "text-2xl"
    fontWeight: "bold",
    color: Colors.foreground,
  },
  newChatButton: {
    width: 40, // Replaces "size-10"
    height: 40, // Replaces "size-10"
    backgroundColor: Colors.primary.default,
    borderRadius: 20, // rounded-full (half of width/height)
    alignItems: "center",
    justifyContent: "center",
  },
});
