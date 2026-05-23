import { useTheme } from "@/hooks/useTheme";
import { Message } from "@/types";
import { StyleSheet, Text, View } from "react-native";

function MessageBubble({
  message,
  isFromMe,
}: {
  message: Message;
  isFromMe: boolean;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View
      style={[
        styles.container,
        isFromMe ? styles.alignRight : styles.alignLeft,
      ]}
    >
      <View
        style={[
          styles.bubbleBase,
          isFromMe ? styles.bubbleFromMe : styles.bubbleFromOther,
        ]}
      >
        <Text
          style={[
            styles.textBase,
            isFromMe ? styles.textFromMe : styles.textFromOther,
          ]}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 4,
    },
    alignRight: {
      justifyContent: "flex-end",
    },
    alignLeft: {
      justifyContent: "flex-start",
    },
    bubbleBase: {
      maxWidth: "80%",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
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
    textBase: {
      fontSize: 14,
    },
    textFromMe: {
      color: colors.surface.dark,
    },
    textFromOther: {
      color: colors.foreground,
    },
  });

export default MessageBubble;
