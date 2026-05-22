import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

/**
 * SSO Callback handler page.
 * Clerk redirects here after OAuth (Google/Apple) via the deep link:
 *   mobile://sso-callback?created_session_id=...&rotating_token_nonce=...
 *
 * This page waits for Clerk to finish processing the session and then
 * navigates the user to the correct screen.
 */
export default function SSOCallback() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      // Auth successful → go to main app
      router.replace("/(tabs)");
    } else {
      // Something went wrong → back to auth screen
      router.replace("/(auth)");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F4A261" />
      <Text style={styles.text}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0F",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  text: {
    color: "#A0A0A5",
    fontSize: 16,
    fontWeight: "500",
  },
});
