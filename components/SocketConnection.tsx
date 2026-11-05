import { useAuthStore } from "@/hooks/useAuthStore";
import { useSocketStore } from "@/lib/socket";
import { useEffect } from "react";
import { AppState } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// SocketConnection — mounts at the root level to maintain global socket
// Automatically connects/disconnects based on auth state and app state.
// ─────────────────────────────────────────────────────────────────────────────
const SocketConnection = () => {
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const { token, user } = useAuthStore();

  useEffect(() => {
    // 1. If signed out, ensure disconnected
    if (!token || !user) {
      disconnect();
      return;
    }

    // 2. We are signed in. Define exactly how to connect using custom JWT.
    const ensureConnected = async () => {
      try {
        connect(token);
      } catch (error) {
        console.error("[SocketConnection] Failed to get custom token:", error);
      }
    };

    // 3. Connect immediately if app is in foreground
    if (AppState.currentState === "active") {
      ensureConnected();
    }

    // 4. Listen for background/foreground transitions with grace period
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        ensureConnected();
      } else if (state === "background") {
        // 30s grace period so quick app switching (camera, photos, notifications) keeps socket alive
        if (backgroundTimer) clearTimeout(backgroundTimer);
        backgroundTimer = setTimeout(() => {
          disconnect();
          backgroundTimer = null;
        }, 30000);
      }
    });

    return () => {
      if (backgroundTimer) clearTimeout(backgroundTimer);
      sub.remove();
      disconnect();
    };
  }, [token, user, connect, disconnect]);

  return null;
};

export default SocketConnection;
