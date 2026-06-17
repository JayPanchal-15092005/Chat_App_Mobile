import { auth } from "@/lib/firebase";
import { useSocketStore } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useCallStore } from "@/lib/callStore";

// ─────────────────────────────────────────────────────────────────────────────
// SocketConnection
// Replaces Clerk's useAuth with Firebase onAuthStateChanged
// Connects socket with Firebase ID token when user is signed in
// ─────────────────────────────────────────────────────────────────────────────
const SocketConnection = () => {
  const queryClient = useQueryClient();
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in — get Firebase ID token
        const token = await firebaseUser.getIdToken();
        if (token) {
          connect(token, queryClient);
          // Always init call listeners when connecting
          useCallStore.getState().initCallListeners();
        }
      } else {
        // User signed out — cleanup everything
        useCallStore.getState()._cleanup();
        disconnect();
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribeRef.current?.();
      useCallStore.getState()._cleanup();
      disconnect();
    };
  }, [connect, disconnect, queryClient]);

  return null;
};

export default SocketConnection;
