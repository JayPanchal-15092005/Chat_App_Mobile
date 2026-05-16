import { Colors } from "@/constants/Colors";
import { useSocketStore } from "@/lib/socket";
import { Chat } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ChatItem = ({ chat, onPress }: { chat: Chat; onPress: () => void }) => {
  const participant = chat.participant;

  const { onlineUsers, typingUsers, unreadChats } = useSocketStore();

  const isOnline = onlineUsers.has(participant._id);
  const isTyping = typingUsers.get(chat._id) === participant._id;
  const hasUnread = unreadChats.has(chat._id);

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

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12, // Replaces "py-3"
  },
  containerPressed: {
    opacity: 0.7, // Replaces "active:opacity-70"
  },
  avatarWrapper: {
    // position: "relative" is default in React Native
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28, // Replaces "borderRadius: 999" (half of width/height for a perfect circle)
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16, // Replaces "size-4"
    height: 16, // Replaces "size-4"
    backgroundColor: "#22C55E", // Tailwind green-500
    borderRadius: 8, // rounded-full
    borderWidth: 3, // border-[3px]
    borderColor: Colors.surface.default, // border-surface
  },
  chatInfo: {
    flex: 1,
    marginLeft: 16, // Replaces "ml-4"
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameText: {
    fontSize: 16, // Replaces "text-base"
    fontWeight: "500", // Replaces "font-medium"
  },
  textPrimary: {
    color: Colors.primary.default,
  },
  textForeground: {
    color: Colors.foreground,
  },
  timeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8, // Replaces "gap-2"
  },
  unreadDot: {
    width: 10, // Replaces "w-2.5"
    height: 10, // Replaces "h-2.5"
    backgroundColor: Colors.primary.default,
    borderRadius: 5, // rounded-full
  },
  timeText: {
    fontSize: 12, // Replaces "text-xs"
    color: Colors.subtleForeground,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4, // Replaces "mt-1"
  },
  typingText: {
    fontSize: 14, // Replaces "text-sm"
    color: Colors.primary.default,
    fontStyle: "italic", // Replaces "italic"
  },
  messageText: {
    fontSize: 14, // Replaces "text-sm"
    flex: 1, // Replaces "flex-1"
    marginRight: 12, // Replaces "mr-3"
  },
  messageTextUnread: {
    color: Colors.foreground,
    fontWeight: "500", // Replaces "font-medium"
  },
  messageTextRead: {
    color: Colors.subtleForeground,
    // normal weight is default
  },
});

export default ChatItem;
