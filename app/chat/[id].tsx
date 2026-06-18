import EmptyUI from "@/components/EmptyUI";
import MessageBubble from "@/components/MessageBubble";
import ReplyPreview from "@/components/ReplyPreview";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useTheme } from "@/hooks/useTheme";
import { getAvatarUrl } from "@/lib/utils";
import { useCallStore } from "@/lib/callStore";
import { uploadToImageKit } from "@/lib/imagekit";
import { useSocketStore } from "@/lib/socket";
import { Message, MessageSender, ReplyToMessage } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
} from "expo-audio";
// Removed Firebase import
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Pending media (preview before send)
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    base64?: string;
  } | null>(null);
  const [pendingVoice, setPendingVoice] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Audio recorder via expo-audio (SDK 54)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const { colors } = useTheme();
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
    markDelivered,
    markSeen,
  } = useSocketStore();

  const startCall = useCallStore((state) => state.startCall);

  const isOnline = participantId ? onlineUsers.has(participantId) : false;
  const isTyping = typingUsers.get(chatId) === participantId;

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join chat room & mark delivered/seen on mount
  useEffect(() => {
    if (chatId && isConnected) {
      joinChat(chatId);
      markDelivered(chatId);
      markSeen(chatId);
    }
    return () => {
      if (chatId) leaveChat(chatId);
    };
  }, [chatId, isConnected, joinChat, leaveChat, markDelivered, markSeen]);

  // Mark seen when new messages arrive while chat is open
  useEffect(() => {
    if (messages && messages.length > 0 && isConnected) {
      markSeen(chatId);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, chatId, isConnected, markSeen]);

  const handleTyping = useCallback(
    (text: string) => {
      setMessageText(text);
      if (!isConnected || !chatId) return;

      if (text.length > 0) {
        sendTyping(chatId, true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(
          () => sendTyping(chatId, false),
          2000,
        );
      } else {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        sendTyping(chatId, false);
      }
    },
    [chatId, isConnected, sendTyping],
  );

  const handleSend = () => {
    if (!messageText.trim() || isSending || !isConnected || !currentUser)
      return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(chatId, false);

    setIsSending(true);
    sendMessage(
      chatId,
      messageText.trim(),
      {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        avatar: currentUser.avatar,
      },
      replyingTo?._id,
    );
    setMessageText("");
    setReplyingTo(null);
    setIsSending(false);

    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      100,
    );
  };

  const handlePickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        console.warn("Media library permission denied");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        // Show preview — don't upload yet
        setPendingImage({ uri: result.assets[0].uri });
      }
    } catch (err) {
      console.error("Image picker error:", err);
    }
  };

  const handleSendImage = async () => {
    if (!pendingImage || !currentUser) return;
    setIsUploadingMedia(true);
    try {
      const token = useAuthStore.getState().token;
      if (!token) throw new Error("No token");
      const url = await uploadToImageKit(pendingImage.uri, "image", token);
      sendMessage(
        chatId,
        "📸 Image",
        {
          _id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
        },
        replyingTo?._id,
        "image",
        url,
      );
      setReplyingTo(null);
      setPendingImage(null);
    } catch (err) {
      console.error("Image upload failed", err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const startRecording = async () => {
    try {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        console.warn("Microphone permission denied");
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri) {
        // Show preview — don't upload yet
        setPendingVoice(uri);
      }
    } catch (err) {
      console.error("Stop recording failed", err);
    }
  };

  const handleSendVoice = async () => {
    if (!pendingVoice || !currentUser) return;
    setIsUploadingMedia(true);
    try {
      const token = useAuthStore.getState().token;
      if (!token) throw new Error("No token");
      const url = await uploadToImageKit(pendingVoice, "voice", token);
      sendMessage(
        chatId,
        "🎤 Voice Message",
        {
          _id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
        },
        replyingTo?._id,
        "voice",
        url,
      );
      setReplyingTo(null);
      setPendingVoice(null);
    } catch (err) {
      console.error("Voice upload failed", err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
  }, []);

  const styles = makeStyles(colors);

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
            color={colors.primary.default}
          />
        </Pressable>

        <View style={styles.headerInfo}>
          {avatar && <Image source={getAvatarUrl(name, avatar)} style={styles.headerAvatar} />}
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
            onPress={() => startCall(participantId, name, getAvatarUrl(name, avatar) || "")}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressedState,
            ]}
          >
            <Ionicons
              name="call-outline"
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert(
                "Coming Soon",
                "Video calls will be available in the next update!",
              )
            }
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressedState,
            ]}
          >
            <Ionicons
              name="videocam-outline"
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>

      {/* Message list + Input */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.mainContainer}>
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary.default} />
            </View>
          ) : !messages || messages.length === 0 ? (
            <EmptyUI
              title="No messages yet"
              subtitle="Start the conversation!"
              iconName="chatbubbles-outline"
              iconColor={colors.subtleForeground}
              iconSize={64}
            />
          ) : (
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContent}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: false })
              }
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
                    chatId={chatId}
                    currentUserId={currentUser?._id ?? ""}
                    onReply={handleReply}
                  />
                );
              })}
            </ScrollView>
          )}

          {/* Reply preview */}
          {replyingTo && (
            <ReplyPreview
              replyTo={
                {
                  _id: replyingTo._id,
                  text: replyingTo.text,
                  sender: replyingTo.sender,
                } as ReplyToMessage
              }
              onCancel={() => setReplyingTo(null)}
            />
          )}

          {/* ── Image Preview Bar ── */}
          {pendingImage && (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: pendingImage.uri }}
                style={styles.previewImage}
                contentFit="cover"
              />
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => setPendingImage(null)}
                  style={[
                    styles.previewBtn,
                    { backgroundColor: colors.surface.light },
                  ]}
                >
                  <Ionicons name="close" size={20} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={handleSendImage}
                  disabled={isUploadingMedia}
                  style={[
                    styles.previewBtn,
                    { backgroundColor: colors.primary.default },
                  ]}
                >
                  {isUploadingMedia ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.surface.dark}
                    />
                  ) : (
                    <Ionicons
                      name="send"
                      size={18}
                      color={colors.surface.dark}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Voice Preview Bar ── */}
          {pendingVoice && !pendingImage && (
            <View style={styles.voicePreviewContainer}>
              <Ionicons name="mic" size={20} color={colors.primary.default} />
              <Text
                style={[
                  styles.textInput,
                  {
                    flex: 1,
                    marginBottom: 0,
                    paddingVertical: 8,
                    color: colors.foreground,
                  },
                ]}
              >
                Voice message ready
              </Text>
              <Pressable
                onPress={() => setPendingVoice(null)}
                style={[
                  styles.previewBtn,
                  { backgroundColor: colors.surface.light },
                ]}
              >
                <Ionicons name="trash" size={18} color="#EF4444" />
              </Pressable>
              <Pressable
                onPress={handleSendVoice}
                disabled={isUploadingMedia}
                style={[
                  styles.previewBtn,
                  { backgroundColor: colors.primary.default },
                ]}
              >
                {isUploadingMedia ? (
                  <ActivityIndicator size="small" color={colors.surface.dark} />
                ) : (
                  <Ionicons name="send" size={18} color={colors.surface.dark} />
                )}
              </Pressable>
            </View>
          )}

          {/* ── Normal Input bar ── */}
          {!pendingImage && !pendingVoice && (
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                {/* Media Attach Button */}
                {!isRecording && (
                  <Pressable
                    onPress={handlePickImage}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.pressedState,
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={24}
                      color={colors.primary.default}
                    />
                  </Pressable>
                )}

                {isRecording ? (
                  <View
                    style={[
                      styles.textInput,
                      { justifyContent: "center", marginBottom: 0 },
                    ]}
                  >
                    <Text
                      style={{
                        color: "red",
                        fontWeight: "bold",
                        paddingVertical: 8,
                      }}
                    >
                      Recording audio... 🎤
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    placeholder="Type a message"
                    placeholderTextColor={colors.subtleForeground}
                    style={styles.textInput}
                    multiline
                    value={messageText}
                    onChangeText={handleTyping}
                    onSubmitEditing={handleSend}
                    editable={!isSending}
                  />
                )}

                {messageText.trim().length > 0 ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      isSending && styles.sendButtonDisabled,
                      pressed && styles.pressedState,
                    ]}
                    onPress={handleSend}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.surface.dark}
                      />
                    ) : (
                      <Ionicons
                        name="send"
                        size={18}
                        color={colors.surface.dark}
                      />
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      isSending && styles.sendButtonDisabled,
                      pressed && styles.pressedState,
                      isRecording && { backgroundColor: "red" },
                    ]}
                    onPress={isRecording ? stopRecording : startRecording}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.surface.dark}
                      />
                    ) : (
                      <Ionicons
                        name={isRecording ? "stop" : "mic"}
                        size={18}
                        color={colors.surface.dark}
                      />
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          )}
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
    flex1: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.surface.default },
    pressedState: { opacity: 0.7 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.surface.default,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
    },
    headerInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 8,
    },
    headerAvatar: { width: 40, height: 40, borderRadius: 20 },
    headerTextWrapper: { marginLeft: 12 },
    headerName: { color: colors.foreground, fontWeight: "600", fontSize: 16 },
    headerStatus: { fontSize: 12 },
    textPrimary: { color: colors.primary.default },
    textMuted: { color: colors.mutedForeground },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    mainContainer: { flex: 1, backgroundColor: colors.surface.default },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 4,
    },
    inputContainer: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 8,
      backgroundColor: colors.surface.default,
      borderTopWidth: 1,
      borderTopColor: colors.surface.light,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "flex-end",
      backgroundColor: colors.surface.card,
      borderRadius: 24,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 8,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    textInput: {
      flex: 1,
      color: colors.foreground,
      fontSize: 14,
      marginBottom: 8,
      maxHeight: 100,
    },
    sendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary.default,
    },
    sendButtonDisabled: { opacity: 0.4 },
    previewContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      backgroundColor: colors.surface.card,
      borderTopWidth: 1,
      borderTopColor: colors.surface.light,
    },
    previewImage: {
      width: 64,
      height: 64,
      borderRadius: 10,
    },
    previewActions: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    previewBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    voicePreviewContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface.card,
      borderTopWidth: 1,
      borderTopColor: colors.surface.light,
    },
  });

export default ChatDetailScreen;
