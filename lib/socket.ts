import { Chat, Message, MessageReaction, MessageSender } from "@/types";
import * as Sentry from "@sentry/react-native";
import { io, Socket } from "socket.io-client";
import { create } from "zustand";
import { queryClient } from "@/lib/queryClient";

const SOCKET_URL = "https://chat-app-backend-zj3i.onrender.com";

let pendingOutboundMessages: Array<{
  chatId: string;
  text: string;
  replyToId?: string;
  type?: "text" | "image" | "voice";
  mediaUrl?: string;
}> = [];

const flushPendingMessages = (socket: Socket) => {
  if (!socket.connected || pendingOutboundMessages.length === 0) return;
  const messagesToSend = [...pendingOutboundMessages];
  pendingOutboundMessages = [];
  for (const msg of messagesToSend) {
    socket.emit("send-message", msg);
  }
};

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>;
  unreadChats: Set<string>;
  currentChatId: string | null;

  connect: (token: string) => void;
  disconnect: () => void;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  sendMessage: (chatId: string, text: string, currentUser: MessageSender, replyToId?: string, type?: "text" | "image" | "voice", mediaUrl?: string) => void;
  sendTyping: (chatId: string, isTyping: boolean) => void;
  markDelivered: (chatId: string) => void;
  markSeen: (chatId: string) => void;
  reactToMessage: (messageId: string, chatId: string, emoji: string) => void;
  editMessage: (messageId: string, chatId: string, text: string) => void;
  deleteMessage: (messageId: string, chatId: string) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  typingUsers: new Map(),
  unreadChats: new Set(),
  currentChatId: null,

  connect: (token) => {
    const existingSocket = get().socket;
    if (existingSocket) {
      if (existingSocket.connected) return;
      existingSocket.connect();
      return;
    }

    console.log("[Socket] Connecting to:", SOCKET_URL);
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected! Socket ID:", socket.id);
      set({ isConnected: true });

      // Re-join active chat room
      const { currentChatId } = get();
      if (currentChatId) {
        socket.emit("join-chat", currentChatId);
      }
      queryClient.invalidateQueries({ queryKey: ["chats"] });

      // Automatically flush any pending outbound messages
      flushPendingMessages(socket);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected, reason:", reason);
      set({ isConnected: false });
    });

    socket.on("online-users", ({ userIds }: { userIds: string[] }) => {
      set({ onlineUsers: new Set(userIds) });
    });

    socket.on("user-online", ({ userId }: { userId: string }) => {
      set((state) => ({ onlineUsers: new Set([...state.onlineUsers, userId]) }));
    });

    socket.on("user-offline", ({ userId }: { userId: string }) => {
      set((state) => {
        const onlineUsers = new Set(state.onlineUsers);
        onlineUsers.delete(userId);
        return { onlineUsers };
      });
    });

    socket.on("socket-error", (error: { message: string }) => {
      console.error("Socket error:", error.message);
    });

    // ── New message ──────────────────────────────────────────────────
    socket.on("new-message", (message: Message) => {
      const chatId =
        typeof message.chat === "string"
          ? message.chat
          : (message.chat as any)?._id;
      const senderId =
        typeof message.sender === "string"
          ? message.sender
          : (message.sender as MessageSender)._id;
      const { currentChatId } = get();

      queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
        if (!old) return [message];
        // If message already exists by real server _id, keep list as is
        if (old.some((m) => m._id === message._id)) return old;

        // Find and replace ONLY the specific matching optimistic message
        let replaced = false;
        const updated = old.map((m) => {
          if (!replaced && m._id.startsWith("temp-")) {
            const mSenderId =
              typeof m.sender === "string"
                ? m.sender
                : (m.sender as MessageSender)._id;

            if (mSenderId === senderId && m.text === message.text) {
              replaced = true;
              return message;
            }
          }
          return m;
        });

        if (replaced) return updated;
        return [...updated, message];
      });

      queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
        if (!oldChats) return oldChats;
        return oldChats.map((chat) => {
          if (chat._id === chatId) {
            return {
              ...chat,
              lastMessage: {
                _id: message._id,
                text: message.text,
                sender: senderId,
                createdAt: message.createdAt,
              },
              lastMessageAt: message.createdAt,
            };
          }
          return chat;
        });
      });

      // Also invalidate so fresh data is fetched if cache was cold
      queryClient.invalidateQueries({ queryKey: ["chats"] });

      if (currentChatId !== chatId) {
        const chats = queryClient.getQueryData<Chat[]>(["chats"]);
        const chat = chats?.find((c) => c._id === chatId);
        if (chat?.participant && senderId === chat.participant._id) {
          set((state) => ({
            unreadChats: new Set([...state.unreadChats, chatId]),
          }));
        }
      }

      set((state) => {
        const typingUsers = new Map(state.typingUsers);
        typingUsers.delete(chatId);
        return { typingUsers };
      });
    });

    // ── Message status update (delivered / seen) ─────────────────────
    socket.on(
      "message-status-update",
      ({ chatId, status }: { chatId: string; status: "delivered" | "seen"; updatedBy: string }) => {
        queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
          if (!old) return old;
          return old.map((m) => {
            if (status === "seen" && (m.status === "sent" || m.status === "delivered")) {
              return { ...m, status: "seen" };
            }
            if (status === "delivered" && m.status === "sent") {
              return { ...m, status: "delivered" };
            }
            return m;
          });
        });
      }
    );

    // ── Reaction update ──────────────────────────────────────────────
    socket.on(
      "message-reaction-update",
      ({ messageId, chatId, reactions }: { messageId: string; chatId: string; reactions: MessageReaction[] }) => {
        queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
          if (!old) return old;
          return old.map((m) => (m._id === messageId ? { ...m, reactions } : m));
        });
      }
    );

    // ── Message edited ───────────────────────────────────────────────
    socket.on(
      "message-edited",
      ({ messageId, chatId, text, isEdited }: { messageId: string; chatId: string; text: string; isEdited: boolean }) => {
        queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
          if (!old) return old;
          return old.map((m) => (m._id === messageId ? { ...m, text, isEdited } : m));
        });
      }
    );

    // ── Message deleted ──────────────────────────────────────────────
    socket.on("message-deleted", ({ messageId, chatId }: { messageId: string; chatId: string }) => {
      queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
        if (!old) return old;
        return old.filter((m) => m._id !== messageId);
      });
    });

    // ── Typing ───────────────────────────────────────────────────────
    socket.on("typing", ({ userId, chatId, isTyping }: { userId: string; chatId: string; isTyping: boolean }) => {
      set((state) => {
        const typingUsers = new Map(state.typingUsers);
        if (isTyping) typingUsers.set(chatId, userId);
        else typingUsers.delete(chatId);
        return { typingUsers };
      });
    });

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({
        socket: null,
        isConnected: false,
        onlineUsers: new Set(),
        typingUsers: new Map(),
        unreadChats: new Set(),
        currentChatId: null,
      });
    }
  },

  joinChat: (chatId) => {
    const socket = get().socket;
    set((state) => {
      const unreadChats = new Set(state.unreadChats);
      unreadChats.delete(chatId);
      return { currentChatId: chatId, unreadChats };
    });
    if (socket?.connected) socket.emit("join-chat", chatId);
  },

  leaveChat: (chatId) => {
    const { socket } = get();
    set({ currentChatId: null });
    if (socket?.connected) socket.emit("leave-chat", chatId);
  },

  sendMessage: (chatId, text, currentUser, replyToId, type = "text", mediaUrl = "") => {
    const { socket } = get();

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMessage: Message = {
      _id: tempId,
      chat: chatId,
      sender: currentUser,
      text,
      type,
      mediaUrl,
      status: "sent",
      replyTo: null,
      reactions: [],
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
      if (!old) return [optimisticMessage];
      return [...old, optimisticMessage];
    });

    const payload = { chatId, text, replyToId, type, mediaUrl };

    if (socket?.connected) {
      socket.emit("send-message", payload);
      console.log("[Socket] Message emitted to server", { chatId, messageLength: text.length });
    } else {
      console.warn("[Socket] Not connected! Message queued for delivery on connect", { chatId });
      pendingOutboundMessages.push(payload);
      if (socket) {
        socket.connect();
      }
    }
  },

  sendTyping: (chatId, isTyping) => {
    const { socket } = get();
    if (socket?.connected) socket.emit("typing", { chatId, isTyping });
  },

  markDelivered: (chatId) => {
    const { socket } = get();
    if (socket?.connected) socket.emit("message-delivered", { chatId });
  },

  markSeen: (chatId) => {
    const { socket } = get();
    if (socket?.connected) socket.emit("message-seen", { chatId });
  },

  reactToMessage: (messageId, chatId, emoji) => {
    const { socket } = get();
    if (socket?.connected) socket.emit("react-message", { messageId, chatId, emoji });
  },

  editMessage: (messageId, chatId, text) => {
    const { socket } = get();
    if (socket?.connected) socket.emit("edit-message", { messageId, chatId, text });
  },

  deleteMessage: (messageId, chatId) => {
    const { socket } = get();
    if (socket?.connected) socket.emit("delete-message", { messageId, chatId });
  },
}));
