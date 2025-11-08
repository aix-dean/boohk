"use client"

import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"

export function useUnreadMessages() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0)
      setUnreadByThread({})
      return
    }

    console.log("Setting up unread messages listener for user:", user.uid)

    // Listen to all unread messages where the user is not the sender
    const messagesQuery = query(
      collection(db, "messages"),
      where("senderId", "!=", user.uid),
      where("read", "==", false),
      orderBy("senderId"), // Required for != queries
      orderBy("timestamp", "desc"),
    )

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      async (messagesSnapshot) => {
        console.log("Unread messages snapshot received, size:", messagesSnapshot.size)

        // Get all threads where user is a participant
        const threadsQuery = query(collection(db, "threads"), where("participants", "array-contains", user.uid))

        const threadsSnapshot = await new Promise((resolve) => {
          const unsubscribe = onSnapshot(threadsQuery, (snapshot) => {
            unsubscribe()
            resolve(snapshot)
          })
        })

        const userThreadIds = threadsSnapshot.docs.map((doc) => doc.id)
        console.log("User thread IDs:", userThreadIds)

        // Filter messages to only include threads where the user is a participant
        const relevantMessages = []
        messagesSnapshot.forEach((doc) => {
          const message = { id: doc.id, ...doc.data() }
          if (userThreadIds.includes(message.threadId)) {
            relevantMessages.push(message)
          }
        })

        console.log("Relevant unread messages:", relevantMessages.length)

        // Count unread messages by thread
        const newUnreadByThread = {}
        let totalUnread = 0

        relevantMessages.forEach((message) => {
          newUnreadByThread[message.threadId] = (newUnreadByThread[message.threadId] || 0) + 1
          totalUnread++
        })

        console.log("Updated unread counts:", {
          total: totalUnread,
          byThread: newUnreadByThread,
        })

        setUnreadByThread(newUnreadByThread)
        setUnreadCount(totalUnread)
      },
      (error) => {
        console.error("Error listening to unread messages:", error)
        setUnreadCount(0)
        setUnreadByThread({})
      },
    )

    return () => {
      console.log("Cleaning up unread messages listener")
      unsubscribeMessages()
    }
  }, [user?.uid])

  return { unreadCount, unreadByThread }
}
