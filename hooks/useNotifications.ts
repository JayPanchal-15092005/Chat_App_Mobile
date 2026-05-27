import { useApi } from "@/lib/axios";
import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Configure how notifications appear when the app is foregrounded
// ─────────────────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Handles everything related to push notifications:
 * 1. Requests permission
 * 2. Gets the Expo push token (routes to FCM on Android)
 * 3. Saves the token to the backend (only when user is signed in)
 * 4. Navigates to the relevant chat when a notification is tapped
 *
 * Must be rendered inside ClerkProvider + QueryClientProvider.
 */
export function useNotifications() {
  const { isSignedIn } = useAuth();
  const { apiWithAuth } = useApi();
  const router = useRouter();

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const tokenRegistered = useRef(false); // prevent registering more than once per session

  // ─── Notification tap listener (always active) ───────────────────────────
  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification) => {
        // Notification received while app is in foreground — handler above shows it
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        console.log("[Notifications] Tapped notification data:", data);

        if (data?.chatId && data?.participantId && data?.name) {
          router.push({
            pathname: "/chat/[id]",
            params: {
              id: data.chatId,
              participantId: data.participantId,
              name: data.name,
              avatar: data.avatar ?? "",
            },
          });
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // ─── Token registration (only when user is authenticated) ────────────────
  useEffect(() => {
    // Only run once the user is fully signed in, and only once per session
    if (!isSignedIn || tokenRegistered.current) return;

    registerForPushNotifications();
  }, [isSignedIn]);

  // ─────────────────────────────────────────────────────────────────────────
  async function registerForPushNotifications() {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log("[Notifications] Skipping — not a physical device.");
      return;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      console.log("[Notifications] Requesting permission...");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[Notifications] Permission not granted — status:", finalStatus);
      return;
    }

    console.log("[Notifications] Permission granted.");

    // Android requires a notification channel to be set up
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F4A261",
        sound: "default",
        showBadge: true,
      });
      console.log("[Notifications] Android channel set up.");
    }

    try {
      // projectId is REQUIRED for Expo SDK 50+ — without it the call fails
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.error(
          "[Notifications] Missing projectId in app.json extra.eas.projectId — cannot get push token."
        );
        return;
      }

      console.log("[Notifications] Getting Expo push token for projectId:", projectId);

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const expoPushToken = tokenData.data;

      console.log("[Notifications] Expo push token:", expoPushToken);

      // Save the token to the backend
      const response = await apiWithAuth({
        method: "PATCH",
        url: "/users/fcm-token",
        data: { fcmToken: expoPushToken },
      });

      console.log("[Notifications] Token saved to backend:", response.data);
      tokenRegistered.current = true;
    } catch (error: any) {
      console.error(
        "[Notifications] Failed to get/register push token:",
        error?.response?.data ?? error?.message ?? error
      );
    }
  }
}
