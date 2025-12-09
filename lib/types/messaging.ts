// lib/types/messaging.ts

export interface Conversation {
  id: string;
  participants: string[];
  type: 'direct' | 'group';
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: Message;
  unreadCount: Record<string, number>;
  metadata?: {
    title?: string;
    description?: string;
    avatar?: string;
    createdBy: string;
  };
  settings: {
    isArchived: boolean;
    isMuted: boolean;
    muteUntil?: Date;
    pinned: boolean;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'file' | 'system';
  content: string;
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    imageWidth?: number;
    imageHeight?: number;
    replyTo?: string;
    forwardedFrom?: string;
  };
  status: {
    delivered: Record<string, Date>;
    read: Record<string, Date>;
  };
  reactions: Record<string, string[]>;
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  phoneNumber?: string;
  bio?: string;
  preferences: {
    notifications: boolean;
    readReceipts: boolean;
    typingIndicators: boolean;
  };
  contacts: string[];
  blockedUsers: string[];
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  timestamp: Date;
}