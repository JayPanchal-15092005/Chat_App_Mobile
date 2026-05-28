export interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface MessageSender {
  _id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface MessageReaction {
  userId: string;
  emoji: string;
}

export interface ReplyToMessage {
  _id: string;
  text: string;
  sender: string | MessageSender;
}

export interface Message {
  _id: string;
  chat: string;
  sender: MessageSender | string;
  text: string;
  type: "text" | "image" | "voice";
  mediaUrl?: string | null;
  status: "sent" | "delivered" | "seen";
  replyTo?: ReplyToMessage | null;
  reactions: MessageReaction[];
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatLastMessage {
  _id: string;
  text: string;
  sender: string;
  createdAt: string;
}

export interface Chat {
  _id: string;
  participant: MessageSender;
  lastMessage: ChatLastMessage | null;
  lastMessageAt: string;
  createdAt: string;
  isPinned: boolean;
}
