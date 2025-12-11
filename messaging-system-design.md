# Viber-like Messaging System Design Document

## Overview
This document outlines the design for a real-time messaging system similar to Viber, built using Firebase/Firestore as the backend database. The system will support user-to-user messaging with real-time updates, message status tracking, and a modern chat interface.

## 1. Database Schema (Firestore)

### Collections Structure

#### 1.1 `conversations` Collection
**Purpose**: Stores conversation metadata between users.

**Document Structure**:
```javascript
{
  id: string, // Auto-generated document ID
  participants: string[], // Array of user IDs (max 2 for 1-on-1, more for groups)
  type: "direct" | "group", // Conversation type
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastMessage: {
    id: string,
    senderId: string,
    content: string,
    timestamp: Timestamp,
    type: "text" | "image" | "file"
  },
  unreadCount: {
    [userId: string]: number // Unread count per participant
  },
  metadata: {
    title?: string, // For group chats
    description?: string,
    avatar?: string, // Group avatar URL
    createdBy: string, // User ID who created the conversation
  },
  settings: {
    isArchived: boolean,
    isMuted: boolean,
    muteUntil?: Timestamp,
    pinned: boolean
  }
}
```

**Indexes Needed**:
- `participants` (array-contains for user queries)
- `updatedAt` (descending for conversation lists)
- `type` (for filtering)

#### 1.2 `messages` Collection
**Purpose**: Stores individual messages within conversations.

**Document Structure**:
```javascript
{
  id: string, // Auto-generated document ID
  conversationId: string, // Reference to conversation
  senderId: string, // User ID of sender
  type: "text" | "image" | "file" | "system",
  content: string, // Message content or file URL
  timestamp: Timestamp,
  editedAt?: Timestamp,
  deletedAt?: Timestamp,
  metadata: {
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
    imageWidth?: number,
    imageHeight?: number,
    replyTo?: string, // Message ID being replied to
    forwardedFrom?: string // Original message ID if forwarded
  },
  status: {
    delivered: {
      [userId: string]: Timestamp // When message was delivered to each user
    },
    read: {
      [userId: string]: Timestamp // When message was read by each user
    }
  },
  reactions: {
    [emoji: string]: string[] // Array of user IDs who reacted with this emoji
  }
}
```

