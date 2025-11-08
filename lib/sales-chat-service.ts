import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import type { SalesThread, SalesMessage, ChatUser } from "@/lib/types/sales-chat"

export class SalesChatService {
  private get threadsCollection() {
    return collection(db, "threads")
  }

  private get messagesCollection() {
    return collection(db, "messages")
  }

  private get usersCollection() {
    return collection(db, "users")
  }

  // Helper function to get display name with proper fallback hierarchy
  private getDisplayName(userData: any): string {
    console.log("=== SALES CHAT: Processing user data ===", userData)
    console.log("=== SALES CHAT: Available fields ===", Object.keys(userData))

    // Try first name + last name
    const firstName = userData.first_name?.trim() || ""
    const lastName = userData.last_name?.trim() || ""

    console.log("=== SALES CHAT: Extracted names ===", {
      firstName,
      lastName,
      firstNameRaw: userData.first_name,
      lastNameRaw: userData.last_name,
    })

    if (firstName && lastName) {
      const fullName = `${firstName} ${lastName}`
      console.log("=== SALES CHAT: Using full name ===", fullName)
      return fullName
    } else if (firstName) {
      console.log("=== SALES CHAT: Using first name only ===", firstName)
      return firstName
    } else if (lastName) {
      console.log("=== SALES CHAT: Using last name only ===", lastName)
      return lastName
    }

    // Fallback to email
    if (userData.email?.trim()) {
      console.log("=== SALES CHAT: Falling back to email ===", userData.email.trim())
      return userData.email.trim()
    }

    // Fallback to phone number
    if (userData.phone?.trim()) {
      console.log("=== SALES CHAT: Falling back to phone ===", userData.phone.trim())
      return userData.phone.trim()
    }

    // Final fallback
    console.log("=== SALES CHAT: Using final fallback: Unknown User ===")
    return "Unknown User"
  }

  // Get user info by ID
  async getUserInfo(userId: string): Promise<{ name: string; photoUrl: string; email: string } | null> {
    try {
      console.log("=== SALES CHAT: Getting user info for ID ===", userId)

      const userDoc = await getDoc(doc(this.usersCollection, userId))
      if (!userDoc.exists()) {
        console.log("=== SALES CHAT: User document does not exist for ID ===", userId)
        return null
      }

      const userData = userDoc.data()
      console.log("=== SALES CHAT: Raw user data retrieved ===", userData)

      const name = this.getDisplayName(userData)
      console.log("=== SALES CHAT: Final display name ===", name)

      const result = {
        name,
        photoUrl: userData.photo_url || "",
        email: userData.email || "",
      }

      console.log("=== SALES CHAT: Final user info result ===", result)
      return result
    } catch (error) {
      console.error("=== SALES CHAT: Error getting user info ===", error)
      return null
    }
  }

  // Create a new thread between sales team members
  async createThread(
    senderId: string,
    receiverId: string,
    projectId: string | null = null,
    projectName: string | null = null,
    priority: "low" | "medium" | "high" | "urgent" = "medium",
  ): Promise<string> {
    try {
      // Check if thread already exists between these users
      const existingThread = await this.findExistingThread(senderId, receiverId)
      if (existingThread) {
        return existingThread.id
      }

      // Get receiver info from users collection
      const receiverInfo = await this.getUserInfo(receiverId)
      const senderInfo = await this.getUserInfo(senderId)

      const thread: Omit<SalesThread, "id"> = {
        participants: [senderId, receiverId],
        receiverId,
        receiver_name: receiverInfo?.name || "Unknown User",
        receiver_photo_url: receiverInfo?.photoUrl || "",
        seller_photo: senderInfo?.photoUrl || "",
        createdAt: serverTimestamp() as Timestamp,
        lastMessage: {
          text: "",
          timestamp: serverTimestamp() as Timestamp,
        },
        productId: projectId,
        productName: projectName,
        status: "active",
        priority,
      }

      const docRef = await addDoc(this.threadsCollection, thread)
      return docRef.id
    } catch (error) {
      console.error("Error creating sales thread:", error)
      throw error
    }
  }

