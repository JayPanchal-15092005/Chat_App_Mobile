import { useTheme } from "@/hooks/useTheme";
import { useSocketStore } from "@/lib/socket";
import { Chat } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ChatItem = ({ chat, onPress }: { chat: Chat; onPress: () => void }) => {
  const participant = chat.participant;
  const { colors } = useTheme();

  const { onlineUsers, typingUsers, unreadChats } = useSocketStore();

  const isOnline = onlineUsers.has(participant._id);
  const isTyping = typingUsers.get(chat._id) === participant._id;
  const hasUnread = unreadChats.has(chat._id);

  const styles = makeStyles(colors);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
    >
      {/* avatar & online indicator */}
      <View style={styles.avatarWrapper}>
        <Image source={participant.avatar} style={styles.avatarImage} />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>

      {/* chat info */}
      <View style={styles.chatInfo}>
        <View style={styles.topRow}>
          <Text
            style={[
              styles.nameText,
              hasUnread ? styles.textPrimary : styles.textForeground,
            ]}
          >
            {participant.name}
          </Text>

          <View style={styles.timeWrapper}>
            {hasUnread && <View style={styles.unreadDot} />}
            <Text style={styles.timeText}>
              {chat.lastMessageAt
                ? formatDistanceToNow(new Date(chat.lastMessageAt), {
                    addSuffix: false,
                  })
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
    },
    containerPressed: {
      opacity: 0.7,
    },
    avatarWrapper: {},
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
      marginRight: 12,
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
