import { useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"

export function useUserActivity() {
  const { updateUserActivity } = useAuth()

  const updateActivity = useCallback(() => {
    updateUserActivity()
  }, [updateUserActivity])

  useEffect(() => {
    // Update activity on mount
    updateActivity()

    // Set up event listeners for user interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

    let timeoutId: NodeJS.Timeout

    const handleActivity = () => {
      // Debounce activity updates to avoid excessive calls
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        updateActivity()
      }, 5000) // Update every 5 seconds of activity
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
    }
  }, [updateActivity])

  return { updateActivity }
}