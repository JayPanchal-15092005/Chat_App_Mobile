// import AuthSync from "@/components/AuthSync";
// import SocketConnection from "@/components/SocketConnection";
// import { ClerkProvider } from "@clerk/clerk-expo";
// import * as Sentry from "@sentry/react-native";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { Stack } from "expo-router";
// import { StatusBar } from "expo-status-bar";
// import "react-native-get-random-values";

// Sentry.init({
//   dsn: "https://72de6216171a67c2fade61ea7b5063bf@o4509388699467776.ingest.de.sentry.io/4511398826803280",

//   // Adds more context data to events (IP address, cookies, user, etc.)
//   // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
//   sendDefaultPii: true,

//   // Enable Logs
//   enableLogs: true,

//   // Configure Session Replay
//   replaysSessionSampleRate: 0.1,
//   replaysOnErrorSampleRate: 1,
//   integrations: [
//     Sentry.mobileReplayIntegration({ maskAllImages: false }),

//     Sentry.reactNativeTracingIntegration({
//       traceFetch: true,
//       traceXHR: true,
//       enableHTTPTimings: true,
//     }),
//   ],

//   // uncomment the line below to enable Spotlight (https://spotlightjs.com)
//   // spotlight: __DEV__,
// });

// const queryClient = new QueryClient();

// export default Sentry.wrap(function RootLayout() {
//   return (
//     <ClerkProvider>
//       <QueryClientProvider client={queryClient}>
//         <AuthSync />
//         <SocketConnection />
//         <StatusBar style="light" />
//         <Stack
//           screenOptions={{
//             headerShown: false,
//             contentStyle: { backgroundColor: "#0D0D0F" },
//           }}
//         >
//           <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
//           <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
//           <Stack.Screen
//             name="new-chat"
//             options={{
//               animation: "slide_from_bottom",
//               presentation: "modal",
//               gestureEnabled: true,
//             }}
//           />
//         </Stack>
//       </QueryClientProvider>
//     </ClerkProvider>
//   );
// });

import AuthSync from "@/components/AuthSync";
import SocketConnection from "@/components/SocketConnection";
import { ClerkProvider } from "@clerk/clerk-expo";
import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store"; // Imported Secure Store
import { StatusBar } from "expo-status-bar";
import "react-native-get-random-values"; // MUST BE THE VERY FIRST IMPORT!

// Create the Token Cache for Mobile
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

export default Sentry.wrap(function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        <SocketConnection />
        <StatusBar style="light" />
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
      </QueryClientProvider>
    </ClerkProvider>
  );
});
