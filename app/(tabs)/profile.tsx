import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useCurrentUser } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { uploadToImageKit } from "@/lib/imagekit";
import { useApi } from "@/lib/axios";
import { getAvatarUrl } from "@/lib/utils";
import { User } from "@/types";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  color: string;
  value?: string;
  isDarkModeToggle?: boolean;
  isNotificationToggle?: boolean;
  onPress?: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const ProfileTab = () => {
  const insets = useSafeAreaInsets();
  const { clearAuth, setAuth, token } = useAuthStore();
  const { data: user, refetch } = useCurrentUser();
  const { colors, isDark, toggleTheme } = useTheme();
  const { apiWithAuth } = useApi();

  // State
  const [isUploading, setIsUploading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Edit Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Privacy & Security Modal State
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Direct Avatar change from main header
  const handleDirectImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setIsUploading(true);
      const uri = result.assets[0].uri;

      if (!token) throw new Error("Not authenticated");
      const imageUrl = await uploadToImageKit(uri, "image", token);

      if (!imageUrl) {
        throw new Error("Failed to upload image");
      }

      const { data: updatedUser } = await apiWithAuth<User>({
        url: "/auth/profile",
        method: "PATCH",
        data: { avatar: imageUrl },
      });

      if (token) {
        await setAuth(token, updatedUser);
      }
      refetch();
      Alert.alert("Success", "Profile picture updated successfully!");
    } catch (error) {
      console.error("Failed to update profile picture", error);
      Alert.alert("Error", "Failed to update profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  // Open Edit Profile Modal
  const handleOpenEditProfile = () => {
    setEditName(user?.name || "");
    setNewAvatarUri(null);
    setIsEditProfileOpen(true);
  };

  // Choose image inside Edit Profile Modal
  const handlePickEditAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Failed to pick image", error);
    }
  };

  // Save changes inside Edit Profile Modal
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation", "Please enter your name.");
      return;
    }
    if (!token) return;

    try {
      setIsSavingProfile(true);
      let finalAvatarUrl = user?.avatar;

      // If user selected a new image in the modal, upload it to ImageKit
      if (newAvatarUri) {
        finalAvatarUrl = await uploadToImageKit(newAvatarUri, "image", token);
      }

      const { data: updatedUser } = await apiWithAuth<User>({
        url: "/auth/profile",
        method: "PATCH",
        data: {
          name: editName.trim(),
          avatar: finalAvatarUrl,
        },
      });

      await setAuth(token, updatedUser);
      refetch();
      setIsEditProfileOpen(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error: any) {
      console.error("Failed to update profile", error);
      Alert.alert(
        "Error",
        error?.response?.data?.message || "Failed to update profile. Please try again."
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const styles = makeStyles(colors, insets);

  const MENU_SECTIONS: MenuSection[] = [
    {
      title: "Account",
      items: [
        {
          id: "edit_profile",
          icon: "person-outline",
          label: "Edit Profile",
          color: "#F4A261",
          onPress: handleOpenEditProfile,
        },
        {
          id: "privacy_security",
          icon: "shield-checkmark-outline",
          label: "Privacy & Security",
          color: "#10B981",
          onPress: () => setIsPrivacyModalOpen(true),
        },
        {
          id: "notifications",
          icon: "notifications-outline",
          label: "Notifications",
          color: "#8B5CF6",
          isNotificationToggle: true,
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          id: "dark_mode",
          icon: "moon-outline",
          label: "Dark Mode",
          isDarkModeToggle: true,
          color: "#6366F1",
        },
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
              <Image
                source={getAvatarUrl(user?.name, user?.avatar)}
                style={styles.avatarImage}
                contentFit="cover"
              />
            </View>

            <Pressable
              style={[styles.cameraButton, isUploading && { opacity: 0.5 }]}
              onPress={handleDirectImageUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.surface.dark} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.surface.dark} />
              )}
            </Pressable>
          </View>

          {/* NAME & EMAIL */}
          <Text style={styles.nameText}>{user?.name}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>

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
                  pressed &&
                    !item.isDarkModeToggle &&
                    !item.isNotificationToggle &&
                    styles.menuItemPressed,
                  index < section.items.length - 1 && styles.menuItemBorder,
                ]}
                onPress={
                  item.isDarkModeToggle
                    ? toggleTheme
                    : item.isNotificationToggle
                    ? () => setNotificationsEnabled((prev) => !prev)
                    : item.onPress
                }
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

                {/* Dark Mode Switch */}
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
                ) : item.isNotificationToggle ? (
                  /* Notifications Switch */
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={(val) => setNotificationsEnabled(val)}
                    trackColor={{
                      false: colors.surface.light,
                      true: `${item.color}80`,
                    }}
                    thumbColor={
                      notificationsEnabled ? item.color : colors.mutedForeground
                    }
                  />
                ) : (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.subtleForeground}
                  />
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
        onPress={() => clearAuth()}
      >
        <View style={styles.logoutContent}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </View>
      </Pressable>

      {/* ─── EDIT PROFILE MODAL ─── */}
      <Modal
        visible={isEditProfileOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditProfileOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable
                onPress={() => setIsEditProfileOpen(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Avatar preview & change */}
            <View style={styles.editAvatarWrapper}>
              <View style={styles.editAvatarBorder}>
                <Image
                  source={
                    newAvatarUri
                      ? { uri: newAvatarUri }
                      : getAvatarUrl(user?.name, user?.avatar)
                  }
                  style={styles.editAvatarImage}
                  contentFit="cover"
                />
              </View>
              <Pressable
                style={styles.changePhotoButton}
                onPress={handlePickEditAvatar}
              >
                <Ionicons name="camera-outline" size={16} color={colors.primary.default} />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </Pressable>
            </View>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.inputField}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor={colors.subtleForeground}
                autoCapitalize="words"
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.saveButton, isSavingProfile && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── PRIVACY & SECURITY MODAL ─── */}
      <Modal
        visible={isPrivacyModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsPrivacyModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.privacyIconHeader}>
              <View style={styles.privacyShieldCircle}>
                <Ionicons name="shield-checkmark" size={36} color="#10B981" />
              </View>
              <Text style={styles.modalTitle}>Privacy & Security</Text>
              <Text style={styles.privacySubtitle}>
                Your data and communications are strictly protected.
              </Text>
            </View>

            <View style={styles.privacyCard}>
              <View style={styles.privacyPoint}>
                <Ionicons name="lock-closed" size={20} color="#10B981" />
                <View style={styles.privacyPointText}>
                  <Text style={styles.privacyPointTitle}>End-to-End Encryption</Text>
                  <Text style={styles.privacyPointDesc}>
                    Your messages, audio clips, and images are protected so only you and the recipient can access them.
                  </Text>
                </View>
              </View>

              <View style={styles.privacyPoint}>
                <Ionicons name="eye-off" size={20} color="#10B981" />
                <View style={styles.privacyPointText}>
                  <Text style={styles.privacyPointTitle}>Zero Data Selling</Text>
                  <Text style={styles.privacyPointDesc}>
                    We never share, sell, or track your personal information or chat logs with advertisers or third parties.
                  </Text>
                </View>
              </View>

              <View style={styles.privacyPoint}>
                <Ionicons name="key" size={20} color="#10B981" />
                <View style={styles.privacyPointText}>
                  <Text style={styles.privacyPointTitle}>Hardware Keystore Storage</Text>
                  <Text style={styles.privacyPointDesc}>
                    Your login tokens are stored in hardware-backed secure storage on your device.
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.gotItButton}
              onPress={() => setIsPrivacyModalOpen(false)}
            >
              <Text style={styles.gotItButtonText}>Understood</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// ─────────────────────────────────────────────
