import { Colors } from "@/constants/Colors";
import useFirebaseAuth from "@/hooks/useFirebaseAuth";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

const SignupScreen = () => {
  const { signUpWithEmail, signInWithEmail, loading } = useFirebaseAuth();
  const [isSignUp, setIsSignUp] = useState(true); // toggle between Sign Up / Sign In
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isLoading = loading !== null;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (isSignUp) {
      if (!displayName.trim()) return;
      await signUpWithEmail(email.trim(), password, displayName.trim());
    } else {
      await signInWithEmail(email.trim(), password);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.backgroundWrapper}>
        <LinearGradient
          colors={["#0D0D0F", "#1A1A2E", "#16213E", "#0D0D0F"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Back button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {isSignUp ? "Create Account" : "Welcome Back"}
              </Text>
              <Text style={styles.subtitle}>
                {isSignUp
                  ? "Sign up to start chatting"
                  : "Sign in to continue"}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Name field — only for sign up */}
              {isSignUp && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color={Colors.mutedForeground} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Your name"
                      placeholderTextColor={Colors.mutedForeground}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      editable={!isLoading}
                    />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={Colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.mutedForeground}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Min. 6 characters"
                    placeholderTextColor={Colors.mutedForeground}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={Colors.mutedForeground}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Submit button */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isSignUp ? "Create Account" : "Sign In"}
                  </Text>
                )}
              </Pressable>

              {/* Toggle sign up / sign in */}
              <Pressable
                onPress={() => setIsSignUp(!isSignUp)}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleText}>
                  {isSignUp ? "Already have an account? " : "Don't have an account? "}
                  <Text style={styles.toggleTextBold}>
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface.dark },
  backgroundWrapper: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  backButton: {
    padding: 16,
    alignSelf: "flex-start",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: Colors.foreground,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: Colors.mutedForeground,
    marginTop: 8,
    textAlign: "center",
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.foreground,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  inputIcon: {
    width: 20,
  },
  input: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 15,
  },
  eyeIcon: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: Colors.primary.default,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  toggleButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleText: {
    color: Colors.mutedForeground,
    fontSize: 14,
  },
  toggleTextBold: {
    color: Colors.primary.default,
    fontWeight: "700",
  },
});

export default SignupScreen;
