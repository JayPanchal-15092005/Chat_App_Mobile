import UserItem from "@/components/UserItem";
import { useTheme } from "@/hooks/useTheme";
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

  const { colors } = useTheme();
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

  const styles = makeStyles(colors);

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
              <Ionicons name="close" size={20} color={colors.primary.default} />
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
                color={colors.subtleForeground}
              />
              <TextInput
                placeholder="Search users"
                placeholderTextColor={colors.subtleForeground}
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
                  color={colors.primary.default}
                />
              </View>
            ) : !users || users.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons
                  name="person-outline"
                  size={64}
                  color={colors.subtleForeground}
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

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: "#000000",
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: colors.surface.default,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: "95%",
      overflow: "hidden",
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.surface.default,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
      flexDirection: "row",
      alignItems: "center",
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
      backgroundColor: colors.surface.card,
    },
    closeButtonPressed: {
      opacity: 0.7,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerTitle: {
      color: colors.foreground,
      fontSize: 20,
      fontWeight: "600",
    },
    headerSubtitle: {
      color: colors.mutedForeground,
      fontSize: 12,
      marginTop: 2,
    },
    searchContainer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: colors.surface.default,
    },
    searchInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface.card,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.surface.light,
    },
    searchInput: {
      flex: 1,
      color: colors.foreground,
      fontSize: 14,
    },
    listContainer: {
      flex: 1,
      backgroundColor: colors.surface.default,
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
      paddingHorizontal: 20,
    },
    emptyStateTitle: {
      color: colors.mutedForeground,
      fontSize: 18,
      marginTop: 16,
    },
    emptyStateSubtitle: {
      color: colors.subtleForeground,
      fontSize: 14,
      marginTop: 4,
      textAlign: "center",
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    listHeader: {
      color: colors.mutedForeground,
      fontSize: 12,
      marginBottom: 12,
    },
  });

export default NewChatScreen;
