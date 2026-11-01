import UserItem from "@/components/UserItem";
import { useTheme } from "@/hooks/useTheme";
import { useGetOrCreateChat, useCreateGroupChat } from "@/hooks/useChats";
import { useUsers } from "@/hooks/useUsers";
import { useSocketStore } from "@/lib/socket";
import { User } from "@/types";
import { router } from "expo-router";
import { getAvatarUrl } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { colors } = useTheme();
  const { data: allUsers, isLoading } = useUsers();
  const { mutate: getOrCreateChat, isPending: isCreatingChat } = useGetOrCreateChat();
  const { mutate: createGroupChat, isPending: isCreatingGroup } = useCreateGroupChat();
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
    if (isGroupMode) {
      // Toggle selection
      setSelectedUserIds((prev) =>
        prev.includes(user._id)
          ? prev.filter((id) => id !== user._id)
          : [...prev, user._id]
      );
      return;
    }

    // 1-on-1 Chat selection
    getOrCreateChat(user._id, {
      onSuccess: (chat) => {
        router.dismiss();
        setTimeout(() => {
          router.push({
            pathname: "/chat/[id]",
            params: {
              id: chat._id,
              participantId: chat.participant?._id || user._id,
              name: chat.participant?.name || user.name,
              avatar: getAvatarUrl(
                chat.participant?.name || user.name,
                chat.participant?.avatar || user.avatar
              ),
              isGroup: "false",
            },
          });
        }, 100);
      },
    });
  };

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      Alert.alert("Group Name Required", "Please enter a subject or name for your new group.");
      return;
    }

    if (selectedUserIds.length < 1) {
      Alert.alert("Select Members", "Please select at least 1 person to add to the group.");
      return;
    }

    createGroupChat(
      {
        name: groupName.trim(),
        participantIds: selectedUserIds,
      },
      {
        onSuccess: (chat) => {
          router.dismiss();
          setTimeout(() => {
            router.push({
              pathname: "/chat/[id]",
              params: {
                id: chat._id,
                participantId: "",
                name: chat.groupName || groupName.trim(),
                avatar: chat.groupAvatar || getAvatarUrl(groupName.trim(), null),
                isGroup: "true",
              },
            });
          }, 100);
        },
        onError: (err: any) => {
          Alert.alert(
            "Error",
            err?.response?.data?.message || "Failed to create group. Please try again."
          );
        },
      }
    );
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalContainer}>
          {/* HEADER */}
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={() => {
                if (isGroupMode) {
                  setIsGroupMode(false);
                  setSelectedUserIds([]);
                  setGroupName("");
                } else {
                  router.back();
                }
              }}
            >
              <Ionicons
                name={isGroupMode ? "arrow-back" : "close"}
                size={20}
                color={colors.primary.default}
              />
            </Pressable>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {isGroupMode ? "New Group" : "New chat"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isGroupMode
                  ? `${selectedUserIds.length} of ${users?.length || 0} selected`
                  : "Search for a user or start a group"}
              </Text>
            </View>

            {isGroupMode && (
              <Pressable
                style={[
                  styles.createHeaderBtn,
                  (!groupName.trim() || selectedUserIds.length === 0 || isCreatingGroup) &&
                    styles.createHeaderBtnDisabled,
                ]}
                onPress={handleCreateGroup}
                disabled={!groupName.trim() || selectedUserIds.length === 0 || isCreatingGroup}
              >
                {isCreatingGroup ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.createHeaderBtnText}>Create</Text>
                )}
              </Pressable>
            )}
          </View>

          {/* GROUP NAME INPUT (when in group mode) */}
          {isGroupMode && (
            <View style={styles.groupInputSection}>
              <View style={styles.groupIconCircle}>
                <Ionicons name="people" size={24} color={colors.primary.default} />
              </View>
              <TextInput
                placeholder="Group subject / name..."
                placeholderTextColor={colors.subtleForeground}
                style={styles.groupNameInput}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={30}
                autoFocus
              />
            </View>
          )}

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
                {/* NEW GROUP ROW (Only visible in normal mode) */}
                {!isGroupMode && !searchQuery.trim() && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.newGroupRow,
                      pressed && styles.newGroupRowPressed,
                    ]}
                    onPress={() => setIsGroupMode(true)}
                  >
                    <View style={styles.newGroupIconWrapper}>
                      <Ionicons name="people" size={22} color="#000000" />
                    </View>
                    <View style={styles.newGroupTextWrapper}>
                      <Text style={styles.newGroupTitle}>New Group</Text>
                      <Text style={styles.newGroupSubtitle}>
                        Chat together with multiple friends
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.subtleForeground}
                    />
                  </Pressable>
                )}

                <Text style={styles.listHeader}>
                  {isGroupMode ? "SELECT PARTICIPANTS" : "DIRECT MESSAGES"}
                </Text>

                {users.map((user: any) => (
                  <UserItem
                    key={user._id}
                    user={user}
                    isOnline={onlineUsers.has(user._id)}
                    onPress={() => handleUserSelect(user)}
                    showSelection={isGroupMode}
                    isSelected={selectedUserIds.includes(user._id)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
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
      paddingTop: 14,
      paddingBottom: 14,
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
      marginRight: 10,
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
      fontSize: 19,
      fontWeight: "700",
    },
    headerSubtitle: {
      color: colors.mutedForeground,
      fontSize: 12,
      marginTop: 2,
    },
    createHeaderBtn: {
      backgroundColor: colors.primary.default,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    createHeaderBtnDisabled: {
      opacity: 0.4,
    },
    createHeaderBtnText: {
      color: "#000000",
      fontWeight: "700",
      fontSize: 13,
    },
    groupInputSection: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.surface.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
      gap: 12,
    },
    groupIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.primary.default}20`,
      alignItems: "center",
      justifyContent: "center",
    },
    groupNameInput: {
      flex: 1,
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "500",
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
      paddingVertical: 8,
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
      paddingTop: 12,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    newGroupRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      backgroundColor: colors.surface.card,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.surface.light,
    },
    newGroupRowPressed: {
      opacity: 0.7,
    },
    newGroupIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary.default,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    newGroupTextWrapper: {
      flex: 1,
    },
    newGroupTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    newGroupSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    listHeader: {
      color: colors.subtleForeground,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
  });

export default NewChatScreen;
