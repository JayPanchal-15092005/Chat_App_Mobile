import axios from "axios";
import InCallManager from "react-native-incall-manager";
import {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices
} from "react-native-webrtc";
import { create } from "zustand";
import { API_URL } from "../constants/Config";
import { useSocketStore } from "./socket";

// Lazy bridge to avoid circular dependency: useCallKeep → callStore → useCallKeep
let _endCallViaCallKeep: (() => void) | null = null;
export function __registerCallKeepEndCall(fn: () => void) {
  _endCallViaCallKeep = fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface CallState {
  callStatus: "idle" | "outgoing" | "incoming" | "active";
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
  callId: string | null;
  incomingOffer: any;
  pendingCandidates: any[];
  _listenersInitialized: boolean;
  _callTimeoutId: ReturnType<typeof setTimeout> | null;
  _durationTimerId: ReturnType<typeof setInterval> | null;
  pendingPushCallData: {
    callerId: string;
    callerName: string;
    callerAvatar: string;
    callType: "audio" | "video";
    callId: string;
    _autoAccept?: boolean;
  } | null;

  initCallListeners: () => void;
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
  setIncomingCallFromPush: (data: {
    callerId: string;
    callerName: string;
    callerAvatar: string;
    callType: "audio" | "video";
    callId?: string;
  }) => void;
  acceptCallFromPush: () => void;
  _handleIncomingCall: (data: any) => void;
  _handleCallAnswer: (answer: any) => Promise<void>;
  _handleRemoteIceCandidate: (candidate: any) => Promise<void>;
  _transitionToActive: () => void;
  _cleanup: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// TURN / STUN server config
// ─────────────────────────────────────────────────────────────────────────────
const fetchIceServers = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/turn/credentials`);
    return { iceServers: response.data };
  } catch {
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a RTCPeerConnection with full audio debug logging
// ─────────────────────────────────────────────────────────────────────────────
function createPC(iceServers: any[]): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers } as any);

  (pc as any).onconnectionstatechange = () => {
    console.log("[WebRTC] connectionState:", (pc as any).connectionState);
  };
  (pc as any).oniceconnectionstatechange = () => {
    console.log("[WebRTC] iceConnectionState:", (pc as any).iceConnectionState);
  };
  (pc as any).onsignalingstatechange = () => {
    console.log("[WebRTC] signalingState:", (pc as any).signalingState);
  };

  return pc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get local audio stream with InCallManager activated first
// ─────────────────────────────────────────────────────────────────────────────
async function getLocalAudioStream(): Promise<MediaStream> {
  // CRITICAL: Start InCallManager BEFORE getUserMedia
  try {
    InCallManager.start({ media: "audio" });
    InCallManager.setSpeakerphoneOn(true);
    InCallManager.setKeepScreenOn(true);
    console.log("[WebRTC] InCallManager started & forced speakerphone");
  } catch (e) {
    console.warn("[WebRTC] InCallManager.start failed:", e);
  }

  const stream = await mediaDevices.getUserMedia({
    // audio: ({
    //   echoCancellation: true,
    //   noiseSuppression: true,
    //   autoGainControl: true,
    // } as any),
    audio: true,
    video: false,
  });

  const audioTracks = stream.getAudioTracks();
  console.log("[WebRTC] Local audio tracks:", audioTracks.length);

  audioTracks.forEach((track: any) => {
    // CRITICAL ANDROID FIX
    track.enabled = true;

    console.log("TRACK INFO");
    console.log("enabled =", track.enabled);
    console.log("muted =", track.muted);
    console.log("readyState =", track.readyState);
  });

  return stream;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: attach tracks to PC and wire ontrack for the remote stream
// ─────────────────────────────────────────────────────────────────────────────
function wirePC(
  pc: RTCPeerConnection,
  localStream: MediaStream,
  onRemoteStream: (stream: MediaStream) => void,
  targetUserId: string,
  socket: any,
  label: string,
) {
  // ONLY addTrack, no transceivers
  const audioTracks = localStream.getAudioTracks();
  console.log("[Mobile] audio tracks:", audioTracks.length);

  audioTracks.forEach((track: any) => {
    console.log(
      "[Mobile] adding track",
      track.id,
      track.enabled,
      track.muted,
      track.readyState,
    );
    (pc as any).addTrack(track, localStream);
  });

  // ICE candidate forwarding
  (pc as any).onicecandidate = (event: any) => {
    if (event.candidate) {
      console.log(`[WebRTC][${label}] Sending ICE candidate`);
      socket.emit("ice-candidate", {
        targetUserId,
        candidate: event.candidate,
      });
    } else {
      console.log(`[WebRTC][${label}] ICE gathering complete`);
    }
  };

  // Remote stream handling
  (pc as any).ontrack = (event: any) => {
    console.log("[Mobile] ontrack fired");

    if (event.track) {
      console.log(event.track.kind);
      console.log(event.track.enabled);
      console.log(event.track.muted);
      console.log(event.track.readyState);
    }

    console.log("streams =", event.streams?.length ?? 0);

    if (event.streams && event.streams[0]) {
      const remoteAudioTracks = event.streams[0].getAudioTracks();
      console.log("remote audio tracks =", remoteAudioTracks.length);
      onRemoteStream(event.streams[0]);
    } else if (event.track) {
      // Fallback for older react-native-webrtc versions that don't send streams array
      console.log("[Mobile] No streams array, building manual MediaStream");
      const remoteStream = new MediaStream([event.track]);
      console.log(
        "remote audio tracks (manual) =",
        remoteStream.getAudioTracks().length,
      );
      onRemoteStream(remoteStream);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
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
  callId: null,
  incomingOffer: null,
  pendingCandidates: [],
  _listenersInitialized: false,
  _callTimeoutId: null,
  _durationTimerId: null,
  pendingPushCallData: null,

  // ────────────────────────────────────────────────────────────────────────
  // initCallListeners — idempotent socket event setup
  // ────────────────────────────────────────────────────────────────────────
  initCallListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) {
      console.warn("[CallStore] initCallListeners: no socket");
      return;
    }

    // Remove old listeners first (idempotent)
    socket.off("incoming-call");
    socket.off("call-answer-forwarded");
    socket.off("call-connected");
    socket.off("ice-candidate-forwarded");
    socket.off("call-ended");
    socket.off("call-rejected");

    socket.on("incoming-call", (data: any) => get()._handleIncomingCall(data));
    socket.on("call-answer-forwarded", ({ answer }: any) =>
      get()._handleCallAnswer(answer),
    );

    socket.on("call-connected", () => {
      console.log("[CallStore] call-connected received");
      if (get().callStatus === "outgoing") get()._transitionToActive();
    });

    socket.on("ice-candidate-forwarded", ({ candidate }: any) =>
      get()._handleRemoteIceCandidate(candidate),
    );
    socket.on("call-ended", () => {
      console.log("[CallStore] Remote ended the call");
      get()._cleanup();
    });
    socket.on("call-rejected", () => {
      console.log("[CallStore] Remote rejected the call");
      get()._cleanup();
    });

    set({ _listenersInitialized: true });

    // Recover missed offer if woken from killed state
    socket.emit("fetch-ongoing-call");
    console.log("[CallStore] Requested fetch-ongoing-call");
  },

  // ────────────────────────────────────────────────────────────────────────
  // setIncomingCallFromPush
  // ────────────────────────────────────────────────────────────────────────
  setIncomingCallFromPush: ({
    callerId,
    callerName,
    callerAvatar,
    callType,
    callId,
  }) => {
    set({
      callStatus: "incoming",
      remoteUserId: callerId,
      remoteUserName: callerName,
      remoteUserAvatar: callerAvatar,
      callType: callType ?? "audio",
      callId: callId ?? null,
      pendingPushCallData: {
        callerId,
        callerName,
        callerAvatar,
        callType: callType ?? "audio",
        callId: callId ?? "",
      },
    });
  },

  // ────────────────────────────────────────────────────────────────────────
  // acceptCallFromPush
  // ────────────────────────────────────────────────────────────────────────
  acceptCallFromPush: () => {
    const { callStatus, incomingOffer } = get();
    if (callStatus === "incoming" && incomingOffer) {
      get().acceptCall();
    } else {
      const existing = get().pendingPushCallData;
      set({
        pendingPushCallData: existing
          ? { ...existing, _autoAccept: true }
          : null,
      });
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // startCall — outgoing call (CALLER)
  // ────────────────────────────────────────────────────────────────────────
  startCall: async (targetUserId, name, avatar) => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    if (get().callStatus !== "idle") {
      console.warn("[CallStore] startCall called while not idle — ignoring");
      return;
    }

    try {
      // 1. Get local audio (InCallManager started inside)
      const stream = await getLocalAudioStream();

      // 2. Create peer connection
      const iceConfig = await fetchIceServers();
      const pc = createPC(iceConfig.iceServers);

      // 3. Wire tracks + ontrack BEFORE createOffer
      wirePC(
        pc,
        stream,
        (remoteStream) => set({ remoteStream }),
        targetUserId,
        socket,
        "CALLER",
      );

      // 4. ICE state → auto transition fallback (primary = _handleCallAnswer)
      (pc as any).oniceconnectionstatechange = () => {
        const iceState = (pc as any).iceConnectionState as string;
        console.log("[CallStore] Caller ICE state:", iceState);
        if (
          (iceState === "connected" || iceState === "completed") &&
          get().callStatus === "outgoing"
        ) {
          console.log(
            "[CallStore] ICE connected — transitioning to active (fallback)",
          );
          get()._transitionToActive();
        } else if (iceState === "failed" || iceState === "disconnected") {
          console.log("[CallStore] ICE failed/disconnected — cleaning up");
          get()._cleanup();
        }
      };

      set({
        localStream: stream,
        peerConnection: pc,
        remoteUserId: targetUserId,
        remoteUserName: name,
        remoteUserAvatar: avatar,
        callType: "audio",
        callStatus: "outgoing",
      });

      // 5. Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[Mobile] CALLER offer SDP:\n", (offer as any).sdp);

      socket.emit("call-offer", { targetUserId, offer, callType: "audio" });

      // 60s no-answer timeout
      const timeoutId = setTimeout(() => {
        if (get().callStatus === "outgoing") {
          console.log("[CallStore] Outgoing call timed out");
          socket.emit("call-end", { targetUserId });
          get()._cleanup();
        }
      }, 60_000);
      set({ _callTimeoutId: timeoutId });
    } catch (e) {
      console.error("[CallStore] startCall failed:", e);
      get()._cleanup();
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // acceptCall — RECEIVER accepts incoming call
  // ────────────────────────────────────────────────────────────────────────
  acceptCall: async () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, incomingOffer, pendingCandidates, callId } = get();
    if (!socket || !remoteUserId) return;

    const existingTimeout = get()._callTimeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);

    try {
      // 1. Get local audio (InCallManager started inside)
      const stream = await getLocalAudioStream();

      // 2. Create peer connection
      const iceConfig = await fetchIceServers();
      const pc = createPC(iceConfig.iceServers);

      // 3. Wire tracks + ontrack BEFORE setRemoteDescription
      wirePC(
        pc,
        stream,
        (remoteStream) => set({ remoteStream }),
        remoteUserId,
        socket,
        "RECEIVER",
      );

      (pc as any).oniceconnectionstatechange = () => {
        const iceState = (pc as any).iceConnectionState as string;
        console.log("[CallStore] Receiver ICE state:", iceState);
        if (iceState === "failed" || iceState === "disconnected")
          get()._cleanup();
      };

      set({ localStream: stream, peerConnection: pc });

      // 4. Set remote description (offer)
      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        console.log("[CallStore] Set remote description (offer)");
      }

      // 5. Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[Mobile] RECEIVER answer SDP:\n", (answer as any).sdp);

      socket.emit("call-answer", {
        targetUserId: remoteUserId,
        answer,
        callId,
      });

      // 6. Flush queued ICE candidates BEFORE transitioning to active
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.error("[CallStore] Failed to add queued ICE candidate:", e);
        }
      }
      set({ pendingCandidates: [], _callTimeoutId: null });

      // 7. Transition to active — receiver can transition immediately
      get()._transitionToActive();
    } catch (e) {
      console.error("[CallStore] acceptCall failed:", e);
      get()._cleanup();
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _transitionToActive
  // ────────────────────────────────────────────────────────────────────────
  _transitionToActive: () => {
    const { callStatus, _durationTimerId, _callTimeoutId } = get();

    if (callStatus === "active") {
      console.log("[CallStore] Already active — skipping duplicate transition");
      return;
    }

    if (_durationTimerId) clearInterval(_durationTimerId);
    if (_callTimeoutId) clearTimeout(_callTimeoutId);

    // InCallManager was already started in getLocalAudioStream.
    // Here we just ensure speakerphone is in the correct state.
    try {
      InCallManager.setKeepScreenOn(true);
      // Route to earpiece by default for audio calls (user can toggle speaker)
      InCallManager.setSpeakerphoneOn(true);
      console.log("[CallStore] InCallManager audio routing set to earpiece");
    } catch (e) {
      console.warn("[CallStore] InCallManager routing failed:", e);
    }

    const timerId = setInterval(() => {
      set((s) => ({ callDurationSeconds: s.callDurationSeconds + 1 }));
    }, 1000);

    set({
      callStatus: "active",
      _durationTimerId: timerId,
      _callTimeoutId: null,
      callDurationSeconds: 0,
    });

    console.log("[CallStore] ✅ Transitioned to ACTIVE");
  },

  // ────────────────────────────────────────────────────────────────────────
  // rejectCall
  // ────────────────────────────────────────────────────────────────────────
  rejectCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, callId } = get();
    if (socket && remoteUserId)
      socket.emit("call-reject", { targetUserId: remoteUserId, callId });
    _endCallViaCallKeep?.();
    get()._cleanup();
  },

  // ────────────────────────────────────────────────────────────────────────
  // endCall
  // ────────────────────────────────────────────────────────────────────────
  endCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, callId } = get();
    if (socket && remoteUserId)
      socket.emit("call-end", { targetUserId: remoteUserId, callId });
    _endCallViaCallKeep?.();
    get()._cleanup();
  },

  // ────────────────────────────────────────────────────────────────────────
  // toggleMute
  // ────────────────────────────────────────────────────────────────────────
  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = isMuted; // if muted → enable; else disable
        console.log(
          `[CallStore] Audio track ${track.id} enabled=${track.enabled}`,
        );
      });
    }
    set({ isMuted: !isMuted });
  },

  // ────────────────────────────────────────────────────────────────────────
  // toggleSpeaker
  // ────────────────────────────────────────────────────────────────────────
  toggleSpeaker: () => {
    const next = !get().isSpeakerOn;
    try {
      InCallManager.setSpeakerphoneOn(next);
      console.log("[CallStore] Speaker:", next ? "ON" : "OFF");
    } catch (e) {
      console.warn("[CallStore] setSpeakerphoneOn failed:", e);
    }
    set({ isSpeakerOn: next });
  },

  // ────────────────────────────────────────────────────────────────────────
  // _handleIncomingCall — socket event received while app is foreground
  // ────────────────────────────────────────────────────────────────────────
  _handleIncomingCall: (data) => {
    const { callStatus, pendingPushCallData } = get();

    if (callStatus === "incoming" && pendingPushCallData) {
      console.log(
        "[CallStore] Push-tap recovery: merging offer into existing incoming state",
      );
      set({
        incomingOffer: data.offer,
        callId: data.callId || get().callId,
      });
      if (pendingPushCallData._autoAccept) {
        set({ pendingPushCallData: null });
        get().acceptCall();
      }
      return;
    }

    if (callStatus !== "idle") {
      console.log(
        "[CallStore] Ignoring incoming-call — already in a call:",
        callStatus,
      );
      return;
    }

    console.log("[CallStore] Incoming call from:", data.callerName);

    const existingTimeout = get()._callTimeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeoutId = setTimeout(() => {
      if (get().callStatus === "incoming") {
        console.log("[CallStore] Incoming call timed out (missed)");
        get()._cleanup();
      }
    }, 60_000);

    set({
      callStatus: "incoming",
      remoteUserId: data.callerId,
      remoteUserName: data.callerName,
      remoteUserAvatar: data.callerAvatar ?? null,
      callType: data.callType ?? "audio",
      incomingOffer: data.offer,
      callId: data.callId ?? null,
      pendingPushCallData: null,
      pendingCandidates: [],
      _callTimeoutId: timeoutId,
    });
  },

  // ────────────────────────────────────────────────────────────────────────
  // _handleCallAnswer — CALLER receives answer from receiver
  // ────────────────────────────────────────────────────────────────────────
  _handleCallAnswer: async (answer) => {
    const { peerConnection, pendingCandidates, callStatus } = get();
    if (!peerConnection) {
      console.warn("[CallStore] _handleCallAnswer: no peerConnection");
      return;
    }
    if (callStatus !== "outgoing") {
      console.warn(
        "[CallStore] _handleCallAnswer: unexpected status:",
        callStatus,
      );
      return;
    }

    console.log("[CallStore] Setting remote description (answer)...");
    try {
      await peerConnection.setRemoteDescription(
        // new RTCSessionDescription(answer),
        answer,
      );
      console.log("[CallStore] Remote description set successfully");

      // Flush queued ICE candidates
      for (const candidate of pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(candidate);
        } catch (e) {
          console.error("[CallStore] Failed ICE candidate flush:", e);
        }
      }
      set({ pendingCandidates: [] });

      // Transition to active — don't wait for ICE state
      get()._transitionToActive();
    } catch (e) {
      console.error("[CallStore] _handleCallAnswer failed:", e);
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _handleRemoteIceCandidate
  // ────────────────────────────────────────────────────────────────────────
  _handleRemoteIceCandidate: async (candidate) => {
    const { peerConnection, pendingCandidates } = get();
    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (e) {
        console.error("[CallStore] addIceCandidate failed:", e);
      }
    } else {
      set({ pendingCandidates: [...pendingCandidates, candidate] });
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _cleanup
  // ────────────────────────────────────────────────────────────────────────
  _cleanup: () => {
    const { localStream, peerConnection, _callTimeoutId, _durationTimerId } =
      get();

    console.log("[CallStore] Cleaning up call...");

    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => {
        try {
          track.stop();
        } catch {
          /* already stopped */
        }
      });
    }

    if (peerConnection) {
      try {
        (peerConnection as any).onicecandidate = null;
        (peerConnection as any).ontrack = null;
        (peerConnection as any).onaddstream = null;
        (peerConnection as any).oniceconnectionstatechange = null;
        (peerConnection as any).onconnectionstatechange = null;
        (peerConnection as any).onsignalingstatechange = null;
        peerConnection.close();
      } catch {
        /* already closed */
      }
    }

    try {
      InCallManager.stop();
      InCallManager.setKeepScreenOn(false);
      console.log("[CallStore] InCallManager stopped");
    } catch {
      /* ignore */
    }

    if (_callTimeoutId) clearTimeout(_callTimeoutId);
    if (_durationTimerId) clearInterval(_durationTimerId);

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
      callId: null,
      incomingOffer: null,
      pendingCandidates: [],
      _listenersInitialized: false,
      _callTimeoutId: null,
      _durationTimerId: null,
      pendingPushCallData: null,
    });

    console.log("[CallStore] Cleanup complete.");
  },
}));
