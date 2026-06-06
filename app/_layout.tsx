import AuthSync from "@/components/AuthSync";
import SocketConnection from "@/components/SocketConnection";
import { ThemeProvider } from "@/constants/Theme";
import { useNotifications } from "@/hooks/useNotifications";
import { useCallNotification } from "@/hooks/useCallKeep";
import { useTheme } from "@/hooks/useTheme";
import IncomingCallModal from "@/components/IncomingCallModal";
import OutgoingCallScreen from "@/components/OutgoingCallScreen";
import ActiveCallScreen from "@/components/ActiveCallScreen";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import "react-native-get-random-values"; // MUST BE THE VERY FIRST IMPORT!

// ─────────────────────────────────────────────
// Token cache
// ─────────────────────────────────────────────
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

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

const queryClient = new QueryClient();

// ─────────────────────────────────────────────
// PushNotificationSetup
// Separate component so it only calls useNotifications() once the
// user is authenticated (isSignedIn=true), guaranteeing that
// Clerk's getToken() returns a valid JWT for the PATCH /users/fcm-token call.
// ─────────────────────────────────────────────
function PushNotificationSetup() {
  useNotifications();
  return null;
}

// CallKeepSetup initializes the native VoIP ConnectionService and event
// listeners. Must run unconditionally (before sign-in) so that killed-app
// call notification responses are handled immediately on cold start.
function CallNotificationSetup() {
  useCallNotification();
  return null;
}

// ─────────────────────────────────────────────
// AppContent — rendered inside all providers
// ─────────────────────────────────────────────
function AppContent() {
  const { isSignedIn } = useAuth();
  const { colors } = useTheme();

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
          name="sso-callback"
          options={{
            animation: "fade",
            headerShown: false,
          }}
        />
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
// Root layout
// ─────────────────────────────────────────────
export default Sentry.wrap(function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
});
