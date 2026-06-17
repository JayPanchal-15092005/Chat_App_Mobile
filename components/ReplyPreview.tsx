import { useTheme } from "@/hooks/useTheme";
import { ReplyToMessage, MessageSender } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ReplyPreviewProps {
  replyTo: ReplyToMessage;
  onCancel: () => void;
}

export default function ReplyPreview({ replyTo, onCancel }: ReplyPreviewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const senderName =
    typeof replyTo.sender === "string"
      ? "Message"
      : (replyTo.sender as MessageSender).name;

  return (
    <View style={styles.container}>
      <View style={styles.accentBar} />
      <View style={styles.content}>
        <Text style={styles.senderName} numberOfLines={1}>
          {senderName}
        </Text>
        <Text style={styles.previewText} numberOfLines={2}>
          {replyTo.text}
        </Text>
      </View>
      <Pressable onPress={onCancel} style={styles.closeButton} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.subtleForeground} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface.card,
      borderTopWidth: 1,
      borderTopColor: colors.surface.light,
    },
    accentBar: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.primary.default,
      alignSelf: "stretch",
      marginRight: 8,
    },
    content: {
      flex: 1,
    },
    senderName: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary.default,
      marginBottom: 2,
    },
    previewText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    closeButton: {
      padding: 4,
    },
  });
