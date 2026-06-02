import ReactionPicker from "@/components/ReactionPicker";
import { useTheme } from "@/hooks/useTheme";
import { useSocketStore } from "@/lib/socket";
import {
  Message,
  MessageSender,
  ReplyToMessage
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface MessageBubbleProps {
  message: Message;
  isFromMe: boolean;
  chatId: string;
  currentUserId: string;
  onReply: (message: Message) => void;
}

export default function MessageBubble({
  message,
  isFromMe,
  chatId,
  currentUserId,
  onReply,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const { reactToMessage, editMessage, deleteMessage } = useSocketStore();

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  // Audio player via expo-audio (works in Expo Go, no native module needed)
  const audioPlayer = useAudioPlayer(message.type === "voice" && message.mediaUrl ? { uri: message.mediaUrl } : null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const isPlaying = audioStatus.playing;

  const styles = makeStyles(colors);

  // ── Derived values ──────────────────────────────────────────────────
  const myReaction = message.reactions?.find((r) => r.userId === currentUserId);

  const groupedReactions = (message.reactions ?? []).reduce<
    Record<string, number>
  >((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  // Edit button only shows within 15 minutes of sending (like Telegram)
  const canEdit =
    isFromMe &&
    !message._id.startsWith("temp-") &&
    Date.now() - new Date(message.createdAt).getTime() < 15 * 60 * 1000;

  // ── Handlers ────────────────────────────────────────────────────────
  const playSound = async () => {
    if (!message.mediaUrl) return;
    try {
      if (isPlaying) {
        audioPlayer.pause();
      } else {
        // If finished, seek back to start before replaying
        if (audioStatus.didJustFinish) {
          audioPlayer.seekTo(0);
        }
        audioPlayer.play();
      }
    } catch (err) {
      console.error("Audio playback error", err);
    }
  };

  const handleLongPress = () => setShowContextMenu(true);

  const handleReact = (emoji: string) => {
    reactToMessage(message._id, chatId, emoji);
    setShowReactionPicker(false);
    setShowContextMenu(false);
  };

  const handleEdit = () => {
    setShowContextMenu(false);
    setEditText(message.text);
    setIsEditing(true);
  };

  const handleEditSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.text) {
      editMessage(message._id, chatId, trimmed);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowContextMenu(false);
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMessage(message._id, chatId),
        },
      ],
    );
  };

  const handleReply = () => {
    setShowContextMenu(false);
    onReply(message);
  };

  // ── Status ticks (WhatsApp style) ────────────────────────────────
  const StatusTick = () => {
    if (!isFromMe) return null;

    if (message._id.startsWith("temp-")) {
      // Still sending (clock icon)
      return (
        <View style={styles.statusRow}>
          <Ionicons name="time-outline" size={12} color="rgba(0,0,0,0.4)" />
        </View>
      );
    }
    if (message.status === "seen") {
      return (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-done" size={14} color="#4FC3F7" />
        </View>
      );
    }
    if (message.status === "delivered") {
      return (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-done" size={14} color="rgba(0,0,0,0.4)" />
        </View>
      );
    }
    // sent (single tick)
    return (
      <View style={styles.statusRow}>
        <Ionicons name="checkmark" size={14} color="rgba(0,0,0,0.4)" />
      </View>
    );
  };

  // ── Reply quote (shown inside bubble) ────────────────────────────
  const ReplyQuote = () => {
    if (!message.replyTo) return null;
    const rt = message.replyTo as ReplyToMessage;
    const senderName =
      typeof rt.sender === "string"
        ? "Message"
        : (rt.sender as MessageSender).name;

    return (
      <View
        style={[
          styles.replyQuote,
          isFromMe ? styles.replyQuoteFromMe : styles.replyQuoteFromOther,
        ]}
      >
        <View style={styles.replyAccentBar} />
        <View style={styles.replyContent}>
          <Text style={styles.replyName}>{senderName}</Text>
          <Text style={styles.replyText}>{rt.text}</Text>
        </View>
      </View>
    );
  };

  // ── Reaction bubbles (shown below bubble) ─────────────────────────
  const ReactionBubbles = () => {
    if (Object.keys(groupedReactions).length === 0) return null;
    return (
      <View
        style={[
          styles.reactionContainer,
          isFromMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
        ]}
      >
        {Object.entries(groupedReactions).map(([emoji, count]) => (
          <Pressable
            key={emoji}
            style={[
              styles.reactionBubble,
              myReaction?.emoji === emoji && styles.reactionBubbleActive,
            ]}
            onPress={() => handleReact(emoji)}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <>
      <View
        style={[
          styles.wrapper,
          isFromMe ? styles.alignRight : styles.alignLeft,
        ]}
      >
        {/* Bubble */}
        <Pressable onLongPress={handleLongPress} delayLongPress={300}>
          <View
            style={[
              styles.bubble,
              isFromMe ? styles.bubbleFromMe : styles.bubbleFromOther,
            ]}
          >
            {/* ── Reply quote ── */}
            <ReplyQuote />

            {/* ── Message Media ── */}
            {message.type === "image" && message.mediaUrl && (
              <Image
                source={message.mediaUrl}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 12,
                  marginBottom: 4,
                }}
                contentFit="cover"
              />
            )}

            {message.type === "voice" && message.mediaUrl && (
              <Pressable
                onPress={playSound}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  gap: 8,
                  minWidth: 120,
                }}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={24}
                  color={isFromMe ? "#000" : colors.primary.default}
                />
                <Text
                  style={{
                    color: isFromMe ? "#000" : colors.foreground,
                    fontSize: 12,
                  }}
                >
                  {isPlaying ? "Playing..." : "Voice Message"}
                </Text>
              </Pressable>
            )}

            {/* ── Message text ── */}
            {message.text &&
              message.text !== "📸 Image" &&
              message.text !== "🎤 Voice Message" && (
                <Text
                  style={[
                    styles.text,
                    isFromMe ? styles.textFromMe : styles.textFromOther,
                  ]}
                >
                  {message.text}
                </Text>
              )}

            {/* ── Footer: time + edited + tick ── */}
            <View
              style={[
                styles.footer,
                isFromMe ? styles.footerRight : styles.footerLeft,
              ]}
            >
              {message.isEdited && (
                <Text
                  style={[
                    styles.editedLabel,
                    isFromMe ? styles.editedLabelMe : styles.editedLabelOther,
                  ]}
                >
                  Edited
                </Text>
              )}
              <Text
                style={[
                  styles.time,
                  isFromMe ? styles.timeMe : styles.timeOther,
                ]}
              >
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <StatusTick />
            </View>
          </View>
        </Pressable>

        {/* Reactions */}
        <ReactionBubbles />
      </View>

      {/* ── Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={isEditing}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsEditing(false)}
      >
        {/* KeyboardAvoidingView pushes the sheet up when keyboard opens */}
        <KeyboardAvoidingView
          style={styles.editKAV}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={0}
        >
          {/* Backdrop — tap to dismiss */}
          <Pressable
            style={styles.editBackdrop}
            onPress={() => setIsEditing(false)}
          />

          {/* Sheet */}
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>Edit Message</Text>
            <TextInput
              style={styles.editModalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              selectionColor={colors.primary.default}
              placeholderTextColor={colors.subtleForeground}
            />
            <View style={styles.editModalActions}>
              <Pressable
                style={styles.editModalBtnCancel}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.editModalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.editModalBtnSave,
                  !editText.trim() && styles.editModalBtnDisabled,
                ]}
                onPress={handleEditSubmit}
                disabled={!editText.trim()}
              >
                <Text style={styles.editModalBtnSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Context Menu Modal ─────────────────────────────────────── */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowContextMenu(false);
            setShowReactionPicker(false);
          }}
        >
          <View style={styles.contextMenuContainer}>
            {showReactionPicker ? (
              <ReactionPicker
                onSelect={handleReact}
                selectedEmoji={myReaction?.emoji}
              />
            ) : (
              <>
                <Pressable
                  style={styles.contextMenuItem}
                  onPress={() => setShowReactionPicker(true)}
                >
                  <Text style={styles.contextMenuEmoji}>😊</Text>
                  <Text style={styles.contextMenuText}>React</Text>
                </Pressable>

                <Pressable style={styles.contextMenuItem} onPress={handleReply}>
                  <Ionicons
                    name="arrow-undo-outline"
                    size={20}
                    color={colors.primary.default}
                  />
                  <Text style={styles.contextMenuText}>Reply</Text>
                </Pressable>

                {canEdit && (
                  <Pressable
                    style={styles.contextMenuItem}
                    onPress={handleEdit}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={20}
                      color={colors.primary.default}
                    />
                    <Text style={styles.contextMenuText}>Edit</Text>
                  </Pressable>
                )}

                <View style={styles.contextDivider} />

                <Pressable
                  style={styles.contextMenuItem}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={[styles.contextMenuText, { color: "#EF4444" }]}>
                    Delete
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    wrapper: {
      width: "100%",
      marginBottom: 2,
    },
    alignRight: { alignItems: "flex-end" },
    alignLeft: { alignItems: "flex-start" },

    bubble: {
      maxWidth: "80%",
      minWidth: 160,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 6,
      borderRadius: 18,
      flexShrink: 1,
    },
    bubbleFromMe: {
      backgroundColor: colors.primary.default,
      borderBottomRightRadius: 4,
    },
    bubbleFromOther: {
      backgroundColor: colors.surface.card,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: colors.surface.light,
    },

    // ── Reply quote inside bubble ──
    replyQuote: {
      flexDirection: "row",
      borderRadius: 8,
      marginBottom: 6,
    },
    replyQuoteFromMe: {
      backgroundColor: "rgba(0,0,0,0.18)",
    },
    replyQuoteFromOther: {
      backgroundColor: colors.surface.light,
    },
    replyAccentBar: {
      width: 3,
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
      backgroundColor: colors.primary.default,
    },
    replyContent: {
      flex: 1,
      flexShrink: 1,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    replyName: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary.default,
      marginBottom: 2,
    },
    replyText: {
      fontSize: 11,
      color: colors.mutedForeground,
    },

    // ── Message text ──
    text: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
    textFromMe: { color: "#000" },
    textFromOther: { color: colors.foreground },

    // ── Footer (time + edited + tick) ──
    footer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 3,
    },
    footerRight: { justifyContent: "flex-end" },
    footerLeft: { justifyContent: "flex-start" },
    editedLabel: { fontSize: 10, fontStyle: "italic" },
    editedLabelMe: { color: "rgba(0,0,0,0.5)" },
    editedLabelOther: { color: colors.subtleForeground },
    time: { fontSize: 10 },
    timeMe: { color: "rgba(0,0,0,0.5)" },
    timeOther: { color: colors.subtleForeground },
    statusRow: { flexDirection: "row" },

    // ── Reactions ──
    reactionContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 2,
      marginBottom: 4,
      paddingHorizontal: 4,
    },
    reactionBubble: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface.card,
      borderRadius: 12,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.surface.light,
      gap: 2,
    },
    reactionBubbleActive: {
      borderColor: colors.primary.default,
      backgroundColor: `${colors.primary.default}25`,
    },
    reactionEmoji: { fontSize: 14 },
    reactionCount: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "600",
    },

    // ── Edit Modal ──
    editKAV: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    editBackdrop: {
      flex: 1, // takes up all space ABOVE the sheet → tapping it dismisses
    },
    editModal: {
      backgroundColor: colors.surface.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 36,
    },
    editModalTitle: {
      color: colors.foreground,
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 12,
    },
    editModalInput: {
      color: colors.foreground,
      fontSize: 15,
      backgroundColor: colors.surface.default,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 80,
      maxHeight: 160,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.primary.default,
    },
    editModalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 16,
    },
    editModalBtnCancel: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.surface.light,
    },
    editModalBtnCancelText: {
      color: colors.mutedForeground,
      fontWeight: "600",
    },
    editModalBtnSave: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary.default,
    },
    editModalBtnDisabled: {
      opacity: 0.4,
    },
    editModalBtnSaveText: {
      color: "#000",
      fontWeight: "700",
    },

    // ── Context Menu Modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    contextMenuContainer: {
      backgroundColor: colors.surface.card,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 4,
      minWidth: 200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 8,
    },
    contextDivider: {
      height: 1,
      backgroundColor: colors.surface.light,
      marginHorizontal: 12,
      marginVertical: 4,
    },
    contextMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 12,
    },
    contextMenuEmoji: { fontSize: 20 },
    contextMenuText: {
      fontSize: 15,
      color: colors.foreground,
      fontWeight: "500",
    },
  });
