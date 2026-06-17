import AuthSync from "@/components/AuthSync";
import SocketConnection from "@/components/SocketConnection";
import { ThemeProvider } from "@/constants/Theme";
import { useNotifications } from "@/hooks/useNotifications";
import { useCallNotification } from "@/hooks/useCallKeep";
import { useTheme } from "@/hooks/useTheme";
import IncomingCallModal from "@/components/IncomingCallModal";
import OutgoingCallScreen from "@/components/OutgoingCallScreen";
import ActiveCallScreen from "@/components/ActiveCallScreen";
import { auth } from "@/lib/firebase";
import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-get-random-values"; // MUST BE THE VERY FIRST IMPORT!
import { useEffect, useState } from "react";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";

const queryClient = new QueryClient();

// ─────────────────────────────────────────────
// Sentry
// ─────────────────────────────────────────────
Sentry.init({
  dsn: "https://72de6216171a67c2fade61ea7b5063bf@o4509388699467776.ingest.de.sentry.io/4511398826803280",
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration({ maskAllImages: false }),
    Sentry.reactNativeTracingIntegration({
      traceFetch: true,
      traceXHR: true,
      enableHTTPTimings: true,
    }),
  ],
});

// ─────────────────────────────────────────────
// PushNotificationSetup
// Only runs after user is signed in
// ─────────────────────────────────────────────
function PushNotificationSetup() {
  useNotifications();
  return null;
}

// ─────────────────────────────────────────────
// CallNotificationSetup
// Must run unconditionally for killed-app call handling
// ─────────────────────────────────────────────
function CallNotificationSetup() {
  useCallNotification();
  return null;
}

// ─────────────────────────────────────────────
// AppContent — rendered inside all providers
// ─────────────────────────────────────────────
function AppContent() {
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseAuthTypes.User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    // Subscribe to Firebase auth state
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Don't render anything until Firebase has resolved the auth state
  if (authLoading) return null;

  const isSignedIn = !!firebaseUser;

  return (
    <>
      <StatusBar style={colors.isDark ? "light" : "dark"} backgroundColor={colors.surface.default} />
      <AuthSync />
      <SocketConnection />
      <CallNotificationSetup />
      {/* Only mount PushNotificationSetup after sign-in so apiWithAuth works */}
      {isSignedIn && <PushNotificationSetup />}
      <IncomingCallModal />
      <OutgoingCallScreen />
      <ActiveCallScreen />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0D0D0F" },
        }}
      >
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="new-chat"
          options={{
            animation: "slide_from_bottom",
            presentation: "modal",
            gestureEnabled: true,
          }}
        />
      </Stack>
    </>
  );
}

// ─────────────────────────────────────────────
// Root layout — ClerkProvider removed
// ─────────────────────────────────────────────
export default Sentry.wrap(function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
});
