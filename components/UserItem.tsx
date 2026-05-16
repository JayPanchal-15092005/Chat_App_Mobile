import { Colors } from "@/constants/Colors";
import type { User } from "@/types";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

type UserItemProps = {
  user: User;
  isOnline: boolean;
  onPress: () => void;
};

function UserItem({ user, isOnline, onPress }: UserItemProps) {
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

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10, // Replaces "py-2.5" (2.5 * 4px = 10px)
  },
  containerPressed: {
    opacity: 0.7, // Replaces "active:opacity-70"
  },
  avatarContainer: {
    // position: "relative" is default in React Native
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24, // Replaces "borderRadius: 999" (half of width/height)
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14, // Replaces "w-3.5" (3.5 * 4px = 14px)
    height: 14, // Replaces "h-3.5"
    backgroundColor: "#22C55E", // Tailwind green-500
    borderRadius: 7, // half of width/height
    borderWidth: 2, // Replaces "border-[2px]"
    borderColor: Colors.surface.default, // Replaces "border-surface"
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12, // Replaces "ml-3"
    borderBottomWidth: 1, // Replaces "border-b"
    borderBottomColor: Colors.surface.light, // Replaces "border-surface-light"
    paddingBottom: 8, // Replaces "pb-2"
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameText: {
    color: Colors.foreground,
    fontWeight: "500", // Replaces "font-medium"
  },
  onlineText: {
    fontSize: 12, // Replaces "text-xs"
    color: Colors.primary.default,
    fontWeight: "500", // Replaces "font-medium"
  },
  emailText: {
    fontSize: 12, // Replaces "text-xs"
    color: Colors.subtleForeground,
    marginTop: 2, // Replaces "mt-0.5"
  },
});

export default UserItem;
