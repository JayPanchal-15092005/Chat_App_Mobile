import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// ─────────────────────────────────────────────────────────────────────────────
// Configure Google Sign-In
// webClientId comes from google-services.json → oauth_client (type 3)
// Find it in Firebase Console → Project Settings → Web API Key
// ─────────────────────────────────────────────────────────────────────────────
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
});

export { auth, GoogleSignin };
