import { auth, GoogleSignin } from "@/lib/firebase";
import { useState } from "react";
import { Alert } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// useFirebaseAuth
// Handles Google Sign-In + Email/Password auth via Firebase
// Replaces the old Clerk-based useSocialAuth hook
// ─────────────────────────────────────────────────────────────────────────────
function useFirebaseAuth() {
  const [loading, setLoading] = useState<"google" | "email" | null>(null);

  // ── Google Sign-In ─────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    if (loading) return;
    setLoading("google");
    try {
      // Check if Google Play Services are available (Android)
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Start the Google sign-in flow — native popup, no browser redirect
      const signInResult = await GoogleSignin.signIn();

      // Get the idToken from Google
      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error("No ID token from Google");

      // Create Firebase credential and sign in
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);

      // Firebase onAuthStateChanged in _layout.tsx will handle the rest
    } catch (error: any) {
      console.error("[FirebaseAuth] Google sign-in error:", error);
      if (error.code !== "SIGN_IN_CANCELLED") {
        Alert.alert(
          "Google Sign-In Failed",
          "Could not sign in with Google. Please try again.",
        );
      }
    } finally {
      setLoading(null);
    }
  };

  // ── Email / Password Sign-In ───────────────────────────────────────────────
  const signInWithEmail = async (email: string, password: string) => {
    if (loading) return;
    setLoading("email");
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (error: any) {
      console.error("[FirebaseAuth] Email sign-in error:", error);
      let message = "Failed to sign in. Please try again.";
      if (error.code === "auth/user-not-found") message = "No account found with this email.";
      if (error.code === "auth/wrong-password") message = "Incorrect password.";
      if (error.code === "auth/invalid-email") message = "Invalid email address.";
      if (error.code === "auth/invalid-credential") message = "Incorrect email or password.";
      Alert.alert("Sign-In Failed", message);
    } finally {
      setLoading(null);
    }
  };

  // ── Email / Password Sign-Up ───────────────────────────────────────────────
  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    if (loading) return;
    setLoading("email");
    try {
      const { user } = await auth().createUserWithEmailAndPassword(email, password);
      // Set display name on the Firebase user
      await user.updateProfile({ displayName });
    } catch (error: any) {
      console.error("[FirebaseAuth] Email sign-up error:", error);
      let message = "Failed to create account. Please try again.";
      if (error.code === "auth/email-already-in-use") message = "An account already exists with this email.";
      if (error.code === "auth/weak-password") message = "Password should be at least 6 characters.";
      if (error.code === "auth/invalid-email") message = "Invalid email address.";
      Alert.alert("Sign-Up Failed", message);
    } finally {
      setLoading(null);
    }
  };

  // ── Sign Out ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
      await GoogleSignin.signOut(); // clear Google session
      await auth().signOut();       // clear Firebase session
    } catch (error) {
      console.error("[FirebaseAuth] Sign-out error:", error);
    }
  };

  return {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    loading,
  };
}

export default useFirebaseAuth;
