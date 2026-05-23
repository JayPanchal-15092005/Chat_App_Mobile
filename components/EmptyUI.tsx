import { useTheme } from "@/hooks/useTheme";
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
  iconColor,
  iconSize = 64,
  buttonLabel,
  onPressButton,
}: EmptyUIProps) {
  const { colors } = useTheme();
  const resolvedIconColor = iconColor ?? colors.subtleForeground;
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      {iconName && (
        <Ionicons name={iconName} size={iconSize} color={resolvedIconColor} />
      )}

      <Text style={styles.titleText}>{title}</Text>

      {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}

      {buttonLabel && onPressButton ? (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={onPressButton}
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
    },
    titleText: {
      color: colors.mutedForeground,
      fontSize: 18,
      marginTop: 16,
    },
    subtitleText: {
      color: colors.subtleForeground,
      fontSize: 14,
      marginTop: 4,
    },
    button: {
      marginTop: 24,
      backgroundColor: colors.primary.default,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 999,
    },
    buttonPressed: {
      opacity: 0.8,
    },
    buttonText: {
      color: colors.surface.dark,
      fontWeight: "600",
    },
  });

export default EmptyUI;
