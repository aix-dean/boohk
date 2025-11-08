import type { Timestamp } from "firebase/firestore"

export interface SalesThread {
  id: string
  participants: string[] // Array of user IDs in the conversation
  receiverId: string // The other user's ID
  receiver_name?: string // Name from iboard_users collection
  receiver_photo_url?: string // Photo URL from iboard_users
  seller_photo?: string // Seller's photo URL
  lastMessage?: {
    text: string
    timestamp: Timestamp
  } // Last message with text and timestamp
  createdAt: Timestamp // When the thread was created
  productId?: string // Optional: if chat is about a specific product/project
  productName?: string // Optional: product/project name for context
  status?: string // Thread status (active, archived)
  priority?: "low" | "medium" | "high" | "urgent" // Thread priority
}

export interface SalesMessage {
  id: string
  threadId: string // Reference to the thread
  senderId: string // Who sent the message
  text: string // Message content
  timestamp: Timestamp // When message was sent
  read: boolean // Whether message has been read
  fileUrl?: string // Optional: attached file URL
  fileName?: string // Optional: original file name
  fileType?: string // Optional: MIME type of file
  fileSize?: number // Optional: file size in bytes
}

export interface ChatUser {
  id: string
  name: string
  email: string
  photoUrl?: string
  department?: string
  role?: string
  isOnline?: boolean
  lastSeen?: Timestamp
}
