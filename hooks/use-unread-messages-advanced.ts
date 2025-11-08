"use client"

import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export function useUnreadMessagesAdvanced(userId: string | null) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      return
    }

    // Get all threads where user is a participant
    const threadsQuery = query(collection(db, "threads"), where("participants", "array-contains", userId))

    const unsubscribeThreads = onSnapshot(threadsQuery, async (threadsSnapshot) => {
      const threadIds = threadsSnapshot.docs.map((doc) => doc.id)

      if (threadIds.length === 0) {
        setUnreadCount(0)
        return
      }

      // Count unread messages across all threads
      let totalUnread = 0

      // For each thread, count unread messages not sent by current user
      const unreadPromises = threadIds.map(async (threadId) => {
        const messagesQuery = query(
          collection(db, "messages"),
          where("threadId", "==", threadId),
          where("senderId", "!=", userId),
          where("read", "==", false),
        )

        const messagesSnapshot = await getDocs(messagesQuery)
        return messagesSnapshot.size
      })

      const unreadCounts = await Promise.all(unreadPromises)
      totalUnread = unreadCounts.reduce((sum, count) => sum + count, 0)

      setUnreadCount(totalUnread)
    })

    return () => {
      unsubscribeThreads()
    }
  }, [userId])

  return { unreadCount }
}