// Dynamic styles — recreated when theme changes
// ─────────────────────────────────────────────
const makeStyles = (
  colors: ReturnType<typeof useTheme>["colors"],
  insets: { top: number; bottom: number }
) =>
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
      marginTop: insets.top + 16, // Clear phone notch and status bar cleanly!
    },
    avatarBorder: {
      borderRadius: 999,
      borderWidth: 2,
      borderColor: colors.primary.default,
    },
    avatarImage: {
      width: 104,
      height: 104,
      borderRadius: 52,
    },
    cameraButton: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 34,
      height: 34,
      backgroundColor: colors.primary.default,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.surface.dark,
      elevation: 4,
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

    // ─── Modal Styles ───
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    modalContainer: {
      width: "100%",
      backgroundColor: colors.surface.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.surface.light,
      elevation: 6,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
    },
    modalCloseButton: {
      padding: 4,
    },
    editAvatarWrapper: {
      alignItems: "center",
      marginBottom: 20,
    },
    editAvatarBorder: {
      borderRadius: 999,
      borderWidth: 2,
      borderColor: colors.primary.default,
      marginBottom: 10,
    },
    editAvatarImage: {
      width: 88,
      height: 88,
      borderRadius: 44,
    },
    changePhotoButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: colors.surface.light,
    },
    changePhotoText: {
      color: colors.primary.default,
      fontSize: 13,
      fontWeight: "600",
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginBottom: 8,
      fontWeight: "500",
    },
    inputField: {
      backgroundColor: colors.surface.light,
      color: colors.foreground,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.surface.default,
    },
    modalActions: {
      marginTop: 4,
    },
    saveButton: {
      backgroundColor: colors.primary.default,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: "#000",
      fontSize: 15,
      fontWeight: "700",
    },

    // Privacy Modal Styles
    privacyIconHeader: {
      alignItems: "center",
      marginBottom: 16,
    },
    privacyShieldCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    privacySubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      marginTop: 6,
      paddingHorizontal: 10,
    },
    privacyCard: {
      backgroundColor: colors.surface.light,
      borderRadius: 14,
      padding: 14,
      gap: 14,
      marginVertical: 12,
    },
    privacyPoint: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    privacyPointText: {
      flex: 1,
    },
    privacyPointTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      marginBottom: 2,
    },
    privacyPointDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    gotItButton: {
      backgroundColor: "#10B981",
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 6,
    },
    gotItButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default ProfileTab;
