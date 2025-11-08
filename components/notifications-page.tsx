"use client"

import { useNotifications, NotificationConfig } from "@/hooks/use-notifications"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/firebase"
import { doc, updateDoc } from "firebase/firestore"

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

  const handleNotificationClick = async (notification: any) => {
    // Mark as viewed if not already viewed
    if (!notification.viewed) {
      await markAsViewed(notification.id)
    }

    // Navigate to the specified URL
    if (notification.navigate_to) {
      router.push(notification.navigate_to)
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

  const getBadgeBgClass = () => {
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

  return (
    <div className="flex-1 overflow-auto">
      <header className="flex justify-between items-center p-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-sm text-gray-500">All {config.department.toLowerCase()} notifications</p>
        </div>
      </header>

      <main className="p-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No notifications found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  !notification.viewed ? "border-blue-200 bg-blue-50" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={getAvatarBgClass()}>
                        {notification.department_from?.charAt(0) || "N"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 truncate">{notification.title}</h3>
                        <div className="flex items-center space-x-2">
                          {!notification.viewed && (
                            <Badge variant="secondary" className={getBadgeBgClass()}>
                              New
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {notification.created &&
                              formatDistanceToNow(notification.created.toDate(), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mt-1">{notification.description}</p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">From: {notification.department_from}</span>
                        <span className="text-xs text-blue-600">{notification.type}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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