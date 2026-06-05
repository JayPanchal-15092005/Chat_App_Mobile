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
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

const { width, height } = Dimensions.get("window");

const OutgoingCallScreen = () => {
  const { callStatus, remoteUserName, remoteUserAvatar, callType, endCall } = useCallStore();
  const { colors } = useTheme();

  const pulse = useSharedValue(1);
  const dotOpacity = useSharedValue(0);

  useEffect(() => {
    if (callStatus === "outgoing") {
      // Pulse animation around avatar
      pulse.value = withRepeat(
        withTiming(1.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      // Animated dots effect
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.3, { duration: 600 }),
        ),
        -1,
        true
      );
    } else {
      pulse.value = 1;
      dotOpacity.value = 0;
    }
  }, [callStatus]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  if (callStatus !== "outgoing") return null;

  return (
    <View style={styles.container}>
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={styles.title}>
          {callType === "video" ? "Video" : "Audio"} Call
        </Text>

        <View style={styles.avatarContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              pulseStyle,
              { borderColor: colors.primary.default },
            ]}
          />
          {remoteUserAvatar ? (
            <Image
              source={{ uri: remoteUserAvatar }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: colors.surface.light },
              ]}
            >
              <Ionicons
                name="person"
                size={60}
                color={colors.subtleForeground}
              />
            </View>
          )}
        </View>

        <Text style={styles.name}>{remoteUserName || "Someone"}</Text>

        <View style={styles.callingRow}>
          <Text style={styles.callingText}>Calling</Text>
          <Animated.Text style={[styles.callingText, dotStyle]}>...</Animated.Text>
        </View>

        <View style={styles.endCallContainer}>
          <Pressable style={styles.endCallButton} onPress={endCall}>
            <Ionicons
              name="call"
              size={32}
              color="#fff"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
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
    zIndex: 9997,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  content: {
    alignItems: "center",
    zIndex: 1,
    flex: 1,
    justifyContent: "center",
    width: "100%",
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
    marginBottom: 8,
  },
  callingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 80,
  },
  callingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 18,
  },
  endCallContainer: {
    position: "absolute",
    bottom: 80,
    alignItems: "center",
    width: "100%",
  },
  endCallButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default OutgoingCallScreen;
