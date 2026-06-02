import InCallManager from "react-native-incall-manager";
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";
import { create } from "zustand";
import { useSocketStore } from "./socket";

// Define RTCConfiguration locally since react-native-webrtc doesn't export it
interface RTCConfig {
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

export interface CallState {
  callStatus: "idle" | "calling" | "incoming" | "connected";
  callType: "audio" | "video" | null;
  remoteUserId: string | null;
  remoteUserName: string | null;
  remoteUserAvatar: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  callDurationSeconds: number;
  _callTimeoutId: any | null;
  _durationTimerId: any | null;
  pendingCandidates: any[];
  incomingOffer: any;

  initCallListeners: () => void;
  setIncomingCallFromPush: (data: {
    callerId: string;
    callerName: string;
    callerAvatar: string;
    callType: "audio" | "video";
  }) => void;
  startCall: (
    targetUserId: string,
    name: string,
    avatar: string,
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;

  _handleIncomingCall: (data: any) => void;
  _handleCallAnswer: (answer: any) => Promise<void>;
  _handleRemoteIceCandidate: (candidate: any) => Promise<void>;
  _cleanup: () => void;
}

const fetchIceServers = async (): Promise<RTCConfig> => {
  try {
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ||
      "https://chat-app-backend-zj3i.onrender.com";
    const response = await fetch(`${apiUrl}/api/turn/credentials`);
    const iceServers = await response.json();
    return { iceServers };
  } catch (err) {
    console.log("Failed to fetch TURN credentials, falling back to STUN only");
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
  }
};

export const useCallStore = create<CallState>((set, get) => ({
  callStatus: "idle",
  callType: null,
  remoteUserId: null,
  remoteUserName: null,
  remoteUserAvatar: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  isSpeakerOn: false,
  callDurationSeconds: 0,
  _callTimeoutId: null,
  _durationTimerId: null,
  pendingCandidates: [],
  incomingOffer: null,

  initCallListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    socket.on("incoming-call", (data) => {
      get()._handleIncomingCall(data);
    });

    socket.on("call-answer-forwarded", ({ answer }) => {
      get()._handleCallAnswer(answer);
    });

    socket.on("ice-candidate-forwarded", ({ candidate }) => {
      get()._handleRemoteIceCandidate(candidate);
    });

    socket.on("call-ended", () => {
      get()._cleanup();
    });
  },

  setIncomingCallFromPush: ({
    callerId,
    callerName,
    callerAvatar,
    callType,
  }) => {
    set({
      callStatus: "incoming",
      remoteUserId: callerId,
      remoteUserName: callerName,
      remoteUserAvatar: callerAvatar,
      callType,
    });
  },

  startCall: async (targetUserId, name, avatar) => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    try {
      // Request audio stream
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const iceConfig = await fetchIceServers();

      // Create peer connection with ICE servers
      const pc = new RTCPeerConnection({
        iceServers: iceConfig.iceServers,
      } as any);

      // Add audio tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates (cast to any due to incomplete react-native-webrtc types)
      (pc as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle remote stream
      (pc as any).ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      // Fallback for older react-native-webrtc versions
      (pc as any).onaddstream = (event: any) => {
        if (event.stream) {
          set({ remoteStream: event.stream });
        }
      };

      set({
        localStream: stream,
        peerConnection: pc,
        remoteUserId: targetUserId,
        remoteUserName: name,
        remoteUserAvatar: avatar,
        callType: "audio",
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const currentUserId = socket.id;

      socket.emit("call-offer", {
        targetUserId,
        callerId: currentUserId,
        offer,
        callType: "audio",
        callerName: "You",
        callerAvatar: "",
      });

      set({ callStatus: "calling" });

      // 60-second timeout
      const timeoutId = setTimeout(() => {
        if (get().callStatus === "calling") {
          console.log("[Call] No answer — timing out");
          socket.emit("call-end", { targetUserId });
          get()._cleanup();
        }
      }, 60_000);

      set({ _callTimeoutId: timeoutId });
    } catch (e) {
      console.error("Failed to start call", e);
      get()._cleanup();
    }
  },

  acceptCall: async () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, pendingCandidates } = get();
    if (!socket || !remoteUserId) return;

    if (get()._callTimeoutId) {
      clearTimeout(get()._callTimeoutId);
    }

    try {
      // Request audio stream
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const iceConfig = await fetchIceServers();

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: iceConfig.iceServers,
      } as any);

      // Add audio tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates (cast to any due to incomplete react-native-webrtc types)
      (pc as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            targetUserId: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle remote stream
      (pc as any).ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      // Fallback for older react-native-webrtc versions
      (pc as any).onaddstream = (event: any) => {
        if (event.stream) {
          set({ remoteStream: event.stream });
        }
      };

      set({
        localStream: stream,
        peerConnection: pc,
      });

      // Set remote description and create answer
      const { incomingOffer } = get();
      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call-answer", { targetUserId: remoteUserId, answer });

        // Flush pending ICE candidates
        for (const candidate of pendingCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding pending ice candidate:", err);
          }
        }
        set({ pendingCandidates: [] });

        // Start call audio management
        InCallManager.start({ media: "audio" });
        InCallManager.setKeepScreenOn(true);

        // Start duration timer
        const timerId = setInterval(() => {
          set((state) => ({
            callDurationSeconds: state.callDurationSeconds + 1,
          }));
        }, 1000);
        set({ _durationTimerId: timerId, callStatus: "connected" });
      }
    } catch (e) {
      console.error("Failed to accept call", e);
      get()._cleanup();
    }
  },

  rejectCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId } = get();
    if (socket && remoteUserId) {
      socket.emit("call-end", { targetUserId: remoteUserId });
    }
    get()._cleanup();
  },

  endCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId } = get();
    if (socket && remoteUserId) {
      socket.emit("call-end", { targetUserId: remoteUserId });
    }
    get()._cleanup();
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // if muted, enable (unmute); if not muted, disable (mute)
      });
      set({ isMuted: !isMuted });
    }
  },

  toggleSpeaker: () => {
    const next = !get().isSpeakerOn;
    InCallManager.setSpeakerphoneOn(next);
    set({ isSpeakerOn: next });
  },

  _handleIncomingCall: (data) => {
    set({
      callStatus: "incoming",
      remoteUserId: data.callerId,
      remoteUserName: data.callerName,
      remoteUserAvatar: data.callerAvatar,
      callType: data.callType,
      incomingOffer: data.offer,
    });
  },

  _handleCallAnswer: async (answer) => {
    const { peerConnection, pendingCandidates } = get();
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer),
      );

      // Flush pending ICE candidates
      for (const candidate of pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding pending ice candidate:", err);
        }
      }
      set({ pendingCandidates: [], callStatus: "connected" });

      // Start call audio management
      InCallManager.start({ media: "audio" });
      InCallManager.setKeepScreenOn(true);

      // Start duration timer
      const timerId = setInterval(() => {
        set((state) => ({
          callDurationSeconds: state.callDurationSeconds + 1,
        }));
      }, 1000);
      set({ _durationTimerId: timerId });
    } catch (e) {
      console.error("Failed to handle call answer", e);
    }
  },

  _handleRemoteIceCandidate: async (candidate) => {
    const { peerConnection, pendingCandidates } = get();

    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Failed to add ice candidate", e);
      }
    } else {
      // Queue for later if remote description isn't set yet
      set({ pendingCandidates: [...pendingCandidates, candidate] });
    }
  },

  _cleanup: () => {
    const { localStream, peerConnection, _callTimeoutId, _durationTimerId } =
      get();

    // Stop all audio/video tracks
    localStream?.getTracks().forEach((track) => track.stop());

    // Close peer connection
    peerConnection?.close();

    // Stop call audio management
    InCallManager.stop();
    InCallManager.setKeepScreenOn(false);

    // Clear timeouts and intervals
    if (_callTimeoutId) clearTimeout(_callTimeoutId);
    if (_durationTimerId) clearInterval(_durationTimerId);

    // Reset all state
    set({
      callStatus: "idle",
      callType: null,
      remoteUserId: null,
      remoteUserName: null,
      remoteUserAvatar: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isSpeakerOn: false,
      callDurationSeconds: 0,
      _callTimeoutId: null,
      _durationTimerId: null,
      pendingCandidates: [],
      incomingOffer: null,
    });
  },
}));
