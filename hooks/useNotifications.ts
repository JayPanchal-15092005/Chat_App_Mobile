import { useApi } from "@/lib/axios";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

// Configure how notifications are displayed when app is in the foreground
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
 * Registers the device for push notifications, saves the Expo push token
 * to the backend, and sets up a listener so tapping a notification
 * navigates to the relevant chat.
 *
 * Must be called inside the root layout (after Clerk is loaded).
 */
export function useNotifications() {
  const { apiWithAuth } = useApi();
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotifications();

    // Listener: notification received while app is foregrounded (optional handling)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification) => {
        // You can handle foreground notification display here if needed
      });

    // Listener: user taps a notification → navigate to the chat
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as any;
        if (data?.chatId && data?.participantId && data?.name && data?.avatar) {
          router.push({
            pathname: "/chat/[id]",
            params: {
              id: data.chatId,
              participantId: data.participantId,
              name: data.name,
              avatar: data.avatar,
            },
          });
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  async function registerForPushNotifications() {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log("Push notifications are not supported on simulators.");
      return;
    }

    // Request permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted.");
      return;
    }

    // Android requires a notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F4A261",
        sound: "default",
      });
    }

    try {
      // Get the Expo push token (Expo's delivery service routes to FCM/APNs)
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const expoPushToken = tokenData.data;

      // Save the token to the backend so the server can send notifications
      await apiWithAuth({
        method: "PATCH",
        url: "/users/fcm-token",
        data: { fcmToken: expoPushToken },
      });

      console.log("Push token registered:", expoPushToken);
    } catch (error) {
      console.error("Failed to get/register push token:", error);
    }
  }
}
