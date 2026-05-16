import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type EmptyUIProps = {
  title: string;
  subtitle?: string;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  iconSize?: number;
  buttonLabel?: string;
  onPressButton?: () => void;
};

function EmptyUI({
  title,
  subtitle,
  iconName = "chatbubbles-outline",
  iconColor = "#6B6B70", // Keeping the default, but you could also use Colors.subtleForeground here!
  iconSize = 64,
  buttonLabel,
  onPressButton,
}: EmptyUIProps) {
  return (
    <View style={styles.container}>
      {iconName && (
        <Ionicons name={iconName} size={iconSize} color={iconColor} />
      )}

      <Text style={styles.titleText}>{title}</Text>

      {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}

      {buttonLabel && onPressButton ? (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed, // Added a slight opacity press effect to make it feel responsive!
          ]}
          onPress={onPressButton}
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80, // Replaces "py-20" (Tailwind's spacing scale: 20 * 4px = 80px)
  },
  titleText: {
    color: Colors.mutedForeground, // Replaces "text-muted-foreground"
    fontSize: 18, // Replaces "text-lg"
    marginTop: 16, // Replaces "mt-4" (4 * 4px = 16px)
  },
  subtitleText: {
    color: Colors.subtleForeground, // Replaces "text-subtle-foreground"
    fontSize: 14, // Replaces "text-sm"
    marginTop: 4, // Replaces "mt-1" (1 * 4px = 4px)
  },
  button: {
    marginTop: 24, // Replaces "mt-6" (6 * 4px = 24px)
    backgroundColor: Colors.primary.default, // Replaces "bg-primary"
    paddingHorizontal: 24, // Replaces "px-6"
    paddingVertical: 12, // Replaces "py-3"
    borderRadius: 999, // Replaces "rounded-full"
  },
  buttonPressed: {
    opacity: 0.8, // Optional: Gives the button a nice click feel since active: opacity was missing in the original
  },
  buttonText: {
    color: Colors.surface.dark, // Replaces "text-surface-dark"
    fontWeight: "600", // Replaces "font-semibold"
  },
});

export default EmptyUI;
