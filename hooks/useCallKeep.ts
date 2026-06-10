/**
 * useCallKeep.ts
 *
 * Production-ready VoIP / CallKeep integration for Android.
 * Uses Android's ConnectionService for system-level incoming call UI that
 * works on lock screen, background, and killed app states.
 *
 * INSTALLATION:
 *   npx expo install react-native-callkeep @config-plugins/react-native-callkeep
 *   eas build --profile development --platform android
 */

import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { getMessaging, onMessage } from "@react-native-firebase/messaging";
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
    "[CallKeep] react-native-callkeep not found.\n" +
    "Run: npx expo install react-native-callkeep @config-plugins/react-native-callkeep\n" +
    "Then: eas build --profile development --platform android"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CallKeep setup options
// ─────────────────────────────────────────────────────────────────────────────
const CALLKEEP_OPTIONS = {
  ios: {
    appName: "chat-app",
    maximumCallGroups: "1",
    maximumCallsPerCallGroup: "1",
    supportsVideo: false,
    includesCallsInRecents: false,
  },
  android: {
    alertTitle: "Phone Account Permission",
    alertDescription:
      "Allow chat-app to manage phone calls for incoming call notifications.",
    cancelButton: "Cancel",
    okButton: "Allow",
    imageName: "ic_launcher",
    additionalPermissions: [],
    // Foreground service keeps the call alive when app is backgrounded (Android 11+)
    foregroundService: {
      channelId: "com.ketan_panchal.chatapp.call",
      channelName: "Incoming Calls",
      notificationTitle: "Incoming Call",
      notificationIcon: "ic_launcher",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Global mutable state — kept outside React to work in event handlers
// ─────────────────────────────────────────────────────────────────────────────
let _activeCallUUID: string | null = null;

/**
 * Generate a proper RFC-4122 UUID v4.
 * CallKeep requires a valid UUID format.
 */
function generateUUIDv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// displayIncomingCallViaCallKeep
// ─────────────────────────────────────────────────────────────────────────────
const _displayedCallIds = new Set<string>();

export function displayIncomingCallViaCallKeep(data: {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType?: "audio" | "video";
  callId?: string;
}) {
  if (!RNCallKeep || Platform.OS !== "android") return;

  // 1. Deduplication: Prevent showing UI twice for the same call
  if (data.callId) {
    if (_displayedCallIds.has(data.callId)) {
      console.log(`[CallKeep] UI already shown for call ${data.callId} - skipping duplicate.`);
      return;
    }
    _displayedCallIds.add(data.callId);
    
    // Clear cache after 60s
    setTimeout(() => {
      _displayedCallIds.delete(data.callId as string);
    }, 60000);
  }

  // Dismiss any existing call UI before showing a new one
  if (_activeCallUUID) {
    try {
      RNCallKeep.endCall(_activeCallUUID);
    } catch { /* ignore */ }
  }

  const uuid = generateUUIDv4();
  _activeCallUUID = uuid;

  const isVideo = data.callType === "video"; // ✅ Fixed: was `!== "video"`
  const callerName = data.callerName || "Unknown Caller";

  console.log(`[CallKeep] displayIncomingCall — name: "${callerName}", uuid: ${uuid}, video: ${isVideo}`);

  RNCallKeep.displayIncomingCall(
    uuid,            // callUUID (required, must be UUID v4)
    data.callerId,   // handle — the caller's user ID (shown as subtitle on some devices)
    callerName,      // localizedCallerName — shown as main title ✅
    "generic",       // handleType: "number" | "email" | "generic"
    isVideo,         // hasVideo ✅ Fixed
  );

  // Additional: update the display with the avatar if the library supports it
  try {
    RNCallKeep.updateDisplay(uuid, callerName, data.callerId, {
      ios: {},
      android: {},
    });
  } catch { /* optional API — safe to ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// endCallViaCallKeep — dismiss the native call UI
// ─────────────────────────────────────────────────────────────────────────────
export function endCallViaCallKeep() {
  if (!RNCallKeep || !_activeCallUUID) return;
  try {
    RNCallKeep.endCall(_activeCallUUID);
    console.log("[CallKeep] endCall:", _activeCallUUID);
  } catch (e) {
    console.warn("[CallKeep] endCall error:", e);
  }
  _activeCallUUID = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// useCallKeep — mount this in _layout.tsx inside AppContent
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
      // Bridge: allows callStore.endCall() / rejectCall() to dismiss native UI
      __registerCallKeepEndCall(endCallViaCallKeep);
      console.log("[CallKeep] ✅ Setup complete.");
    } catch (e) {
      console.error("[CallKeep] Setup failed:", e);
    }
  }, []);

  // ── CallKeep event listeners ────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android" || !RNCallKeep) return;

    // ── answerCall — user tapped Accept on the OS call screen ────────────
    const onAnswerCall = ({ callUUID }: { callUUID: string }) => {
      console.log("[CallKeep] answerCall event:", callUUID);

      const { callStatus, incomingOffer } = useCallStore.getState();

      if (callStatus === "incoming" && incomingOffer) {
        useCallStore.getState().acceptCall();
      } else {
        // Offer not arrived yet — mark for auto-accept when socket reconnects
        useCallStore.getState().acceptCallFromPush();
      }

      // Notify CallKeep that we answered (moves call from ringing → active in OS)
      RNCallKeep.answerIncomingCall(callUUID);
    };

    // ── endCall — user tapped Decline OR called ended by OS ──────────────
    const onEndCall = ({ callUUID, reason }: { callUUID: string; reason?: number }) => {
      console.log("[CallKeep] endCall event:", callUUID, "reason:", reason);

      const { remoteUserId, callId, callStatus } = useCallStore.getState();
      const socket = useSocketStore.getState().socket;

      if (callStatus === "incoming") {
        if (socket?.connected && remoteUserId) {
          socket.emit("call-reject", { targetUserId: remoteUserId, callId });
        }
      } else if (callStatus === "outgoing" || callStatus === "active") {
        if (socket?.connected && remoteUserId) {
          socket.emit("call-end", { targetUserId: remoteUserId, callId });
        }
      }

      _activeCallUUID = null;
      useCallStore.getState()._cleanup();
    };

    // ── didLoadWithEvents — replay events from when app was killed ────────
    const onDidLoadWithEvents = (events: any[]) => {
      console.log("[CallKeep] didLoadWithEvents:", events?.length, "events");
      if (!Array.isArray(events)) return;

      for (const event of events) {
        if (event.name === "RNCallKeepPerformAnswerCallAction") {
          onAnswerCall({ callUUID: event.data?.callUUID });
        } else if (event.name === "RNCallKeepPerformEndCallAction") {
          onEndCall({ callUUID: event.data?.callUUID });
        }
      }
    };

    // ── didPerformSetMutedCallAction — mute from lock screen ─────────────
    const onMuteToggle = ({ muted, callUUID }: { muted: boolean; callUUID: string }) => {
      console.log("[CallKeep] mute toggle:", muted, callUUID);
      const { isMuted, toggleMute } = useCallStore.getState();
      if (isMuted !== muted) toggleMute();
    };

    RNCallKeep.addEventListener("answerCall", onAnswerCall);
    RNCallKeep.addEventListener("endCall", onEndCall);
    RNCallKeep.addEventListener("didLoadWithEvents", onDidLoadWithEvents);
    RNCallKeep.addEventListener("didPerformSetMutedCallAction", onMuteToggle);

    return () => {
      RNCallKeep.removeEventListener("answerCall", onAnswerCall);
      RNCallKeep.removeEventListener("endCall", onEndCall);
      RNCallKeep.removeEventListener("didLoadWithEvents", onDidLoadWithEvents);
      RNCallKeep.removeEventListener("didPerformSetMutedCallAction", onMuteToggle);
    };
  }, []);

  // ── Foreground FCM Data Push → Native CallKeep call screen ──────────────
  // When app is active/backgrounded (but JS is running), FCM data messages trigger this.
  // We use this to bridge VoIP calls natively.
  useEffect(() => {
    if (Platform.OS !== "android" || !RNCallKeep) return;

    const unsubscribe = onMessage(getMessaging(), async (remoteMessage) => {
      const data = remoteMessage.data;
      if (data?.type !== "incoming-call") return;

      const appCurrentState = AppState.currentState;
      if (appCurrentState === "active") {
        // Foreground — socket already fired IncomingCallModal. Nothing to do.
        return;
      }

      console.log("[CallKeep] FCM Data Push in background — showing native call UI");

      // Set Zustand state so the modal is ready when the app foregrounds
      const callType = (data.callType === "video" ? "video" : "audio") as "audio" | "video";
      useCallStore.getState().setIncomingCallFromPush({
        callerId:
          typeof data.callerId === "string"
            ? data.callerId
            : JSON.stringify(data.callerId),
        callerName:
          typeof data.callerName === "string"
            ? data.callerName
            : JSON.stringify(data.callerName),
        callerAvatar:
          typeof data.callerAvatar === "string"
            ? data.callerAvatar
            : JSON.stringify(data.callerAvatar),
        callType,
        callId:
          typeof data.callId === "string"
            ? data.callId
            : JSON.stringify(data.callId),
      });

      // Show OS-level incoming call screen
      displayIncomingCallViaCallKeep({
        callerId:
          typeof data.callerId === "string"
            ? data.callerId
            : JSON.stringify(data.callerId),
        callerName:
          typeof data.callerName === "string"
            ? data.callerName
            : JSON.stringify(data.callerName),
        callerAvatar:
          typeof data.callerAvatar === "string"
            ? data.callerAvatar
            : JSON.stringify(data.callerAvatar),
        callType,
        callId:
          typeof data.callId === "string"
            ? data.callId
            : JSON.stringify(data.callId),
      });
    });

    return unsubscribe;
  }, []);
}

// ── Alias for backward compatibility with existing _layout.tsx import ─────
export { useCallKeep as useCallNotification };
