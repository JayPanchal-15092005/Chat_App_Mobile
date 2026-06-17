import { useAuthCallback } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import * as Sentry from "@sentry/react-native";
import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// AuthSync
// Replaces Clerk's useAuth/useUser with Firebase onAuthStateChanged
// Syncs the Firebase user with our backend on first sign-in
// ─────────────────────────────────────────────────────────────────────────────
const AuthSync = () => {
  const { mutate: syncUser } = useAuthCallback();
  const hasSynced = useRef(false);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      if (firebaseUser && !hasSynced.current) {
        hasSynced.current = true;

        syncUser(undefined, {
          onSuccess: (data) => {
            console.log("✅ User synced with backend:", data.name);
            Sentry.logger.info(
              Sentry.logger.fmt`User synced with backend: ${data.name}`,
              {
                userId: firebaseUser.uid,
                userName: data.name,
              },
            );
          },
          onError: (error) => {
            console.log("❌ User sync failed:", error);
            hasSynced.current = false; // allow retry
            Sentry.logger.error("Failed to sync user with backend", {
              userId: firebaseUser.uid,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        });
      }

      if (!firebaseUser) {
        hasSynced.current = false;
      }
    });

    return () => unsubscribe();
  }, [syncUser]);

  return null;
};

export default AuthSync;
