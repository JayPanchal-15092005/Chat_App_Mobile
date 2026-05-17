import { Colors } from "@/constants/Colors";
import { Message } from "@/types";
import { StyleSheet, Text, View } from "react-native";

function MessageBubble({
  message,
  isFromMe,
}: {
  message: Message;
  isFromMe: boolean;
}) {
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

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 4, // Optional: gives a tiny bit of space between consecutive messages
  },
  alignRight: {
    justifyContent: "flex-end", // Pushes the bubble to the right
  },
  alignLeft: {
    justifyContent: "flex-start", // Keeps the bubble on the left
  },
  bubbleBase: {
    maxWidth: "80%", // Replaces "max-w-[80%]"
    paddingHorizontal: 12, // Replaces "px-3"
    paddingVertical: 8, // Replaces "py-2"
    borderRadius: 16, // Replaces "rounded-2xl"
  },
  bubbleFromMe: {
    backgroundColor: Colors.primary.default,
    borderBottomRightRadius: 4, // Replaces "rounded-br-sm" (gives it that classic chat tail look)
  },
  bubbleFromOther: {
    backgroundColor: Colors.surface.card,
    borderBottomLeftRadius: 4, // Replaces "rounded-bl-sm"
    borderWidth: 1,
    borderColor: Colors.surface.light,
  },
  textBase: {
    fontSize: 14, // Replaces "text-sm"
  },
  textFromMe: {
    color: Colors.surface.dark, // The text needs to be dark so it stands out against the primary color
  },
  textFromOther: {
    color: Colors.foreground, // Standard white/light text for the dark gray bubbles
  },
});

export default MessageBubble;