  // Find existing thread between two users
  private async findExistingThread(senderId: string, receiverId: string): Promise<SalesThread | null> {
    try {
      const q = query(this.threadsCollection, where("participants", "array-contains", senderId))

      const querySnapshot = await getDocs(q)

      for (const doc of querySnapshot.docs) {
        const thread = { id: doc.id, ...doc.data() } as SalesThread
        if (thread.participants.includes(receiverId)) {
          return thread
        }
      }

      return null
    } catch (error) {
      console.error("Error finding existing thread:", error)
      return null
    }
  }

  // Send a message
  async sendMessage(threadId: string, senderId: string, text: string, file?: File, replyTo?: string): Promise<string> {
    try {
      let fileUrl = ""
      let fileName = ""
      let fileType = ""
      let fileSize = 0

      // Handle file upload if provided
      if (file) {
        const fileRef = ref(storage, `chat_files/${threadId}/${Date.now()}_${file.name}`)
        await uploadBytes(fileRef, file)
        fileUrl = await getDownloadURL(fileRef)
        fileName = file.name
        fileType = file.type
        fileSize = file.size
      }

      const message: Omit<SalesMessage, "id"> = {
        threadId,
        senderId,
        text,
        timestamp: serverTimestamp() as Timestamp,
        read: false, // Always start as unread
        ...(fileUrl && { fileUrl, fileName, fileType, fileSize }),
      }

      const messageRef = await addDoc(this.messagesCollection, message)

      // Update thread with last message info
      await updateDoc(doc(this.threadsCollection, threadId), {
        lastMessage: {
          text: text || `Sent a ${file ? "file" : "message"}`,
          timestamp: serverTimestamp(),
        },
      })

      console.log("Message sent:", { threadId, senderId, text: text.substring(0, 50) })

      return messageRef.id
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    }
  }

  // Listen to threads for a user
  listenToThreads(userId: string, callback: (threads: SalesThread[]) => void): Unsubscribe {
    console.log("=== SALES CHAT SERVICE: Starting to listen to threads for user ===", userId)

    const q = query(this.threadsCollection, where("participants", "array-contains", userId))

    return onSnapshot(
      q,
      async (querySnapshot) => {
        console.log("=== SALES CHAT SERVICE: Received snapshot with", querySnapshot.size, "documents")

        const threads: SalesThread[] = []

        for (const docSnapshot of querySnapshot.docs) {
          const threadData = docSnapshot.data()
          console.log("=== SALES CHAT SERVICE: Processing thread document ===", {
            id: docSnapshot.id,
            data: threadData,
          })

          const thread = {
            id: docSnapshot.id,
            ...threadData,
            lastMessage: threadData.lastMessage || { text: "", timestamp: threadData.createdAt },
            status: threadData.status || "active",
            priority: threadData.priority || "medium",
          } as SalesThread

          // Get the other participant (not the current user)
          const otherParticipantId = thread.participants.find((p) => p !== userId)
          console.log("=== SALES CHAT SERVICE: Other participant ID ===", otherParticipantId)

          // ALWAYS fetch fresh user info to ensure we have the latest data
          if (otherParticipantId) {
            console.log("=== SALES CHAT SERVICE: Fetching fresh receiver info for ===", otherParticipantId)

            const receiverInfo = await this.getUserInfo(otherParticipantId)
            if (receiverInfo) {
              console.log("=== SALES CHAT SERVICE: Got receiver info ===", receiverInfo)

              thread.receiverId = otherParticipantId
              thread.receiver_name = receiverInfo.name
              thread.receiver_photo_url = receiverInfo.photoUrl

              // Update the thread in Firestore with the fetched info
              try {
                await updateDoc(doc(this.threadsCollection, thread.id), {
                  receiverId: otherParticipantId,
                  receiver_name: receiverInfo.name,
                  receiver_photo_url: receiverInfo.photoUrl,
                })
                console.log("=== SALES CHAT SERVICE: Updated thread with fresh user info ===")
              } catch (error) {
                console.error("Error updating thread with receiver info:", error)
              }
            } else {
              console.log("=== SALES CHAT SERVICE: No receiver info found for ===", otherParticipantId)
            }
          }

          threads.push(thread)
        }

        console.log("=== SALES CHAT SERVICE: Final processed threads ===", threads)

        // Sort threads manually to handle null timestamps
        threads.sort((a, b) => {
          const aTime = a.lastMessage?.timestamp?.toDate?.() || a.createdAt?.toDate?.() || new Date(0)
          const bTime = b.lastMessage?.timestamp?.toDate?.() || b.createdAt?.toDate?.() || new Date(0)
          return bTime.getTime() - aTime.getTime()
        })

        callback(threads)
      },
      (error) => {
        console.error("Error listening to sales threads:", error)
      },
    )
  }

