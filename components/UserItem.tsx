import { useTheme } from "@/hooks/useTheme";
import type { User } from "@/types";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

type UserItemProps = {
  user: User;
  isOnline: boolean;
  onPress: () => void;
};

function UserItem({ user, isOnline, onPress }: UserItemProps) {
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
        <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
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
    avatarContainer: {},
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
      color: colors.foreground,
      fontWeight: "500",
    },
    onlineText: {
      fontSize: 12,
      color: colors.primary.default,
      fontWeight: "500",
    },
    emailText: {
      fontSize: 12,
      color: colors.subtleForeground,
      marginTop: 2,
    },
  });

export default UserItem;
