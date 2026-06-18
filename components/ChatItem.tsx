import { useTheme } from "@/hooks/useTheme";
import { useSocketStore } from "@/lib/socket";
import { Chat } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { getAvatarUrl } from "@/lib/utils";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ChatItem = ({
  chat,
  onPress,
  onLongPress,
}: {
  chat: Chat;
  onPress: () => void;
  onLongPress?: () => void;
}) => {
  const participant = chat.participant;
  const { colors } = useTheme();

  const { onlineUsers, typingUsers, unreadChats } = useSocketStore();

  const isOnline = onlineUsers.has(participant._id);
  const isTyping = typingUsers.get(chat._id) === participant._id;
  const hasUnread = unreadChats.has(chat._id);
  const isPinned = chat.isPinned ?? false;

  const styles = makeStyles(colors);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isPinned && styles.containerPinned,
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      {/* Pin indicator */}
      {isPinned && (
        <View style={styles.pinBadge}>
          <Ionicons name="pin" size={11} color={colors.primary.default} />
        </View>
      )}

      {/* Avatar & online indicator */}
      <View style={styles.avatarWrapper}>
        <Image source={getAvatarUrl(participant.name, participant.avatar)} style={styles.avatarImage} />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>

      {/* Chat info */}
      <View style={styles.chatInfo}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.nameText,
                hasUnread ? styles.textPrimary : styles.textForeground,
              ]}
              numberOfLines={1}
            >
              {participant.name}
            </Text>
          </View>

          <View style={styles.timeWrapper}>
            {hasUnread && <View style={styles.unreadDot} />}
            <Text style={styles.timeText}>
              {chat.lastMessageAt
                ? formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })
                : ""}
            </Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          {isTyping ? (
            <Text style={styles.typingText}>typing...</Text>
          ) : (
            <Text
              style={[
                styles.messageText,
                hasUnread ? styles.messageTextUnread : styles.messageTextRead,
              ]}
              numberOfLines={1}
            >
              {chat.lastMessage?.text || "No messages yet"}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 2,
      borderRadius: 12,
      position: "relative",
    },
    containerPinned: {
      backgroundColor: `${colors.primary.default}10`,
    },
    containerPressed: {
      opacity: 0.7,
    },
    pinBadge: {
      position: "absolute",
      top: 8,
      right: 4,
      zIndex: 1,
    },
    avatarWrapper: {
      position: "relative",
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    onlineIndicator: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 16,
      height: 16,
      backgroundColor: "#22C55E",
      borderRadius: 8,
      borderWidth: 3,
      borderColor: colors.surface.default,
    },
    chatInfo: {
      flex: 1,
      marginLeft: 16,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    nameRow: {
      flex: 1,
      marginRight: 8,
    },
    nameText: {
      fontSize: 16,
      fontWeight: "500",
    },
    textPrimary: {
      color: colors.primary.default,
    },
    textForeground: {
      color: colors.foreground,
    },
    timeWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    unreadDot: {
      width: 10,
      height: 10,
      backgroundColor: colors.primary.default,
      borderRadius: 5,
    },
    timeText: {
      fontSize: 12,
      color: colors.subtleForeground,
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    typingText: {
      fontSize: 14,
      color: colors.primary.default,
      fontStyle: "italic",
    },
    messageText: {
      fontSize: 14,
      flex: 1,
      marginRight: 24,
    },
    messageTextUnread: {
      color: colors.foreground,
      fontWeight: "500",
    },
    messageTextRead: {
      color: colors.subtleForeground,
    },
  });

export default ChatItem;
