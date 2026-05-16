import { Colors } from "@/constants/Colors";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const MENU_SECTIONS = [
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
        value: "On",
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

const ProfileTab = () => {
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <ScrollView
      style={styles.scrollView}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      // indicatorStyle="white"
      contentContainerStyle={styles.scrollContent}
    >
      {/* HEADER  */}
      <View style={styles.headerContainer}>
        <View style={styles.profileSection}>
          <View>
            <View style={styles.avatarBorder}>
              <Image source={user?.imageUrl} style={styles.avatarImage} />
            </View>

            <Pressable style={styles.cameraButton}>
              <Ionicons name="camera" size={16} color={Colors.surface.dark} />
            </Pressable>
          </View>

          {/* NAME & EMAIL */}
          <Text style={styles.nameText}>
            {user?.firstName} {user?.lastName}
          </Text>

          <Text style={styles.emailText}>
            {user?.emailAddresses[0]?.emailAddress}
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
                  pressed && styles.menuItemPressed,
                  index < section.items.length - 1 && styles.menuItemBorder,
                ]}
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

                {item.value && (
                  <Text style={styles.menuItemValue}>{item.value}</Text>
                )}

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.subtleForeground}
                />
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

// --- Standard StyleSheet ---
const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.surface.dark,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    // relative by default
  },
  profileSection: {
    alignItems: "center",
    marginTop: 40, // Replaces "mt-10"
  },
  avatarBorder: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.primary.default,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50, // Replaces "borderRadius: 999" (half width/height)
  },
  cameraButton: {
    position: "absolute",
    bottom: 4, // Replaces "bottom-1"
    right: 4, // Replaces "right-1"
    width: 32, // Replaces "w-8"
    height: 32, // Replaces "h-8"
    backgroundColor: Colors.primary.default,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surface.dark,
  },
  nameText: {
    fontSize: 24, // Replaces "text-2xl"
    fontWeight: "bold",
    color: Colors.foreground,
    marginTop: 16, // Replaces "mt-4"
  },
  emailText: {
    color: Colors.mutedForeground,
    marginTop: 4, // Replaces "mt-1"
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12, // Replaces "mt-3"
    backgroundColor: "rgba(34, 197, 94, 0.2)", // Replaces "bg-green-500/20"
    paddingHorizontal: 12, // Replaces "px-3"
    paddingVertical: 6, // Replaces "py-1.5"
    borderRadius: 999,
  },
  onlineDot: {
    width: 8, // Replaces "w-2"
    height: 8, // Replaces "h-2"
    backgroundColor: "#22C55E", // Tailwind green-500
    borderRadius: 4,
    marginRight: 8, // Replaces "mr-2"
  },
  onlineText: {
    color: "#22C55E",
    fontSize: 14, // Replaces "text-sm"
    fontWeight: "500", // Replaces "font-medium"
  },
  sectionContainer: {
    marginTop: 24, // Replaces "mt-6"
    marginHorizontal: 20, // Replaces "mx-5"
  },
  sectionTitle: {
    color: Colors.subtleForeground,
    fontSize: 12, // Replaces "text-xs"
    fontWeight: "600", // Replaces "font-semibold"
    textTransform: "uppercase",
    letterSpacing: 1, // Replaces "tracking-wider"
    marginBottom: 8, // Replaces "mb-2"
    marginLeft: 4, // Replaces "ml-1"
  },
  sectionCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16, // Replaces "rounded-2xl"
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16, // Replaces "px-4"
    paddingVertical: 14, // Replaces "py-3.5"
  },
  menuItemPressed: {
    backgroundColor: Colors.surface.light, // Replaces "active:bg-surface-light"
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface.light,
  },
  iconContainer: {
    width: 36, // Replaces "w-9"
    height: 36, // Replaces "h-9"
    borderRadius: 12, // Replaces "rounded-xl"
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemText: {
    flex: 1,
    marginLeft: 12, // Replaces "ml-3"
    color: Colors.foreground,
    fontWeight: "500", // Replaces "font-medium"
  },
  menuItemValue: {
    color: Colors.subtleForeground,
    fontSize: 14, // Replaces "text-sm"
    marginRight: 4, // Replaces "mr-1"
  },
  logoutButton: {
    marginHorizontal: 20, // Replaces "mx-5"
    marginTop: 32, // Replaces "mt-8"
    backgroundColor: "rgba(239, 68, 68, 0.1)", // Replaces "bg-red-500/10"
    borderRadius: 16, // Replaces "rounded-2xl"
    paddingVertical: 16, // Replaces "py-4"
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)", // Replaces "border-red-500/20"
  },
  logoutButtonPressed: {
    opacity: 0.7, // Replaces "active:opacity-70"
  },
  logoutContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoutText: {
    marginLeft: 8, // Replaces "ml-2"
    color: "#EF4444", // Tailwind red-500
    fontWeight: "600", // Replaces "font-semibold"
  },
});

export default ProfileTab;