**Indexes Needed**:
- `conversationId` + `timestamp` (ascending for message history)
- `senderId` + `timestamp` (for user's sent messages)

#### 1.3 `users` Collection
**Purpose**: Extended user profile information for messaging.

**Document Structure**:
```javascript
{
  id: string, // Matches Firebase Auth UID
  displayName: string,
  email: string,
  avatar?: string,
  status: "online" | "offline" | "away",
  lastSeen: Timestamp,
  phoneNumber?: string,
  bio?: string,
  preferences: {
    notifications: boolean,
    readReceipts: boolean,
    typingIndicators: boolean
  },
  contacts: string[], // Array of contact user IDs
  blockedUsers: string[] // Array of blocked user IDs
}
```

#### 1.4 `typing_indicators` Collection (Real-time only)
**Purpose**: Temporary collection for typing indicators.

**Document Structure**:
```javascript
{
  id: string, // conversationId + "_" + userId
  conversationId: string,
  userId: string,
  timestamp: Timestamp,
  // Document expires automatically after 30 seconds
}
```

## 2. TypeScript Interfaces

```typescript
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
  type: 'text' | 'image' | 'file' | 'system';
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
```

## 3. API Endpoints

### 3.1 Conversation Endpoints

#### GET `/api/messaging/conversations`
**Purpose**: Get user's conversations list
**Query Parameters**:
- `userId` (required): User ID
- `limit` (optional): Number of conversations to return (default: 20)
- `offset` (optional): Pagination offset

**Response**:
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "participants": ["user1", "user2"],
      "type": "direct",
      "lastMessage": {...},
      "unreadCount": {"user1": 3},
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  ],
  "hasMore": false
}
```

#### POST `/api/messaging/conversations`
**Purpose**: Create a new conversation
**Request Body**:
```json
{
  "participants": ["user1", "user2"],
  "type": "direct",
  "metadata": {
    "title": "Group Chat" // optional for groups
  }
}
```

#### GET `/api/messaging/conversations/:conversationId`
**Purpose**: Get conversation details

#### PUT `/api/messaging/conversations/:conversationId/settings`
**Purpose**: Update conversation settings (archive, mute, pin)

### 3.2 Message Endpoints

#### GET `/api/messaging/messages`
**Purpose**: Get messages for a conversation
**Query Parameters**:
- `conversationId` (required)
- `limit` (optional, default: 50)
- `before` (optional): Message ID to paginate before

**Response**:
```json
{
  "messages": [
    {
      "id": "msg_123",
      "senderId": "user1",
      "content": "Hello!",
      "timestamp": "2024-01-01T10:00:00Z",
      "status": {
        "delivered": {"user2": "2024-01-01T10:00:05Z"},
        "read": {"user2": "2024-01-01T10:01:00Z"}
      }
    }
  ],
  "hasMore": false
}
```

#### POST `/api/messaging/messages`
**Purpose**: Send a message
**Request Body**:
```json
{
  "conversationId": "conv_123",
  "type": "text",
  "content": "Hello world!",
  "metadata": {
    "replyTo": "msg_122" // optional
  }
}
```

#### PUT `/api/messaging/messages/:messageId/read`
**Purpose**: Mark message as read
**Request Body**:
```json
{
  "userId": "user2"
}
```

#### PUT `/api/messaging/messages/:messageId/reaction`
**Purpose**: Add/remove reaction to message
**Request Body**:
```json
{
  "userId": "user2",
  "emoji": "👍",
  "action": "add" | "remove"
}
```

### 3.3 User Endpoints

#### GET `/api/messaging/users/:userId`
**Purpose**: Get user profile

#### PUT `/api/messaging/users/:userId/status`
**Purpose**: Update user status
**Request Body**:
```json
{
  "status": "online" | "offline" | "away"
}
```

#### POST `/api/messaging/typing`
**Purpose**: Send typing indicator
**Request Body**:
```json
{
  "conversationId": "conv_123",
  "isTyping": true
}
```

## 4. Real-time Updates Strategy

### 4.1 Firebase Real-time Listeners

#### Conversation List Updates
```typescript
// Listen for conversation changes
const unsubscribe = onSnapshot(
  query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', currentUserId),
    orderBy('updatedAt', 'desc')
  ),
  (snapshot) => {
    // Update conversations list
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    updateConversations(conversations);
  }
);
```

#### Message Updates
```typescript
// Listen for new messages in active conversation
const unsubscribe = onSnapshot(
  query(
    collection(db, 'messages'),
    where('conversationId', '==', activeConversationId),
    orderBy('timestamp', 'asc')
  ),
  (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    updateMessages(messages);
  }
);
```

#### Typing Indicators
```typescript
// Listen for typing indicators
const unsubscribe = onSnapshot(
  collection(db, 'typing_indicators'),
  where('conversationId', '==', activeConversationId),
  (snapshot) => {
    const typingUsers = snapshot.docs
      .filter(doc => doc.data().userId !== currentUserId)
      .map(doc => doc.data().userId);
    updateTypingIndicators(typingUsers);
  }
);
```

### 4.2 Connection Management

- Use Firebase's `onDisconnect` to update user status to offline
- Implement connection state monitoring
- Handle network interruptions gracefully
- Use optimistic updates for better UX

## 5. UI Architecture

### 5.1 Main Layout Structure

```
┌─────────────────────────────────────────────────┐
│ Header (Top Navigation)                        │
├─────────────────┬───────────────────────────────┤
│ Conversations  │ Chat View                     │
│ List           │                               │
│ Sidebar        │ ┌─────────────────────────────┐ │
│                 │ │ Message History            │ │
│ ┌─────────────┐ │ │                            │ │
│ │ Conversation│ │ │ [Message]                  │ │
│ │ 1           │ │ │ [Message]                  │ │
│ │ Unread: 3   │ │ │ [Message]                  │ │
│ └─────────────┘ │ │                            │ │
│ ┌─────────────┐ │ │                            │ │
│ │ Conversation│ │ └────────────────────────────┘ │
│ │ 2           │ │ ┌─────────────────────────────┐ │
│ └─────────────┘ │ │ Message Input Area         │ │
│                 │ │ [Input Field] [Send Button]│ │
│                 │ └────────────────────────────┘ │
└─────────────────┴───────────────────────────────┘
```

### 5.2 Component Hierarchy

```
App
├── MessagingLayout
│   ├── ConversationsSidebar
│   │   ├── ConversationItem[]
│   │   └── NewConversationButton
│   └── ChatView
│       ├── ChatHeader
│       │   ├── ParticipantInfo
│       │   └── ChatActions
│       ├── MessagesContainer
│       │   ├── MessageGroup[]
│       │   │   ├── MessageBubble
│       │   │   └── MessageReactions
│       │   └── TypingIndicator
│       └── MessageInput
│           ├── TextInput
│           ├── AttachmentButton
│           └── SendButton
```

### 5.3 Key UI Components

#### ConversationsSidebar
- List of conversations sorted by last message
- Unread count badges
- Search functionality
- Archive/mute indicators

#### ChatView
- Message bubbles with sender info
- Timestamps and read receipts
- Support for text, images, files
- Reply and forward functionality
- Message reactions

#### MessageInput
- Text input with emoji support
- File attachment (images, documents)
- Voice message recording
- Typing indicators

### 5.4 Responsive Design
- Desktop: Sidebar + chat view layout
- Mobile: Full-screen chat with back navigation
- Tablet: Adaptive layout based on screen size

## 6. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Conversations security
    match /conversations/{conversationId} {
      // Allow read if user is participant
      allow read: if request.auth != null &&
        request.auth.uid in resource.data.participants;

      // Allow create if user is participant and conversation doesn't exist
      allow create: if request.auth != null &&
        request.auth.uid in request.resource.data.participants &&
        request.resource.data.participants.size() <= 2; // Limit to direct chats for now

      // Allow update if user is participant
      allow update: if request.auth != null &&
        request.auth.uid in resource.data.participants;
    }

    // Messages security
    match /messages/{messageId} {
      // Get conversation to check permissions
      function isParticipant() {
        return request.auth != null &&
          exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId)) &&
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.participants;
      }

      allow read: if isParticipant();
      allow create: if isParticipant() &&
        request.auth.uid == request.resource.data.senderId;
      allow update: if isParticipant() &&
        request.auth.uid == resource.data.senderId; // Only sender can edit
    }

    // Typing indicators (temporary, auto-delete)
    match /typing_indicators/{indicatorId} {
      allow read, write: if request.auth != null;
      // These documents should be set to auto-delete after 30 seconds
    }
  }
}
```

## 7. Implementation Approach

### 7.1 Phase 1: Core Messaging
1. Implement basic conversation and message collections
2. Create API endpoints for CRUD operations
3. Build basic UI components
4. Implement real-time listeners

### 7.2 Phase 2: Enhanced Features
1. Add file/image upload functionality
2. Implement message reactions and replies
3. Add typing indicators
4. Implement push notifications

### 7.3 Phase 3: Advanced Features
1. Group chat support
2. Message encryption
3. Offline message queuing
4. Advanced search and filtering

### 7.4 Technical Considerations

#### Performance Optimization
- Use Firestore pagination for large message histories
- Implement message caching in Redux/local state
- Lazy load conversation avatars and media
- Debounce typing indicators

#### Scalability
- Shard large conversations if needed
- Use Firestore composite indexes strategically
- Implement rate limiting for API endpoints
- Consider message archiving for old conversations

#### Security
- Validate all input data
- Implement rate limiting
- Use Firebase Authentication
- Encrypt sensitive message content if required

#### Testing Strategy
- Unit tests for API endpoints
- Integration tests for real-time features
- E2E tests for critical user flows
- Load testing for concurrent users

This design provides a solid foundation for a Viber-like messaging system with room for future enhancements and scaling.