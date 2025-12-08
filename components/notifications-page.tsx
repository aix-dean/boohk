"use client"

import { useNotifications, NotificationConfig } from "@/hooks/use-notifications"
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/firebase"
import { doc, updateDoc, writeBatch } from "firebase/firestore"

interface NotificationsPageProps {
  config: NotificationConfig
}

export function NotificationsPage({ config }: NotificationsPageProps) {
  const { notifications, loading } = useNotifications(config)
  const router = useRouter()

  const markAsViewed = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId)
      await updateDoc(notificationRef, {
        viewed: true,
      })
    } catch (error) {
      console.error("Error marking notification as viewed:", error)
    }
  }

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.viewed)
    if (unreadNotifications.length === 0) return

    try {
      const batch = writeBatch(db)
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, "notifications", notification.id)
        batch.update(notificationRef, { viewed: true })
      })
      await batch.commit()
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const groupNotificationsByDate = (notifications: any[]) => {
    const groups: { [key: string]: any[] } = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: []
    }

    notifications.forEach(notification => {
      const date = notification.created?.toDate()
      if (!date) {
        groups.Older.push(notification)
        return
      }

      if (isToday(date)) {
        groups.Today.push(notification)
      } else if (isYesterday(date)) {
        groups.Yesterday.push(notification)
      } else if (isThisWeek(date)) {
        groups["This Week"].push(notification)
      } else {
        groups.Older.push(notification)
      }
    })

    return groups
  }

  const handleNotificationClick = async (notification: any) => {
    // Mark as viewed if not already viewed
    if (!notification.viewed) {
      await markAsViewed(notification.id)
    }

    // Navigate to the specified URL
    if (notification.navigate_to) {
      const basePath = notification.navigate_to.startsWith('/')
        ? notification.navigate_to
        : `/${notification.navigate_to}`

      router.push(basePath)
    }
  }

  const getAvatarBgClass = () => {
    switch (config.colorScheme) {
      case 'blue':
        return 'bg-blue-100 text-blue-600'
      case 'sky':
        return 'bg-sky-100 text-sky-600'
      case 'purple':
        return 'bg-purple-100 text-purple-600'
      default:
        return 'bg-blue-100 text-blue-600'
    }
  }

  const getNavBgColor = () => {
    switch (config.department) {
      case 'Sales':
        return "bg-department-sales-red"
      case 'Logistics':
        return "bg-[#48a7fa]"
      case 'Admin':
        return "bg-[#2a31b4]"
      case 'IT':
        return "bg-[#318080]"
      case 'Treasury':
        return "bg-[#379334]"
      case 'Accounting':
        return "bg-department-accounting-purple"
      case 'Business Dev':
        return "bg-[#4169e1]"
      default:
        return "bg-[#A1A1A1]"
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'success':
      case 'completed':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        )
      case 'warning':
      case 'alert':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        )
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.75C13.1 21.75 14 20.85 14 19.75H10C10 20.85 10.89 21.75 12 21.75ZM18 15.75V10.75C18 7.68 16.36 5.11 13.5 4.43V3.75C13.5 2.92 12.83 2.25 12 2.25C11.17 2.25 10.5 2.92 10.5 3.75V4.43C7.63 5.11 6 7.67 6 10.75V15.75L4 17.75V18.75H20V17.75L18 15.75Z"/>
          </svg>
        )
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <header className="flex justify-between items-center p-6 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-600 mt-1">All {config.department.toLowerCase()} notifications</p>
        </div>
        {notifications.some(n => !n.viewed) && (
          <Button
            onClick={markAllAsRead}
            variant="outline"
            size="sm"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Mark all as read
          </Button>
        )}
      </header>

      <main className="p-6">
        {loading ? (
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.75C13.1 21.75 14 20.85 14 19.75H10C10 20.85 10.89 21.75 12 21.75ZM18 15.75V10.75C18 7.68 16.36 5.11 13.5 4.43V3.75C13.5 2.92 12.83 2.25 12 2.25C11.17 2.25 10.5 2.92 10.5 3.75V4.43C7.63 5.11 6 7.67 6 10.75V15.75L4 17.75V18.75H20V17.75L18 15.75Z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
            <p className="text-gray-500">You'll see your notifications here when you receive them.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupNotificationsByDate(notifications)).map(([groupName, groupNotifications]) => {
              if (groupNotifications.length === 0) return null
              return (
                <div key={groupName}>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{groupName}</h2>
                  <div className="space-y-3">
                    {groupNotifications.map((notification) => (
                      <Card
                        key={notification.id}
                        className={`cursor-pointer hover:shadow-lg transition-all duration-200 rounded-xl ${
                          !notification.viewed
                            ? "border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white shadow-sm"
                            : "hover:border-gray-300"
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <Avatar className="w-12 h-12 flex-shrink-0">
                              <AvatarFallback className={`${getAvatarBgClass()} shadow-sm`}>
                                {getNotificationIcon(notification.type)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center mb-1">
                                    {!notification.viewed && <div className={`${getNavBgColor()} w-2 h-2 rounded-full mr-2 flex-shrink-0`}></div>}
                                    <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">
                                      {notification.title}
                                    </h3>
                                  </div>
                                  <p className="text-sm text-gray-600 leading-relaxed">{notification.description}</p>
                                </div>
                                <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {notification.created &&
                                      formatDistanceToNow(notification.created.toDate(), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

// Pre-configured page components for specific departments
export function SalesNotificationsPage() {
  return <NotificationsPage config={{
    department: "Sales",
    colorScheme: "blue",
    notificationsPath: "/sales/notifications"
  }} />
}

export function LogisticsNotificationsPage() {
  return <NotificationsPage config={{
    department: "Logistics",
    colorScheme: "sky",
    notificationsPath: "/logistics/notifications"
  }} />
}

export function AdminNotificationsPage() {
  return <NotificationsPage config={{
    department: "Admin",
    colorScheme: "purple",
    notificationsPath: "/admin/notifications"
  }} />
}

export function ITNotificationsPage() {
  return <NotificationsPage config={{
    department: "IT",
    colorScheme: "purple",
    notificationsPath: "/it/notifications"
  }} />
}

export function TreasuryNotificationsPage() {
  return <NotificationsPage config={{
    department: "Treasury",
    colorScheme: "green",
    notificationsPath: "/treasury/notifications"
  }} />
}

export function BusinessDevNotificationsPage() {
  return <NotificationsPage config={{
    department: "Business Dev",
    colorScheme: "blue",
    notificationsPath: "/business/notifications"
  }} />
}