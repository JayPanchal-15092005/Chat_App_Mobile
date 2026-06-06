/**
 * useCallKeep.ts
 *
 * Production-ready VoIP / CallKeep integration for Android.
 *
 * react-native-callkeep wraps Android's ConnectionService, giving us:
 *  - Native incoming call UI on lock screen / background / killed app
 *  - System-managed ringtone + vibration
 *  - Accept / Decline buttons integrated into the OS call UI
 *  - Proper audio routing (earpiece / speaker / Bluetooth)
 *
 * INSTALLATION (run in chat_app_mobile directory):
 *   npx expo install react-native-callkeep @config-plugins/react-native-callkeep
 *   eas build --profile development --platform android
 */

import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useCallStore, __registerCallKeepEndCall } from "@/lib/callStore";
import { useSocketStore } from "@/lib/socket";

// ─────────────────────────────────────────────────────────────────────────────
// Safe import — app won't crash before the native rebuild
// ─────────────────────────────────────────────────────────────────────────────
let RNCallKeep: any = null;
try {
  RNCallKeep = require("react-native-callkeep").default;
} catch {
  console.warn(
    "[CallKeep] react-native-callkeep not found. " +
      "Run: npx expo install react-native-callkeep @config-plugins/react-native-callkeep\n" +
      "Then rebuild: eas build --profile development --platform android"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CallKeep setup options — called once on app startup
// ─────────────────────────────────────────────────────────────────────────────
const CALLKEEP_OPTIONS = {
  ios: {
    // iOS CallKit — not used for Android-only setup
    appName: "chat-app",
    maximumCallGroups: "1",
    maximumCallsPerCallGroup: "1",
    supportsVideo: false,
  },
  android: {
    alertTitle: "Permissions Required",
    alertDescription:
      "This application needs to access your phone accounts to make and receive calls.",
    cancelButton: "Cancel",
    okButton: "OK",
    imageName: "phone_account_icon",
    additionalPermissions: [],
    // Required for Android 11+  — allows call from background
    foregroundService: {
      channelId: "com.ketan_panchal.chatapp.call",
      channelName: "Incoming Calls",
      notificationTitle: "Incoming Call",
      notificationIcon: "ic_launcher",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper — generate a stable UUID for a call from the callerId
// (CallKeep requires a UUID per call for tracking)
// ─────────────────────────────────────────────────────────────────────────────
function generateCallUUID(callerId: string): string {
  // Simple deterministic UUID-like string from callerId + timestamp
  return `${callerId.slice(0, 8)}-${Date.now().toString(16).slice(0, 4)}-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Global mutable ref to track the current CallKeep call UUID
// (outside React so it works in event handlers)
// ─────────────────────────────────────────────────────────────────────────────
let _activeCallUUID: string | null = null;

export function displayIncomingCallViaCallKeep(data: {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType?: "audio" | "video";
  callId?: string;
}) {
  if (!RNCallKeep || Platform.OS !== "android") return;

  const uuid = generateCallUUID(data.callerId);
  _activeCallUUID = uuid;

  RNCallKeep.displayIncomingCall(
    uuid,
    data.callerId,          // handle (phone number / user ID)
    data.callerName,        // localizedCallerName
    "generic",              // handleType: 'number', 'email', or 'generic'
    data.callType !== "video", // hasVideo (false = audio only)
  );

  console.log("[CallKeep] Displaying incoming call UI for:", data.callerName, "UUID:", uuid);
}

export function endCallViaCallKeep() {
  if (!RNCallKeep || !_activeCallUUID) return;
  try {
    RNCallKeep.endCall(_activeCallUUID);
  } catch (e) {
    console.warn("[CallKeep] endCall error:", e);
  }
  _activeCallUUID = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook — mount in _layout.tsx inside AppContent
// ─────────────────────────────────────────────────────────────────────────────
export function useCallKeep() {
  const setupDone = useRef(false);

  // ── One-time setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android" || !RNCallKeep || setupDone.current) return;

    try {
      RNCallKeep.setup(CALLKEEP_OPTIONS);
      RNCallKeep.setAvailable(true);
      setupDone.current = true;
      // Register the bridge so callStore can dismiss the native UI
      __registerCallKeepEndCall(endCallViaCallKeep);
      console.log("[CallKeep] Setup complete.");
    } catch (e) {
      console.error("[CallKeep] Setup failed:", e);
    }
  }, []);

  // ── Register CallKeep event listeners ───────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android" || !RNCallKeep) return;

    // ── answerCall — user tapped Accept on the native call screen ───────
    const onAnswerCall = ({ callUUID }: { callUUID: string }) => {
      console.log("[CallKeep] answerCall:", callUUID);

      const { callStatus, incomingOffer, pendingPushCallData } = useCallStore.getState();

      if (callStatus === "incoming" && incomingOffer) {
        // Offer is already here — accept immediately
        useCallStore.getState().acceptCall();
      } else {
        // App was killed / offer hasn't arrived yet — mark for auto-accept
        // when the socket reconnects and delivers the offer
        if (pendingPushCallData) {
          useCallStore.setState({
            pendingPushCallData: { ...(pendingPushCallData as any), _autoAccept: true },
          });
        } else {
          // Edge case: set a flag even without pendingPushCallData
          useCallStore.getState().acceptCallFromPush();
        }
      }

      // Dismiss the native call UI
      if (RNCallKeep && callUUID) {
        RNCallKeep.answerIncomingCall(callUUID);
      }
    };

    // ── endCall — user tapped Decline on the native call screen ─────────
    const onEndCall = ({ callUUID, reason }: { callUUID: string; reason?: number }) => {
      console.log("[CallKeep] endCall / decline:", callUUID, "reason:", reason);

      const { remoteUserId, callId, callStatus } = useCallStore.getState();
      const socket = useSocketStore.getState().socket;

      if (callStatus === "incoming" || callStatus === "idle") {
        // User declined an incoming call
        if (socket?.connected && remoteUserId) {
          socket.emit("call-reject", { targetUserId: remoteUserId, callId });
        }
      } else if (callStatus === "outgoing" || callStatus === "active") {
        // User ended an ongoing call
        if (socket?.connected && remoteUserId) {
          socket.emit("call-end", { targetUserId: remoteUserId, callId });
        }
      }

      useCallStore.getState()._cleanup();
      _activeCallUUID = null;
    };

    // ── didLoadWithEvents — handles events fired while app was killed ─────
    const onDidLoadWithEvents = (events: any[]) => {
      console.log("[CallKeep] didLoadWithEvents:", events);
      for (const event of events) {
        if (event.name === "RNCallKeepPerformAnswerCallAction") {
          onAnswerCall({ callUUID: event.data.callUUID });
        } else if (event.name === "RNCallKeepPerformEndCallAction") {
          onEndCall({ callUUID: event.data.callUUID });
        }
      }
    };

    RNCallKeep.addEventListener("answerCall", onAnswerCall);
    RNCallKeep.addEventListener("endCall", onEndCall);
    RNCallKeep.addEventListener("didLoadWithEvents", onDidLoadWithEvents);

    // Muted/unmuted from lock screen
    RNCallKeep.addEventListener("didPerformSetMutedCallAction", ({ muted }: { muted: boolean }) => {
      const { isMuted, toggleMute } = useCallStore.getState();
      // Only toggle if state doesn't match
      if (isMuted !== muted) toggleMute();
    });

    return () => {
      RNCallKeep.removeEventListener("answerCall", onAnswerCall);
      RNCallKeep.removeEventListener("endCall", onEndCall);
      RNCallKeep.removeEventListener("didLoadWithEvents", onDidLoadWithEvents);
      RNCallKeep.removeEventListener("didPerformSetMutedCallAction");
    };
  }, []);

  // ── Listen for incoming-call push notifications (background state) ───────
  // When the app is in background, the socket is disconnected so the
  // incoming-call socket event doesn't fire. The push notification arrives
  // via FCM. We intercept it here and show the native CallKeep UI.
  useEffect(() => {
    if (Platform.OS !== "android" || !RNCallKeep) return;

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      if (data?.type !== "incoming-call") return;

      // Only trigger the native call UI if app is backgrounded
      const state = AppState.currentState;
      if (state === "active") {
        // App is foreground — socket event already fired IncomingCallModal
        return;
      }

      console.log("[CallKeep] Push received in background — showing native call UI");

      // Store call info in Zustand so the modal is ready when app foregrounds
      useCallStore.getState().setIncomingCallFromPush({
        callerId: data.callerId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        callType: data.callType ?? "audio",
        callId: data.callId,
      });

      // Show the OS-level incoming call screen
      displayIncomingCallViaCallKeep({
        callerId: data.callerId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        callType: data.callType ?? "audio",
        callId: data.callId,
      });
    });

    return () => sub.remove();
  }, []);
}

// ── Alias export so existing _layout.tsx import continues to work ─────────
export { useCallKeep as useCallNotification };
