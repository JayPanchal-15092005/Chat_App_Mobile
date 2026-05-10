import { AnimatedOrb } from "@/components/AnimatedOrb";
import { Colors } from "@/constants/Colors";
import useAuthSocial from "@/hooks/useSocialAuth";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const AuthScreen = () => {
  const { handleSocialAuth, loadingStrategy } = useAuthSocial();
  const isLoading = loadingStrategy !== null;

  return (
    <View style={styles.container}>
      <View style={styles.backgroundWrapper}>
        <LinearGradient
          colors={["#0D0D0F", "#1A1A2E", "#16213E", "#0D0D0F"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <AnimatedOrb
          colors={["#F4A261", "#E76F51"]}
          size={300}
          initialX={-80}
          initialY={height * 0.1}
          duration={4000}
        />
        <AnimatedOrb
          colors={["#E76F51", "#F4A261"]}
          size={250}
          initialX={width - 100}
          initialY={height * 0.3}
          duration={5000}
        />
        <AnimatedOrb
          colors={["#FFD7BA", "#F4A261"]}
          size={200}
          initialX={width * 0.3}
          initialY={height * 0.6}
          duration={3500}
        />
        <AnimatedOrb
          colors={["#F4B183", "#E76F51"]}
          size={180}
          initialX={-50}
          initialY={height * 0.75}
          duration={4500}
        />

        <BlurView
          intensity={70}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Top Section - Branding */}
        <View style={styles.brandingContainer}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.brandText}>Whisper</Text>
        </View>

        {/* CENTER SECTION - HERO IMG */}
        <View style={styles.centerSection}>
          <Image
            source={require("@/assets/images/auth.png")}
            style={styles.heroImage}
            contentFit="contain"
          />

          {/* Headline */}
          <View style={styles.headlineContainer}>
            <Text style={styles.headlineMain}>Connect & Chat</Text>
            <Text style={styles.headlineSub}>Seamlessly</Text>
          </View>

          {/* AUTH BUTTONS */}
          <View style={styles.buttonGroup}>
            {/* GOOGLE BTN */}
            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.buttonPressed, // This handles the active:scale-[0.97]
              ]}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              onPress={() => !isLoading && handleSocialAuth("oauth_google")}
            >
              {loadingStrategy === "oauth_google" ? (
                <ActivityIndicator size="small" color="#1a1a1a" />
              ) : (
                <>
                  <Image
                    source={require("@/assets/images/google.png")}
                    style={styles.googleIcon}
                    contentFit="contain"
                  />
                  <Text style={styles.googleButtonText}>Google</Text>
                </>
              )}
            </Pressable>

            {/* APPLE BTN */}
            <Pressable
              style={({ pressed }) => [
                styles.appleButton,
                pressed && styles.buttonPressed, // This handles the active:scale-[0.97]
              ]}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
              onPress={() => !isLoading && handleSocialAuth("oauth_apple")}
            >
              {loadingStrategy === "oauth_apple" ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                  <Text style={styles.appleButtonText}>Apple</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

// --- Your Standard StyleSheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.dark,
  },
  backgroundWrapper: {
    ...StyleSheet.absoluteFillObject, // Replaces "absolute inset-0"
    overflow: "hidden",
  },
  safeArea: {
    flex: 1,
  },
  brandingContainer: {
    alignItems: "center",
    paddingTop: 40, // Replaces "pt-10"
  },
  logo: {
    width: 100,
    height: 100,
    marginVertical: -20,
  },
  brandText: {
    fontSize: 36, // Replaces "text-4xl"
    fontWeight: "bold",
    color: Colors.primary.default,
    fontFamily: "serif",
    letterSpacing: 2, // Replaces "tracking-wider"
    textTransform: "uppercase",
  },
  centerSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24, // Replaces "px-6"
  },
  heroImage: {
    width: width - 48,
    height: height * 0.3,
  },
  headlineContainer: {
    marginTop: 24, // Replaces "mt-6"
    alignItems: "center",
  },
  headlineMain: {
    fontSize: 48, // Replaces "text-5xl"
    fontWeight: "bold",
    color: Colors.foreground,
    textAlign: "center",
    // fontFamily: "sans-serif", // Optional depending on your setup
  },
  headlineSub: {
    fontSize: 30, // Replaces "text-3xl"
    fontWeight: "bold",
    color: Colors.primary.default,
    // fontFamily: "monospace", // Optional depending on your setup
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 16, // Replaces "gap-4"
    marginTop: 40, // Replaces "mt-10"
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }], // Replaces "active:scale-[0.97]"
  },
  googleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8, // Replaces "gap-2"
    backgroundColor: "rgba(255, 255, 255, 0.95)", // Replaces "bg-white/95"
    paddingVertical: 16, // Replaces "py-4"
    borderRadius: 16, // Replaces "rounded-2xl"
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: "#111827", // Replaces "text-gray-900"
    fontWeight: "600",
    fontSize: 14, // Replaces "text-sm"
  },
  appleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)", // Replaces "bg-white/10"
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)", // Replaces "border-white/20"
  },
  appleButtonText: {
    color: Colors.foreground,
    fontWeight: "600",
    fontSize: 14,
  },
});

export default AuthScreen;
