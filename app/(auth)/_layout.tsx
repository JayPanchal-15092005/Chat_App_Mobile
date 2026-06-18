import { useAuthStore } from "@/hooks/useAuthStore";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// AuthLayout
// Uses Zustand store to redirect signed-in users to (tabs), shows auth screens otherwise
// ─────────────────────────────────────────────────────────────────────────────
const AuthLayout = () => {
  const { token, isLoading } = useAuthStore();

  // Still loading the token from secure storage
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#121212", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#F4A261" />
      </View>
    );
  }

  // Already signed in → redirect to main app
  if (token) return <Redirect href={"/(tabs)"} />;

  // Not signed in → show auth screens (index = login, signup = email signup)
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
};

export default AuthLayout;
