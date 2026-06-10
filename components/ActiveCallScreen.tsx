import React from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useCallStore } from "@/lib/callStore";
import { RTCView } from "react-native-webrtc";
import { useTheme } from "@/hooks/useTheme";

const { width, height } = Dimensions.get("window");

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const ActiveCallScreen = () => {
  const {
    callStatus,
    callType,
    remoteUserName,
    remoteUserAvatar,
    localStream,
    remoteStream,
    isMuted,
    isSpeakerOn,
    callDurationSeconds,
    toggleMute,
    toggleSpeaker,
    endCall,
  } = useCallStore();

  const { colors } = useTheme();

  if (callStatus !== "active") return null;

  return (
    <View style={styles.container}>
      {callType === "video" && remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.audioBg}>
          {remoteUserAvatar ? (
            <Image source={{ uri: remoteUserAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface.light }]}>
              <Ionicons name="person" size={80} color={colors.subtleForeground} />
            </View>
          )}
          {/* CRITICAL: react-native-webrtc requires an RTCView to bind audio tracks even in audio-only calls */}
          {remoteStream && (
            <RTCView streamURL={remoteStream.toURL()} style={{ width: 0, height: 0, opacity: 0 }} />
          )}
        </View>
      )}

      {callType === "video" && localStream && (
        <View style={styles.localVideoContainer}>
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror />
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.name}>{remoteUserName || "Someone"}</Text>
        <Text style={styles.status}>{formatTime(callDurationSeconds)}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={[styles.controlButton, isMuted && styles.controlActive]} onPress={toggleMute}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color="#fff" />
        </Pressable>

        <Pressable style={[styles.controlButton, styles.endCallButton]} onPress={endCall}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>

        <Pressable style={[styles.controlButton, isSpeakerOn && styles.controlActive]} onPress={toggleSpeaker}>
          <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={28} color="#fff" />
        </Pressable>
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
    zIndex: 9998,
    backgroundColor: "#1A1A1A",
  },
  audioBg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  localVideoContainer: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  localVideo: {
    flex: 1,
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  avatarPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  name: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  status: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    marginTop: 8,
  },
  controls: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 30,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlActive: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  endCallButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FF3B30",
  },
});

export default ActiveCallScreen;
