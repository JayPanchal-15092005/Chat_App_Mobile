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
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    // 1. If signed out, ensure disconnected
    if (!token) {
      disconnect();
      return;
    }

    // 2. We are signed in. Connect immediately.
    console.log("[SocketConnection] Signed in with token, connecting socket...");
    connect(token);

    // 3. Listen for app foregrounding to re-check connection
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        console.log("[SocketConnection] App became active, ensuring socket is connected...");
        connect(token);
      }
    });

    return () => {
      sub.remove();
      // Only disconnect on unmount if token is actually gone
      if (!useAuthStore.getState().token) {
        disconnect();
      }
    };
  }, [token, connect, disconnect]);

  return null;
};

export default SocketConnection;