  // Listen to messages in a thread
  listenToMessages(threadId: string, callback: (messages: SalesMessage[]) => void): Unsubscribe {
    const q = query(this.messagesCollection, where("threadId", "==", threadId), orderBy("timestamp", "asc"))

    return onSnapshot(
      q,
      (querySnapshot) => {
        const messages: SalesMessage[] = []
        querySnapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() } as SalesMessage)
        })
        callback(messages)
      },
      (error) => {
        console.error("Error listening to sales messages:", error)
      },
    )
  }

  // Mark messages as read - ONLY call this explicitly when viewing a conversation
  async markMessagesAsRead(threadId: string, userId: string): Promise<void> {
    try {
      console.log("Marking messages as read for thread:", threadId, "user:", userId)

      const q = query(
        this.messagesCollection,
        where("threadId", "==", threadId),
        where("senderId", "!=", userId),
        where("read", "==", false),
      )

      const querySnapshot = await getDocs(q)
      console.log("Found", querySnapshot.size, "unread messages to mark as read")

      const updatePromises = querySnapshot.docs.map((doc) => updateDoc(doc.ref, { read: true }))

      await Promise.all(updatePromises)
      console.log("Successfully marked messages as read")
    } catch (error) {
      console.error("Error marking messages as read:", error)
    }
  }

  // Get sales team members
  async getSalesTeamMembers(): Promise<ChatUser[]> {
    try {
      const q = query(this.usersCollection, limit(50))
      const querySnapshot = await getDocs(q)

      const users: ChatUser[] = []
      querySnapshot.forEach((doc) => {
        const userData = doc.data()
        const name = this.getDisplayName(userData)

        users.push({
          id: doc.id,
          name,
          email: userData.email || "",
          photoUrl: userData.photo_url || "",
          department: userData.department || "sales",
          role: userData.type || "user",
        })
      })

      return users
    } catch (error) {
      console.error("Error getting sales team members:", error)
      return []
    }
  }

  // Archive a thread
  async archiveThread(threadId: string): Promise<void> {
    try {
      await updateDoc(doc(this.threadsCollection, threadId), {
        status: "archived",
      })
    } catch (error) {
      console.error("Error archiving thread:", error)
      throw error
    }
  }

  // Update thread priority
  async updateThreadPriority(threadId: string, priority: "low" | "medium" | "high" | "urgent"): Promise<void> {
    try {
      await updateDoc(doc(this.threadsCollection, threadId), {
        priority,
      })
    } catch (error) {
      console.error("Error updating thread priority:", error)
      throw error
    }
  }

  // Delete a message
  async deleteMessage(messageId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.messagesCollection, messageId))
    } catch (error) {
      console.error("Error deleting message:", error)
    }
  }

  // Edit a message
  async editMessage(messageId: string, newText: string): Promise<void> {
    try {
      await updateDoc(doc(this.messagesCollection, messageId), {
        text: newText,
        editedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error("Error editing message:", error)
    }
  }

  // Search messages
  async searchMessages(threadId: string, searchTerm: string): Promise<SalesMessage[]> {
    try {
      const q = query(this.messagesCollection, where("threadId", "==", threadId), orderBy("timestamp", "desc"))

      const querySnapshot = await getDocs(q)
      const messages: SalesMessage[] = []

      querySnapshot.forEach((doc) => {
        const message = { id: doc.id, ...doc.data() } as SalesMessage
        if (message.text.toLowerCase().includes(searchTerm.toLowerCase())) {
          messages.push(message)
        }
      })

      return messages
    } catch (error) {
      console.error("Error searching messages:", error)
      return []
    }
  }
}

// Export singleton instance
export const salesChatService = new SalesChatService()
