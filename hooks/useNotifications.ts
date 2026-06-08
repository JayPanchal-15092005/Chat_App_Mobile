import { useApi } from "@/lib/axios";
import { useCallStore } from "@/lib/callStore";
import { useSocketStore } from "@/lib/socket";
import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { displayIncomingCallViaCallKeep } from "@/hooks/useCallKeep";
import messaging from "@react-native-firebase/messaging";

// ─────────────────────────────────────────────────────────────────────────────
// Foreground notification handler
// - Call notifications are suppressed when app is active (CallKeep / socket handles it)
// - Message notifications always show
// ─────────────────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;

    if (data?.type === "incoming-call") {
      // Foreground: socket event already triggered IncomingCallModal
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/**
 * useNotifications — handles chat push notifications and token registration.
 *
 * Call notifications are handled by useCallKeep (the CallKeep integration).
 * This hook only deals with:
 *  1. Requesting push permission
 *  2. Registering the FCM/Expo push token to the backend
 *  3. Navigating to chats when a chat notification is tapped
 *  4. Checking for cold-start call notifications (app was killed)
 */
export function useNotifications() {
  const { isSignedIn } = useAuth();
  const { apiWithAuth } = useApi();
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const receivedListener = useRef<Notifications.EventSubscription | null>(null);
  const tokenRegistered = useRef(false);

  // ── Notification response listener (tap on notification) ────────────────
  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleResponse(response);
      });

    // Cold start — app was killed and opened via a notification tap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    // Received in foreground (call type is suppressed by handler above)
    receivedListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as any;
        console.log("[Notifications] Foreground received:", data?.type ?? "message");
      },
    );

    return () => {
      responseListener.current?.remove();
      receivedListener.current?.remove();
    };
  }, []);

  // ── Token registration ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;

    if (!tokenRegistered.current) {
      registerForPushNotifications();
    }

    // Automatically update the backend if the FCM token changes
    const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
      console.log("[Notifications] FCM Token Refreshed:", newToken);
      try {
        await apiWithAuth({
          method: "PATCH",
          url: "/users/push-tokens",
          data: { fcmToken: newToken },
        });
      } catch (err) {
        console.error("[Notifications] Failed to sync refreshed FCM token:", err);
      }
    });

    return unsubscribe;
  }, [isSignedIn, apiWithAuth]);

  // ─────────────────────────────────────────────────────────────────────────
  function handleResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as any;
    const actionId = response.actionIdentifier;

    console.log("[Notifications] Response — action:", actionId, "type:", data?.type);

    if (data?.type === "incoming-call") {
      // App was tapped open from a call notification (not from CallKeep native UI)
      // Show IncomingCallModal so the user can accept/reject inside the app.
      const { callerId, callerName, callerAvatar, callType, callId } = data;
      useCallStore.getState().setIncomingCallFromPush({
        callerId,
        callerName,
        callerAvatar,
        callType: callType ?? "audio",
        callId,
      });

    } else if (data?.chatId && data?.participantId && data?.name) {
      // Chat message notification — navigate to the conversation
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
  }

  // ─────────────────────────────────────────────────────────────────────────
  async function registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log("[Notifications] Skipping — not a physical device.");
      return;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[Notifications] Permission not granted:", finalStatus);
      return;
    }

    if (Platform.OS === "android") {
      // Messages channel only — call channel is handled by CallKeep's
      // ConnectionService foreground service config
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F4A261",
        sound: "default",
        showBadge: true,
      });
      console.log("[Notifications] Android messages channel set up.");
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.error("[Notifications] Missing projectId.");
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const expoPushToken = tokenData.data;
      console.log("[Notifications] Expo push token:", expoPushToken);

      // Get Raw FCM Token for Firebase Messaging (VoIP)
      let fcmToken = null;
      try {
        await messaging().registerDeviceForRemoteMessages();
        fcmToken = await messaging().getToken();
        console.log("[Notifications] FCM raw token:", fcmToken);
      } catch (fcmErr) {
        console.warn("[Notifications] Failed to get FCM token:", fcmErr);
      }

      await apiWithAuth({
        method: "PATCH",
        url: "/users/push-tokens",
        data: { expoPushToken, fcmToken },
      });

      console.log("[Notifications] Tokens saved to backend.");
      tokenRegistered.current = true;
    } catch (error: any) {
      console.error(
        "[Notifications] Failed:",
        error?.response?.data ?? error?.message ?? error,
      );
    }
  }
}
