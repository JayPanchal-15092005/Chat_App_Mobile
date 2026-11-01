import { useTheme } from "@/hooks/useTheme";
import type { User } from "@/types";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getAvatarUrl } from "@/lib/utils";

type UserItemProps = {
  user: User;
  isOnline: boolean;
  onPress: () => void;
  isSelected?: boolean;
  showSelection?: boolean;
};

function UserItem({ user, isOnline, onPress, isSelected, showSelection }: UserItemProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.avatarContainer}>
        <Image source={getAvatarUrl(user.name, user.avatar)} style={styles.avatarImage} contentFit="cover" />
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.nameText} numberOfLines={1}>
            {user.name}
          </Text>
          {isOnline && <Text style={styles.onlineText}>Online</Text>}
        </View>
        <Text style={styles.emailText}>{user.email}</Text>
      </View>

      {showSelection && (
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#000000" />}
        </View>
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────
// Dynamic styles
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
    },
    containerPressed: {
      opacity: 0.7,
    },
    avatarContainer: {
      position: "relative",
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    onlineIndicator: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      backgroundColor: "#22C55E",
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.surface.default,
    },
    infoContainer: {
      flex: 1,
      marginLeft: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
      paddingBottom: 8,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    nameText: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.foreground,
      flex: 1,
    },
    onlineText: {
      fontSize: 12,
      color: "#22C55E",
      marginLeft: 8,
    },
    emailText: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.subtleForeground,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },
    checkboxSelected: {
      backgroundColor: colors.primary.default,
      borderColor: colors.primary.default,
    },
  });

export default UserItem;
