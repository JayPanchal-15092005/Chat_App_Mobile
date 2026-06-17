import { useTheme } from "@/hooks/useTheme";
import useFirebaseAuth from "@/hooks/useFirebaseAuth";
import { useCurrentUser } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

interface MenuItem {
  icon: string;
  label: string;
  color: string;
  value?: string;
  isDarkModeToggle?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const ProfileTab = () => {
  const { signOut } = useFirebaseAuth();
  const { data: user } = useCurrentUser();
  const { colors, isDark, toggleTheme } = useTheme();

  const styles = makeStyles(colors);

  const MENU_SECTIONS: MenuSection[] = [
    {
      title: "Account",
      items: [
        { icon: "person-outline", label: "Edit Profile", color: "#F4A261" },
        {
          icon: "shield-checkmark-outline",
          label: "Privacy & Security",
          color: "#10B981",
        },
        {
          icon: "notifications-outline",
          label: "Notifications",
          value: "On",
          color: "#8B5CF6",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: "moon-outline",
          label: "Dark Mode",
          isDarkModeToggle: true,   // ← special flag
          color: "#6366F1",
        },
        {
          icon: "language-outline",
          label: "Language",
          value: "English",
          color: "#EC4899",
        },
        {
          icon: "cloud-outline",
          label: "Data & Storage",
          value: "1.2 GB",
          color: "#14B8A6",
        },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "help-circle-outline", label: "Help Center", color: "#F59E0B" },
        { icon: "chatbubble-outline", label: "Contact Us", color: "#3B82F6" },
        { icon: "star-outline", label: "Rate the App", color: "#F4A261" },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.scrollView}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <View style={styles.profileSection}>
          <View>
            <View style={styles.avatarBorder}>
              <Image source={user?.avatar} style={styles.avatarImage} />
            </View>

            <Pressable style={styles.cameraButton}>
              <Ionicons name="camera" size={16} color={colors.surface.dark} />
            </Pressable>
          </View>

          {/* NAME & EMAIL */}
          <Text style={styles.nameText}>
            {user?.name}
          </Text>

          <Text style={styles.emailText}>
            {user?.email}
          </Text>

          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>
      </View>

      {/* MENU SECTIONS */}
      {MENU_SECTIONS.map((section) => (
        <View key={section.title} style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>{section.title}</Text>

          <View style={styles.sectionCard}>
            {section.items.map((item, index) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && !item.isDarkModeToggle && styles.menuItemPressed,
                  index < section.items.length - 1 && styles.menuItemBorder,
                ]}
                onPress={item.isDarkModeToggle ? toggleTheme : undefined}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${item.color}20` },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={item.color}
                  />
                </View>

                <Text style={styles.menuItemText}>{item.label}</Text>

                {/* Dark Mode gets a Switch; other items show a text value */}
                {item.isDarkModeToggle ? (
                  <Switch
                    value={isDark}
                    onValueChange={toggleTheme}
                    trackColor={{
                      false: colors.surface.light,
                      true: `${colors.primary.default}80`,
                    }}
                    thumbColor={
                      isDark ? colors.primary.default : colors.mutedForeground
                    }
                  />
                ) : (
                  <>
                    {item.value && (
                      <Text style={styles.menuItemValue}>{item.value}</Text>
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.subtleForeground}
                    />
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Logout Button */}
      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
        onPress={() => signOut()}
      >
        <View style={styles.logoutContent}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
};

// ─────────────────────────────────────────────
// Dynamic styles — recreated when theme changes
// ─────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    scrollView: {
      backgroundColor: colors.surface.dark,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    headerContainer: {},
    profileSection: {
      alignItems: "center",
      marginTop: 40,
    },
    avatarBorder: {
      borderRadius: 999,
      borderWidth: 2,
      borderColor: colors.primary.default,
    },
    avatarImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    cameraButton: {
      position: "absolute",
      bottom: 4,
      right: 4,
      width: 32,
      height: 32,
      backgroundColor: colors.primary.default,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.surface.dark,
    },
    nameText: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.foreground,
      marginTop: 16,
    },
    emailText: {
      color: colors.mutedForeground,
      marginTop: 4,
    },
    onlineBadge: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      backgroundColor: "rgba(34, 197, 94, 0.2)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    onlineDot: {
      width: 8,
      height: 8,
      backgroundColor: "#22C55E",
      borderRadius: 4,
      marginRight: 8,
    },
    onlineText: {
      color: "#22C55E",
      fontSize: 14,
      fontWeight: "500",
    },
    sectionContainer: {
      marginTop: 24,
      marginHorizontal: 20,
    },
    sectionTitle: {
      color: colors.subtleForeground,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
      marginLeft: 4,
    },
    sectionCard: {
      backgroundColor: colors.surface.card,
      borderRadius: 16,
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    menuItemPressed: {
      backgroundColor: colors.surface.light,
    },
    menuItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.surface.light,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    menuItemText: {
      flex: 1,
      marginLeft: 12,
      color: colors.foreground,
      fontWeight: "500",
    },
    menuItemValue: {
      color: colors.subtleForeground,
      fontSize: 14,
      marginRight: 4,
    },
    logoutButton: {
      marginHorizontal: 20,
      marginTop: 32,
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.2)",
    },
    logoutButtonPressed: {
      opacity: 0.7,
    },
    logoutContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    logoutText: {
      marginLeft: 8,
      color: "#EF4444",
      fontWeight: "600",
    },
  });

export default ProfileTab;
