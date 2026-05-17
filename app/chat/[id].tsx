import EmptyUI from "@/components/EmptyUI";
import MessageBubble from "@/components/MessageBubble";
import { Colors } from "@/constants/Colors";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useSocketStore } from "@/lib/socket";
import { MessageSender } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
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

type ChatParams = {
  id: string;
  participantId: string;
  name: string;
  avatar: string;
};

const ChatDetailScreen = () => {
  const {
    id: chatId,
    avatar,
    name,
    participantId,
  } = useLocalSearchParams<ChatParams>();

  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const { data: currentUser } = useCurrentUser();
  const { data: messages, isLoading } = useMessages(chatId);

  const {
    joinChat,
    leaveChat,
    sendMessage,
    sendTyping,
    isConnected,
    onlineUsers,
    typingUsers,
  } = useSocketStore();

  const isOnline = participantId ? onlineUsers.has(participantId) : false;
  const isTyping = typingUsers.get(chatId) === participantId;

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // join chat room on mount, leave on unmount
  useEffect(() => {
    if (chatId && isConnected) joinChat(chatId);

    return () => {
      if (chatId) leaveChat(chatId);
    };
  }, [chatId, isConnected, joinChat, leaveChat]);

  // scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleTyping = useCallback(
    (text: string) => {
      setMessageText(text);

      if (!isConnected || !chatId) return;

      // send typing start
      if (text.length > 0) {
        sendTyping(chatId, true);

        // clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // stop typing after 2 seconds of no input
        typingTimeoutRef.current = setTimeout(() => {
          sendTyping(chatId, false);
        }, 2000);
      } else {
        // text cleared, stop typing
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        sendTyping(chatId, false);
      }
    },
    [chatId, isConnected, sendTyping],
  );

  const handleSend = () => {
    console.log({ isSending, isConnected, currentUser, messageText });
    if (!messageText.trim() || isSending || !isConnected || !currentUser)
      return;

    // stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTyping(chatId, false);

    setIsSending(true);
    sendMessage(chatId, messageText.trim(), {
      _id: currentUser._id,
      name: currentUser.name,
      email: currentUser.email,
      avatar: currentUser.avatar,
    });
    setMessageText("");
    setIsSending(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => pressed && styles.pressedState}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors.primary.default}
          />
        </Pressable>

        <View style={styles.headerInfo}>
          {avatar && <Image source={avatar} style={styles.headerAvatar} />}
          <View style={styles.headerTextWrapper}>
            <Text style={styles.headerName} numberOfLines={1}>
              {name}
            </Text>
            <Text
              style={[
                styles.headerStatus,
                isTyping ? styles.textPrimary : styles.textMuted,
              ]}
            >
              {isTyping ? "typing..." : isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressedState,
            ]}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color={Colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressedState,
            ]}
          >
            <Ionicons
              name="videocam-outline"
              size={20}
              color={Colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>

      {/* Message + Keyboard input */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.mainContainer}>
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={Colors.primary.default} />
            </View>
          ) : !messages || messages.length === 0 ? (
            <EmptyUI
              title="No messages yet"
              subtitle="Start the conversation!"
              iconName="chatbubbles-outline"
              iconColor={Colors.subtleForeground}
              iconSize={64}
            />
          ) : (
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContent}
              onContentSizeChange={() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
              }}
            >
              {messages.map((message) => {
                const senderId = (message.sender as MessageSender)._id;
                const isFromMe = currentUser
                  ? senderId === currentUser._id
                  : false;

                return (
                  <MessageBubble
                    key={message._id}
                    message={message}
                    isFromMe={isFromMe}
                  />
                );
              })}
            </ScrollView>
          )}

          {/* Input bar */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressedState,
                ]}
              >
                <Ionicons name="add" size={22} color={Colors.primary.default} />
              </Pressable>

              <TextInput
                placeholder="Type a message"
                placeholderTextColor={Colors.subtleForeground}
                style={styles.textInput}
                multiline
                value={messageText}
                onChangeText={handleTyping}
                onSubmitEditing={handleSend}
                editable={!isSending}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  (!messageText.trim() || isSending) &&
                    styles.sendButtonDisabled,
                  pressed && styles.pressedState,
                ]}
                onPress={handleSend}
                disabled={!messageText.trim() || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={Colors.surface.dark} />
                ) : (
                  <Ionicons name="send" size={18} color={Colors.surface.dark} />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface.default,
  },
  pressedState: {
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface.default,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface.light,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTextWrapper: {
    marginLeft: 12, // Replaces "ml-3"
  },
  headerName: {
    color: Colors.foreground,
    fontWeight: "600",
    fontSize: 16, // Replaces "text-base"
  },
  headerStatus: {
    fontSize: 12, // Replaces "text-xs"
  },
  textPrimary: {
    color: Colors.primary.default,
  },
  textMuted: {
    color: Colors.mutedForeground,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12, // Replaces "gap-3" (3 * 4 = 12px)
  },
  actionButton: {
    width: 36, // Replaces "w-9"
    height: 36, // Replaces "h-9"
    borderRadius: 18, // Replaces "rounded-full"
    alignItems: "center",
    justifyContent: "center",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.surface.default,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8, // Adds spacing between message bubbles natively
  },
  inputContainer: {
    paddingHorizontal: 12, // Replaces "px-3"
    paddingBottom: 12, // Replaces "pb-3"
    paddingTop: 8, // Replaces "pt-2"
    backgroundColor: Colors.surface.default,
    borderTopWidth: 1,
    borderTopColor: Colors.surface.light,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end", // Aligns icons to the bottom when text area expands
    backgroundColor: Colors.surface.card,
    borderRadius: 24, // Replaces "rounded-3xl"
    paddingHorizontal: 12, // Replaces "px-3"
    paddingVertical: 6, // Replaces "py-1.5"
    gap: 8, // Replaces "gap-2"
  },
  addButton: {
    width: 32, // Replaces "w-8"
    height: 32, // Replaces "h-8"
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 14, // Replaces "text-sm"
    marginBottom: 8, // Replaces "mb-2" to align with the icons at the bottom
    maxHeight: 100, // Matches inline style
  },
  sendButton: {
    width: 32, // Replaces "w-8"
    height: 32, // Replaces "h-8"
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary.default,
  },
  sendButtonDisabled: {
    opacity: 0.4, // Visually dims the send button when input is empty
  },
});

export default ChatDetailScreen;
