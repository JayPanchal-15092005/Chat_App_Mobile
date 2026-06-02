import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useCallStore } from "@/lib/callStore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

const { width, height } = Dimensions.get("window");

const IncomingCallModal = () => {
  const { callStatus, remoteUserName, remoteUserAvatar, callType, acceptCall, rejectCall } = useCallStore();
  const { colors } = useTheme();

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (callStatus === "incoming") {
      pulse.value = withRepeat(
        withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [callStatus]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  if (callStatus !== "incoming") return null;

  return (
    <View style={styles.container}>
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.title}>Incoming {callType === "video" ? "Video" : "Audio"} Call</Text>

        <View style={styles.avatarContainer}>
          <Animated.View style={[styles.pulseRing, animatedStyle, { borderColor: colors.primary.default }]} />
          {remoteUserAvatar ? (
            <Image source={{ uri: remoteUserAvatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface.light }]}>
              <Ionicons name="person" size={60} color={colors.subtleForeground} />
            </View>
          )}
        </View>

        <Text style={styles.name}>{remoteUserName || "Someone"}</Text>

        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={rejectCall}>
            <Ionicons name="close" size={32} color="#fff" />
          </Pressable>
          <Pressable style={[styles.actionButton, styles.acceptButton]} onPress={acceptCall}>
            <Ionicons name="call" size={32} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  content: {
    alignItems: "center",
    zIndex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 40,
    opacity: 0.8,
  },
  avatarContainer: {
    width: 150,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  pulseRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 60,
  },
  actions: {
    flexDirection: "row",
    gap: 60,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "#FF3B30",
  },
  acceptButton: {
    backgroundColor: "#34C759",
  },
});

export default IncomingCallModal;
