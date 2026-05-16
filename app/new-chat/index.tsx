import UserItem from "@/components/UserItem";
import { Colors } from "@/constants/Colors";
import { useGetOrCreateChat } from "@/hooks/useChats";
import { useUsers } from "@/hooks/useUsers";
import { useSocketStore } from "@/lib/socket";
import { User } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const NewChatScreen = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allUsers, isLoading } = useUsers();
  const { mutate: getOrCreateChat, isPending: isCreatingChat } =
    useGetOrCreateChat();
  const { onlineUsers } = useSocketStore();

  // client-side filtering
  const users = allUsers?.filter((u: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    );
  });

  const handleUserSelect = (user: User) => {
    getOrCreateChat(user._id, {
      onSuccess: (chat) => {
        router.dismiss(); // go -1

        setTimeout(() => {
          router.push({
            pathname: "/chat/[id]",
            params: {
              id: chat._id,
              participantId: chat.participant._id,
              name: chat.participant.name,
              avatar: chat.participant.avatar,
            },
          });
        }, 100);
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={20} color={Colors.primary.default} />
            </Pressable>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>New chat</Text>
              <Text style={styles.headerSubtitle}>
                Search for a user to start chatting
              </Text>
            </View>
          </View>

          {/* SEARCH BAR */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Ionicons
                name="search"
                size={18}
                color={Colors.subtleForeground}
              />
              <TextInput
                placeholder="Search users"
                placeholderTextColor={Colors.subtleForeground}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* USERS LIST */}
          <View style={styles.listContainer}>
            {isCreatingChat || isLoading ? (
              <View style={styles.centerState}>
                <ActivityIndicator
                  size="large"
                  color={Colors.primary.default}
                />
              </View>
            ) : !users || users.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons
                  name="person-outline"
                  size={64}
                  color={Colors.subtleForeground}
                />
                <Text style={styles.emptyStateTitle}>No users found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Try a different search term
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                <Text style={styles.listHeader}>USERS</Text>
                {users.map((user: any) => (
                  <UserItem
                    key={user._id}
                    user={user}
                    isOnline={onlineUsers.has(user._id)}
                    onPress={() => handleUserSelect(user)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000", // Replaces "bg-black"
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)", // Replaces "bg-black/40"
    justifyContent: "flex-end", // Replaces "justify-end"
  },
  modalContainer: {
    backgroundColor: Colors.surface.default,
    borderTopLeftRadius: 24, // Replaces "rounded-t-3xl"
    borderTopRightRadius: 24,
    height: "95%", // Replaces "h-[95%]"
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 20, // Replaces "px-5"
    paddingTop: 12, // Replaces "pt-3"
    paddingBottom: 12, // Replaces "pb-3"
    backgroundColor: Colors.surface.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface.light, // Replaces "border-surface-light"
    flexDirection: "row",
    alignItems: "center",
  },
  closeButton: {
    width: 36, // Replaces "w-9"
    height: 36, // Replaces "h-9"
    borderRadius: 18, // Replaces "rounded-full"
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8, // Replaces "mr-2"
    backgroundColor: Colors.surface.card,
  },
  closeButtonPressed: {
    opacity: 0.7, // Added active press state
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.foreground,
    fontSize: 20, // Replaces "text-xl"
    fontWeight: "600", // Replaces "font-semibold"
  },
  headerSubtitle: {
    color: Colors.mutedForeground,
    fontSize: 12, // Replaces "text-xs"
    marginTop: 2, // Replaces "mt-0.5"
  },
  searchContainer: {
    paddingHorizontal: 20, // Replaces "px-5"
    paddingTop: 12, // Replaces "pt-3"
    paddingBottom: 8, // Replaces "pb-2"
    backgroundColor: Colors.surface.default,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface.card,
    borderRadius: 999, // Replaces "rounded-full"
    paddingHorizontal: 12, // Replaces "px-3"
    paddingVertical: 6, // Replaces "py-1.5"
    gap: 8, // Replaces "gap-2"
    borderWidth: 1,
    borderColor: Colors.surface.light,
  },
  searchInput: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 14, // Replaces "text-sm"
  },
  listContainer: {
    flex: 1,
    backgroundColor: Colors.surface.default,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20, // Replaces "px-5"
  },
  emptyStateTitle: {
    color: Colors.mutedForeground,
    fontSize: 18, // Replaces "text-lg"
    marginTop: 16, // Replaces "mt-4"
  },
  emptyStateSubtitle: {
    color: Colors.subtleForeground,
    fontSize: 14, // Replaces "text-sm"
    marginTop: 4, // Replaces "mt-1"
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20, // Replaces "px-5"
    paddingTop: 16, // Replaces "pt-4"
  },
  scrollContent: {
    paddingBottom: 24,
  },
  listHeader: {
    color: Colors.mutedForeground,
    fontSize: 12, // Replaces "text-xs"
    marginBottom: 12, // Replaces "mb-3"
  },
});

export default NewChatScreen;
