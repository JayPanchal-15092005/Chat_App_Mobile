import EmptyUI from "@/components/EmptyUI";
import MessageBubble from "@/components/MessageBubble";
import ReplyPreview from "@/components/ReplyPreview";
import UserItem from "@/components/UserItem";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useCurrentUser } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { useTheme } from "@/hooks/useTheme";
import { useChatDetails, useAddGroupMembers, useLeaveGroupChat } from "@/hooks/useChats";
import { useUsers } from "@/hooks/useUsers";
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
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
  participantId?: string;
  name: string;
  avatar: string;
  isGroup?: string;
};

const ChatDetailScreen = () => {
  const {
    id: chatId,
    avatar,
    name,
    participantId,
    isGroup,
  } = useLocalSearchParams<ChatParams>();

  const isGroupChat = isGroup === "true";
  const { data: chatDetails, refetch: refetchChatDetails } = useChatDetails(chatId);
  const { mutate: addMembers, isPending: isAddingMembers } = useAddGroupMembers();
  const { mutate: leaveGroup, isPending: isLeavingGroup } = useLeaveGroupChat();
  const { data: allUsers } = useUsers();

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);

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

  const flatListRef = useRef<FlatList<Message>>(null);

  const panX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 9999]) // only trigger when swiping left
    .failOffsetY([-15, 15]) // let vertical scrolling take priority
    .onUpdate((event) => {
      if (event.translationX < 0) {
        // limit drag and add rubber-band effect
        let newX = event.translationX;
        if (newX < -90) {
          newX = -90 + (newX + 90) * 0.2; // Rubber band if pulled past 90px
        }
        panX.value = newX;
      } else {
        panX.value = 0;
      }
    })
    .onFinalize(() => {
      panX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const animatedListStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: panX.value }],
    };
  });

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
    if (!messageText.trim() || isSending || !currentUser)
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
        allowsEditing: false,
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

  const handleLeaveGroup = () => {
    Alert.alert(
      "Exit Group",
      "Are you sure you want to exit this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit Group",
          style: "destructive",
          onPress: () => {
            leaveGroup(chatId, {
              onSuccess: () => {
                setShowGroupInfo(false);
                router.replace("/(tabs)");
              },
              onError: (err: any) => {
                Alert.alert(
                  "Error",
                  err?.response?.data?.message || "Failed to leave group."
                );
              },
            });
          },
        },
      ]
    );
  };

  const handleConfirmAddMembers = () => {
    if (selectedNewMembers.length === 0) return;
    addMembers(
      { chatId, memberIds: selectedNewMembers },
      {
        onSuccess: () => {
          setSelectedNewMembers([]);
          setShowAddMember(false);
          refetchChatDetails();
          Alert.alert("Success", "New members added to the group!");
        },
        onError: (err: any) => {
          Alert.alert(
            "Error",
            err?.response?.data?.message || "Failed to add members."
          );
        },
      }
    );
  };

  const currentMemberIds = new Set(
    (chatDetails?.participants || []).map((p: any) => p._id?.toString() || p.toString())
  );
  const eligibleNewUsers = (allUsers || []).filter(
    (u: any) => !currentMemberIds.has(u._id)
  );

  const adminId =
    typeof chatDetails?.groupAdmin === "object"
      ? (chatDetails?.groupAdmin as any)?._id
      : chatDetails?.groupAdmin;

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

        <Pressable
          style={styles.headerInfo}
          onPress={() => {
            if (isGroupChat) setShowGroupInfo(true);
          }}
        >
          {avatar ? (
            <Image
              source={isGroupChat ? avatar : getAvatarUrl(name, avatar)}
              style={styles.headerAvatar}
              contentFit="cover"
            />
          ) : null}
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
              {isTyping
                ? "typing..."
                : isGroupChat
                ? `${chatDetails?.participants?.length || 2} members • tap for info`
                : isOnline
                ? "Online"
                : "Offline"}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              if (isGroupChat) {
                Alert.alert("Group Calls", "Group calls will be available in the next update!");
              } else {
                startCall(participantId || "", name, getAvatarUrl(name, avatar) || "");
              }
            }}
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
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[{ flex: 1 }, animatedListStyle]}>
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.scrollContent}
                  onContentSizeChange={() => {
                    // First scroll — fires when text message is appended
                    flatListRef.current?.scrollToEnd({ animated: false });
                    // Second delayed scroll — fires after images finish loading and expand height
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 400);
                  }}
                  onLayout={() =>
                    flatListRef.current?.scrollToEnd({ animated: false })
                  }
                  renderItem={({ item: message }) => {
                    const senderId =
                      typeof message.sender === "string"
                        ? message.sender
                        : (message.sender as MessageSender)._id;
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
                        onImageLoad={() =>
                          flatListRef.current?.scrollToEnd({ animated: false })
                        }
                        panX={panX}
                        isGroup={isGroupChat}
                      />
                    );
                  }}
                />
              </Animated.View>
            </GestureDetector>
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

      {/* ─── GROUP INFO MODAL ─── */}
      <Modal
        visible={showGroupInfo}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGroupInfo(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={styles.groupModalHeader}>
            <Pressable
              onPress={() => setShowGroupInfo(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={styles.groupModalTitle}>Group Info</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.groupInfoScroll}
            contentContainerStyle={styles.groupInfoScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Group Hero */}
            <View style={styles.groupHeroSection}>
              <Image
                source={avatar ? avatar : getAvatarUrl(name, null)}
                style={styles.groupHeroAvatar}
                contentFit="cover"
              />
              <Text style={styles.groupHeroName}>{name}</Text>
              <Text style={styles.groupHeroSub}>
                Group • {chatDetails?.participants?.length || 0} participants
              </Text>
            </View>

            {/* Participants Section */}
            <View style={styles.participantsSection}>
              <View style={styles.participantsSectionHeader}>
                <Text style={styles.sectionHeaderTitle}>
                  {chatDetails?.participants?.length || 0} PARTICIPANTS
                </Text>
                <Pressable
                  style={styles.addMemberHeaderBtn}
                  onPress={() => setShowAddMember(true)}
                >
                  <Ionicons name="person-add" size={15} color={colors.primary.default} />
                  <Text style={styles.addMemberHeaderBtnText}>Add</Text>
                </Pressable>
              </View>

              <View style={styles.membersCard}>
                {(chatDetails?.participants || []).map((participant: any, index: number) => {
                  const isUserAdmin =
                    participant._id === adminId ||
                    participant === adminId;

                  return (
                    <View
                      key={participant._id || index}
                      style={[
                        styles.memberRow,
                        index < (chatDetails?.participants?.length || 1) - 1 &&
                          styles.memberRowBorder,
                      ]}
                    >
                      <Image
                        source={getAvatarUrl(participant.name, participant.avatar)}
                        style={styles.memberAvatar}
                        contentFit="cover"
                      />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {participant.name}
                          {participant._id === currentUser?._id ? " (You)" : ""}
                        </Text>
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {participant.email}
                        </Text>
                      </View>
                      {isUserAdmin && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Group Admin</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Exit Group Button */}
            <Pressable
              style={({ pressed }) => [
                styles.exitGroupButton,
                pressed && styles.pressedState,
                isLeavingGroup && { opacity: 0.5 },
              ]}
              onPress={handleLeaveGroup}
              disabled={isLeavingGroup}
            >
              {isLeavingGroup ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                  <Text style={styles.exitGroupText}>Exit Group</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─── ADD MEMBERS MODAL ─── */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddMember(false);
          setSelectedNewMembers([]);
        }}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={styles.groupModalHeader}>
            <Pressable
              onPress={() => {
                setShowAddMember(false);
                setSelectedNewMembers([]);
              }}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="arrow-back" size={22} color={colors.foreground} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.groupModalTitle}>Add Participants</Text>
              <Text style={styles.groupHeroSub}>
                {selectedNewMembers.length} selected
              </Text>
            </View>
            <Pressable
              style={[
                styles.confirmAddBtn,
                (selectedNewMembers.length === 0 || isAddingMembers) &&
                  styles.confirmAddBtnDisabled,
              ]}
              onPress={handleConfirmAddMembers}
              disabled={selectedNewMembers.length === 0 || isAddingMembers}
            >
              {isAddingMembers ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.confirmAddBtnText}>Done</Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={styles.groupInfoScroll}
            contentContainerStyle={styles.groupInfoScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {eligibleNewUsers.length === 0 ? (
              <View style={styles.noEligibleUsers}>
                <Ionicons name="checkmark-done-circle-outline" size={54} color={colors.primary.default} />
                <Text style={styles.noEligibleTitle}>All contacts are in this group</Text>
                <Text style={styles.noEligibleSub}>
                  There are no other registered users to add.
                </Text>
              </View>
            ) : (
              eligibleNewUsers.map((user: any) => {
                const isSelected = selectedNewMembers.includes(user._id);
                return (
                  <UserItem
                    key={user._id}
                    user={user}
                    isOnline={onlineUsers.has(user._id)}
                    showSelection
                    isSelected={isSelected}
                    onPress={() => {
                      setSelectedNewMembers((prev) =>
                        prev.includes(user._id)
                          ? prev.filter((id) => id !== user._id)
                          : [...prev, user._id]
                      );
                    }}
                  />
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    mainContainer: { flex: 1, backgroundColor: colors.surface.default, overflow: "hidden" },
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
    modalSafeArea: {
      flex: 1,
      backgroundColor: colors.surface.default,
    },
    groupModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface.card,
      alignItems: "center",
      justifyContent: "center",
    },
    groupModalTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
    },
    groupInfoScroll: {
      flex: 1,
    },
    groupInfoScrollContent: {
      paddingBottom: 40,
    },
    groupHeroSection: {
      alignItems: "center",
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
    },
    groupHeroAvatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      marginBottom: 12,
    },
    groupHeroName: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
    },
    groupHeroSub: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 4,
    },
    participantsSection: {
      paddingHorizontal: 16,
      marginTop: 20,
    },
    participantsSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sectionHeaderTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.subtleForeground,
      letterSpacing: 0.8,
    },
    addMemberHeaderBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: `${colors.primary.default}15`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    addMemberHeaderBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary.default,
    },
    membersCard: {
      backgroundColor: colors.surface.card,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.surface.light,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    memberRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
    },
    memberAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },
    memberName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    memberEmail: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    adminBadge: {
      backgroundColor: `${colors.primary.default}20`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    adminBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary.default,
    },
    exitGroupButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 28,
      marginHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.2)",
    },
    exitGroupText: {
      color: "#EF4444",
      fontSize: 15,
      fontWeight: "600",
    },
    confirmAddBtn: {
      backgroundColor: colors.primary.default,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
    },
    confirmAddBtnDisabled: {
      opacity: 0.4,
    },
    confirmAddBtnText: {
      color: "#000000",
      fontWeight: "700",
      fontSize: 13,
    },
    noEligibleUsers: {
      alignItems: "center",
      paddingVertical: 48,
      paddingHorizontal: 20,
    },
    noEligibleTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.foreground,
      marginTop: 12,
    },
    noEligibleSub: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      marginTop: 6,
    },
  });

export default ChatDetailScreen;
