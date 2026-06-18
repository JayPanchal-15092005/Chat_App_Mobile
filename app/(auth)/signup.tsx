import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/hooks/useAuthStore";
import axios from "axios";

// Fallback to the same logic in axios.ts
const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://chat-app-backend-zj3i.onrender.com"
).replace(/^["']|["']$/g, "");
const API_URL = `${API_BASE}/api`;

const SignupScreen = () => {
  const { setAuth } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        name,
        email,
        password,
      });
      const { token, ...user } = response.data;
      await setAuth(token, user);
      // Layout component automatically redirects because of auth state change
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to sign up";
      Alert.alert("Signup Failed", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
               <Ionicons name="arrow-back" size={24} color="#FFF" />
            </Pressable>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="sparkles" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>Create an account✨</Text>
              <Text style={styles.subtitle}>Welcome! Please enter your details.</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Name Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your name"
                    placeholderTextColor="#888"
                    autoCapitalize="words"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>

              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#888"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#888"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#888" />
                  </Pressable>
                </View>
              </View>

              {/* Password Requirement */}
              <View style={styles.rememberRow}>
                <View style={styles.checkboxContainer}>
                  <Ionicons 
                    name={password.length >= 8 ? "checkmark-circle" : "ellipse-outline"} 
                    size={20} 
                    color={password.length >= 8 ? "#10B981" : "#555"} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.rememberText}>Must be at least 8 characters</Text>
                </View>
              </View>

              {/* Signup Button */}
              <Pressable onPress={handleSignup} disabled={isLoading}>
                <LinearGradient
                  colors={["#E76F51", "#833AB4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signupButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.signupButtonText}>Sign Up</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    marginBottom: 20,
  },
  header: {
    marginBottom: 30,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888888",
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#555",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#E76F51",
    borderColor: "#E76F51",
  },
  rememberText: {
    color: "#AAAAAA",
    fontSize: 14,
  },
  signupButton: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  signupButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default SignupScreen;
