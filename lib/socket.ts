import { Chat, Message, MessageReaction, MessageSender } from "@/types";
import * as Sentry from "@sentry/react-native";
import { QueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { create } from "zustand";

const SOCKET_URL = "https://chat-app-backend-zj3i.onrender.com";

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>;
  unreadChats: Set<string>;
  currentChatId: string | null;
  queryClient: QueryClient | null;

  connect: (token: string, queryClient: QueryClient) => void;
  disconnect: () => void;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  sendMessage: (chatId: string, text: string, currentUser: MessageSender, replyToId?: string) => void;
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
  queryClient: null,

  connect: (token, queryClient) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;
    if (existingSocket) existingSocket.disconnect();

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      Sentry.logger.info("Socket connected", { socketId: socket.id });
      set({ isConnected: true });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
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
      const senderId = (message.sender as MessageSender)._id;
      const { currentChatId } = get();

      queryClient.setQueryData<Message[]>(["messages", message.chat], (old) => {
        if (!old) return [message];
        const filtered = old.filter((m) => !m._id.startsWith("temp-"));
        if (filtered.some((m) => m._id === message._id)) return filtered;
        return [...filtered, message];
      });

      queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
        return oldChats?.map((chat) => {
          if (chat._id === message.chat) {
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

      if (currentChatId !== message.chat) {
        const chats = queryClient.getQueryData<Chat[]>(["chats"]);
        const chat = chats?.find((c) => c._id === message.chat);
        if (chat?.participant && senderId === chat.participant._id) {
          set((state) => ({
            unreadChats: new Set([...state.unreadChats, message.chat]),
          }));
        }
      }

      set((state) => {
        const typingUsers = new Map(state.typingUsers);
        typingUsers.delete(message.chat);
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

    set({ socket, queryClient });
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
        queryClient: null,
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

  sendMessage: (chatId, text, currentUser, replyToId) => {
    const { socket, queryClient } = get();
    if (!socket?.connected || !queryClient) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      _id: tempId,
      chat: chatId,
      sender: currentUser,
      text,
      type: "text",
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

    socket.emit("send-message", { chatId, text, replyToId });

    Sentry.logger.info("Message sent", { chatId, messageLength: text.length });

    const errorHandler = (error: { message: string }) => {
      Sentry.logger.error("Failed to send message", { chatId, error: error.message });
      queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
        if (!old) return [];
        return old.filter((m) => m._id !== tempId);
      });
      socket.off("socket-error", errorHandler);
    };
    socket.once("socket-error", errorHandler);
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
