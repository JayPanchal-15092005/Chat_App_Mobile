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
        connect(token, user._id);
      } catch (error) {
        console.error("[SocketConnection] Failed to get custom token:", error);
      }
    };

    // 3. Connect immediately if app is in foreground
    if (AppState.currentState === "active") {
      ensureConnected();
    }

    // 4. Listen for background/foreground transitions
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        ensureConnected();
      } else if (state === "background") {
        // Render spins down unused sockets anyway, but explicit disconnect saves mobile battery
        disconnect();
      }
    });

    return () => {
      sub.remove();
      disconnect();
    };
  }, [token, user, connect, disconnect]);

  return null;
};

export default SocketConnection;
