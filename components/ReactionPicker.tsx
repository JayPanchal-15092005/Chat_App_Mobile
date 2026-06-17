import { useTheme } from "@/hooks/useTheme";
import { Pressable, StyleSheet, Text, View } from "react-native";

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

export default function ReactionPicker({ onSelect, selectedEmoji }: ReactionPickerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      {REACTIONS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => onSelect(emoji)}
          style={({ pressed }) => [
            styles.emojiButton,
            selectedEmoji === emoji && styles.emojiButtonSelected,
            pressed && styles.emojiButtonPressed,
          ]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: colors.surface.card,
      borderRadius: 32,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    emojiButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiButtonSelected: {
      backgroundColor: `${colors.primary.default}30`,
    },
    emojiButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 1.2 }],
    },
    emoji: {
      fontSize: 22,
    },
  });
