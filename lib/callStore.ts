import axios from "axios";
import InCallManager from "react-native-incall-manager";
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
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
  /** Core call status state machine */
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
  /**
   * Set when the app is opened from a killed/background state via a push
   * notification tap. Holds caller info while we wait for the socket to
   * reconnect and deliver the SDP offer.
   */
  pendingPushCallData: {
    callerId: string;
    callerName: string;
    callerAvatar: string;
    callType: "audio" | "video";
    callId: string;
    _autoAccept?: boolean;
  } | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  initCallListeners: () => void;
  startCall: (targetUserId: string, name: string, avatar: string) => Promise<void>;
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
  // Internal
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
  // initCallListeners — attach socket event handlers (idempotent)
  // ────────────────────────────────────────────────────────────────────────
  initCallListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    // Always remove before re-adding to prevent duplicates
    socket.off("incoming-call");
    socket.off("call-answer-forwarded");
    socket.off("call-connected");
    socket.off("ice-candidate-forwarded");
    socket.off("call-ended");
    socket.off("call-rejected");

    socket.on("incoming-call", (data) => get()._handleIncomingCall(data));
    socket.on("call-answer-forwarded", ({ answer }) => get()._handleCallAnswer(answer));

    // call-connected: emitted by backend to both sides when receiver accepts.
    // Acts as a FALLBACK for the caller to transition from outgoing → active
    // in case the SDP exchange doesn't trigger the state change.
    socket.on("call-connected", () => {
      console.log("[CallStore] call-connected received");
      if (get().callStatus === "outgoing") {
        console.log("[CallStore] Transitioning to active via call-connected fallback");
        get()._transitionToActive();
      }
    });

    socket.on("ice-candidate-forwarded", ({ candidate }) => get()._handleRemoteIceCandidate(candidate));
    socket.on("call-ended", () => {
      console.log("[CallStore] Remote ended the call");
      get()._cleanup();
    });
    socket.on("call-rejected", () => {
      console.log("[CallStore] Remote rejected the call");
      get()._cleanup();
    });

    set({ _listenersInitialized: true });
  },

  // ────────────────────────────────────────────────────────────────────────
  // setIncomingCallFromPush — called when the app opens from a push tap
  // (killed / background state). Stores caller info for the IncomingCallModal.
  // The SDP offer will arrive once the socket reconnects.
  // ────────────────────────────────────────────────────────────────────────
  setIncomingCallFromPush: ({ callerId, callerName, callerAvatar, callType, callId }) => {
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
  // acceptCallFromPush — tapped Accept on OS notification (background/killed)
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
  // startCall — initiate an outgoing call
  // ────────────────────────────────────────────────────────────────────────
  startCall: async (targetUserId, name, avatar) => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    // Prevent starting a new call if already in one
    if (get().callStatus !== "idle") {
      console.warn("[CallStore] startCall called while not idle — ignoring");
      return;
    }

    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      const iceConfig = await fetchIceServers();
      const pc = new RTCPeerConnection({ iceServers: iceConfig.iceServers } as any);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      (pc as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { targetUserId, candidate: event.candidate });
        }
      };

      (pc as any).ontrack = (event: any) => {
        if (event.streams?.[0]) set({ remoteStream: event.streams[0] });
      };
      (pc as any).onaddstream = (event: any) => {
        if (event.stream) set({ remoteStream: event.stream });
      };

      // ICE state change — secondary path to catch "active" if the
      // call-answer-forwarded event somehow fires before ICE connects.
      // Primary transition happens in _handleCallAnswer.
      (pc as any).oniceconnectionstatechange = () => {
        const iceState = (pc as any).iceConnectionState as string;
        console.log("[CallStore] Caller ICE state:", iceState);

        if (iceState === "connected" || iceState === "completed") {
          // Only transition if we haven't already (answer may have done it)
          if (get().callStatus === "outgoing") {
            console.log("[CallStore] ICE connected — transitioning to active (fallback)");
            get()._transitionToActive();
          }
        } else if (iceState === "failed" || iceState === "disconnected") {
          console.log("[CallStore] ICE failed/disconnected — cleaning up");
          get()._cleanup();
        }
      };

      (pc as any).onconnectionstatechange = () => {
        const connState = (pc as any).connectionState as string;
        console.log("[CallStore] Caller connection state:", connState);
        if (connState === "connected") {
          if (get().callStatus === "outgoing") {
            get()._transitionToActive();
          }
        } else if (connState === "failed" || connState === "closed") {
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

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call-offer", { targetUserId, offer, callType: "audio" });

      // 60-second no-answer timeout
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
  // acceptCall — called by receiver to accept an incoming call
  // ────────────────────────────────────────────────────────────────────────
  acceptCall: async () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, incomingOffer, pendingCandidates, callId } = get();
    if (!socket || !remoteUserId) return;

    // Clear ring timeout
    const existingTimeout = get()._callTimeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);

    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      const iceConfig = await fetchIceServers();
      const pc = new RTCPeerConnection({ iceServers: iceConfig.iceServers } as any);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      (pc as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit("ice-candidate", { targetUserId: remoteUserId, candidate: event.candidate });
        }
      };

      (pc as any).ontrack = (event: any) => {
        if (event.streams?.[0]) set({ remoteStream: event.streams[0] });
      };
      (pc as any).onaddstream = (event: any) => {
        if (event.stream) set({ remoteStream: event.stream });
      };

      (pc as any).oniceconnectionstatechange = () => {
        const iceState = (pc as any).iceConnectionState as string;
        console.log("[CallStore] Receiver ICE state:", iceState);
        if (iceState === "failed" || iceState === "disconnected") {
          get()._cleanup();
        }
      };

      set({ localStream: stream, peerConnection: pc });

      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call-answer", { targetUserId: remoteUserId, answer, callId });

      // Flush queued ICE candidates
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[CallStore] Failed to add queued ICE candidate:", e);
        }
      }
      set({ pendingCandidates: [], _callTimeoutId: null });

      // Receiver transitions to active immediately after sending answer —
      // don't wait for ICE connected because the peer state fires on the other side
      get()._transitionToActive();
    } catch (e) {
      console.error("[CallStore] acceptCall failed:", e);
      get()._cleanup();
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _transitionToActive — shared logic to move from any ringing state → active
  // ────────────────────────────────────────────────────────────────────────
  _transitionToActive: () => {
    const { callStatus, _durationTimerId, _callTimeoutId } = get();

    // Guard: only transition from a ringing state
    if (callStatus === "active") {
      console.log("[CallStore] Already active — skipping duplicate transition");
      return;
    }

    // Stop any previous timer
    if (_durationTimerId) clearInterval(_durationTimerId);
    if (_callTimeoutId) clearTimeout(_callTimeoutId);

    // Start call audio
    try {
      InCallManager.start({ media: "audio" });
      InCallManager.setKeepScreenOn(true);
    } catch (e) {
      console.warn("[CallStore] InCallManager.start failed:", e);
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
    if (socket && remoteUserId) {
      socket.emit("call-reject", { targetUserId: remoteUserId, callId });
    }
    _endCallViaCallKeep?.();
    get()._cleanup();
  },

  // ────────────────────────────────────────────────────────────────────────
  // endCall
  // ────────────────────────────────────────────────────────────────────────
  endCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, callId } = get();
    if (socket && remoteUserId) {
      socket.emit("call-end", { targetUserId: remoteUserId, callId });
    }
    _endCallViaCallKeep?.();
    get()._cleanup();
  },

  // ────────────────────────────────────────────────────────────────────────
  // toggleMute
  // ────────────────────────────────────────────────────────────────────────
  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // if muted → enable (unmute); else disable (mute)
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
      // App was opened from a push tap. Socket reconnected and delivered the offer.
      // Merge the offer in without resetting caller info.
      console.log("[CallStore] Push-tap recovery: merging offer into existing incoming state");
      set({
        incomingOffer: data.offer,
        callId: data.callId || get().callId,
      });

      // If the user already tapped Accept on the OS notification, auto-accept now
      if (pendingPushCallData._autoAccept) {
        set({ pendingPushCallData: null });
        get().acceptCall();
      }
      return;
    }

    if (callStatus !== "idle") {
      console.log("[CallStore] Ignoring incoming-call — already in a call:", callStatus);
      return;
    }

    console.log("[CallStore] Incoming call from:", data.callerName);

    // 60-second missed-call timeout
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
  // _handleCallAnswer — called on the CALLER side when receiver accepts
  //
  // KEY FIX: Transition to "active" immediately here — do NOT wait for
  // oniceconnectionstatechange. On Android/react-native-webrtc, the ICE
  // "connected" event can fire very late or be skipped entirely with TURN.
  // The answer SDP being set means the call IS accepted.
  // ────────────────────────────────────────────────────────────────────────
  _handleCallAnswer: async (answer) => {
    const { peerConnection, pendingCandidates, callStatus } = get();
    if (!peerConnection) {
      console.warn("[CallStore] _handleCallAnswer: no peerConnection");
      return;
    }
    if (callStatus !== "outgoing") {
      console.warn("[CallStore] _handleCallAnswer: unexpected status:", callStatus);
      return;
    }

    console.log("[CallStore] Received call answer — setting remote description");

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      // Flush queued ICE candidates that arrived before the remote description
      for (const candidate of pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[CallStore] Failed ICE candidate flush:", e);
        }
      }
      set({ pendingCandidates: [] });

      // ✅ CRITICAL: Transition to active NOW — don't wait for ICE state
      get()._transitionToActive();
    } catch (e) {
      console.error("[CallStore] _handleCallAnswer failed:", e);
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _handleRemoteIceCandidate — queue or apply remote ICE candidates
  // ────────────────────────────────────────────────────────────────────────
  _handleRemoteIceCandidate: async (candidate) => {
    const { peerConnection, pendingCandidates } = get();
    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[CallStore] addIceCandidate failed:", e);
      }
    } else {
      set({ pendingCandidates: [...pendingCandidates, candidate] });
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _cleanup — full reset: stop media, close PC, reset all state
  // ────────────────────────────────────────────────────────────────────────
  _cleanup: () => {
    const { localStream, peerConnection, _callTimeoutId, _durationTimerId } = get();

    console.log("[CallStore] Cleaning up call...");

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try { track.stop(); } catch { /* already stopped */ }
      });
    }

    if (peerConnection) {
      try {
        (peerConnection as any).onicecandidate = null;
        (peerConnection as any).ontrack = null;
        (peerConnection as any).onaddstream = null;
        (peerConnection as any).oniceconnectionstatechange = null;
        (peerConnection as any).onconnectionstatechange = null;
        peerConnection.close();
      } catch { /* already closed */ }
    }

    try {
      InCallManager.stop();
      InCallManager.setKeepScreenOn(false);
    } catch { /* ignore */ }

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
      _callTimeoutId: null,
      _durationTimerId: null,
      pendingPushCallData: null,
    });

    console.log("[CallStore] Cleanup complete.");
  },
}));
