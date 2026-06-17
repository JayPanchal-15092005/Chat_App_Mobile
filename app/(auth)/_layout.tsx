import { auth } from "@/lib/firebase";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";

// ─────────────────────────────────────────────────────────────────────────────
// AuthLayout
// Replaces Clerk's useAuth with Firebase onAuthStateChanged
// Redirects signed-in users to (tabs), shows auth screens otherwise
// ─────────────────────────────────────────────────────────────────────────────
const AuthLayout = () => {
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseAuthTypes.User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Still loading
  if (firebaseUser === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0D0D0F", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#F4A261" />
      </View>
    );
  }

  // Already signed in → redirect to main app
  if (firebaseUser) return <Redirect href={"/(tabs)"} />;

  // Not signed in → show auth screens (index = login, signup = email signup)
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
};

export default AuthLayout;
