"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot, getDoc } from "firebase/firestore"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { useNotifications, NotificationConfig } from "@/hooks/use-notifications"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { doc, updateDoc } from "firebase/firestore"

export function TopNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { userData } = useAuth()
  const { toast } = useToast()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!userData?.uid) return

    let isInitialLoad = true

    const q = query(
      collection(db, "booking"),
      where("company_id", "==", userData.company_id)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' && !isInitialLoad) {
          const booking = change.doc.data()
          const productDoc = await getDoc(doc(db, "products", booking.product_id))
          const productName = productDoc.exists() ? productDoc.data().name : "Unknown Product"
          const audio = new Audio('/notif/boohk-notif.m4a')
          await audio.play().catch(() => {
            // Ignore autoplay policy errors
          })
          toast({
            title: "New Booking Request",
            description: `New request for ${productName}`,
            onClick: () => router.push(`/sales/products/${booking.product_id}`),
            className: "bg-[#009eff] text-white border-[#009eff]",
            duration: 10000,
            action: (
              <ToastAction
                altText="View Product"
                onClick={() => router.push(`/sales/products/${booking.product_id}`)}
              >
                View
              </ToastAction>
            ),
          })
        }
      })
      isInitialLoad = false
    })

    return () => unsubscribe()
  }, [userData?.uid, toast, router])

  const isSalesSection = pathname.startsWith("/sales")
  const isLogisticsSection = pathname.startsWith("/logistics")
  const isCmsSection = pathname.startsWith("/cms")
  const isAdminSection = pathname.startsWith("/admin")
  const isItSection = pathname.startsWith("/it")
  const isFinanceSection = pathname.startsWith("/finance")
  const isTreasurySection = pathname.startsWith("/treasury")
  const isAccountingSection = pathname.startsWith("/accounting")
  const isBusinessSection = pathname.startsWith("/business")

  const getNavBgColor = () => {
    if (isSalesSection) return "bg-department-sales-red"
    if (isAdminSection) return "bg-[#2a31b4]"
    if (isCmsSection) return "bg-department-creatives-orange"
    if (isItSection) return "bg-[#318080]"
    if (isFinanceSection) return "bg-department-finance-green"
    if (isTreasurySection) return "bg-[#379334]"
    if (isAccountingSection) return "bg-department-accounting-purple"
    if (isBusinessSection) return "bg-[#4169e1]"
    if (isLogisticsSection) return "bg-[#48a7fa]"
    return "bg-[#A1A1A1]"
  }

  const getRoleBgColor = () => {
    const userRole = userData?.role
    if (!userRole) return "bg-[#A1A1A1]"
    switch (userRole) {
      case 'sales':
        return "bg-department-sales-red"
      case 'admin':
        return "bg-[#2a31b4]"
      case 'cms':
        return "bg-department-creatives-orange"
      case 'it':
        return "bg-[#318080]"
      case 'finance':
        return "bg-department-finance-green"
      case 'treasury':
        return "bg-[#379334]"
      case 'accounting':
        return "bg-department-accounting-purple"
      case 'business':
        return "bg-[#4169e1]"
      case 'logistics':
        return "bg-[#48a7fa]"
      default:
        return "bg-[#A1A1A1]"
    }
  }

  const navBgColor = getNavBgColor()

  const getNotificationConfig = (): NotificationConfig | null => {
    if (isSalesSection) {
      return {
        department: "Sales",
        colorScheme: "blue",
        notificationsPath: "/sales/notifications"
      }
    }
    if (isLogisticsSection) {
      return {
        department: "Logistics",
        colorScheme: "sky",
        notificationsPath: "/logistics/notifications"
      }
    }
    if (isAdminSection) {
      return {
        department: "Admin",
        colorScheme: "purple",
        notificationsPath: "/admin/notifications"
      }
    }
    if (isItSection) {
      return {
        department: "IT",
        colorScheme: "purple",
        notificationsPath: "/it/notifications"
      }
    }
    if (isFinanceSection) {
      return {
        department: "Finance",
        colorScheme: "green",
        notificationsPath: "/finance/notifications"
      }
    }
    if (isTreasurySection) {
      return {
        department: "Treasury",
        colorScheme: "green",
        notificationsPath: "/treasury/notifications"
      }
    }
    if (isAccountingSection) {
      return {
        department: "Accounting",
        colorScheme: "purple",
        notificationsPath: "/accounting/notifications"
      }
    }
    if (isBusinessSection) {
      return {
        department: "Business Dev",
        colorScheme: "blue",
        notificationsPath: "/business/notifications"
      }
    }
    return null
  }

  const notificationConfig = getNotificationConfig()
  const { notifications, unreadCount, loading } = notificationConfig ? useNotifications(notificationConfig) : { notifications: [], unreadCount: 0, loading: false }

  // Debug logging
  console.log('Notification Debug:', {
    pathname,
    notificationConfig,
    notificationsCount: notifications.length,
    unreadCount,
    loading,
    userDataCompanyId: userData?.company_id
  })

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
      const basePath = notification.navigate_to.startsWith('/')
        ? notification.navigate_to
        : `/${notification.navigate_to}`

      router.push(basePath)
    }
  }

  const getAvatarBgClass = () => {
    if (!notificationConfig) return 'bg-blue-100 text-blue-600'
    switch (notificationConfig.colorScheme) {
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


  const getNotificationIcon = (type: string) => {
    // Use the same bell icon for all notifications
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 21.75C13.1 21.75 14 20.85 14 19.75H10C10 20.85 10.89 21.75 12 21.75ZM18 15.75V10.75C18 7.68 16.36 5.11 13.5 4.43V3.75C13.5 2.92 12.83 2.25 12 2.25C11.17 2.25 10.5 2.92 10.5 3.75V4.43C7.63 5.11 6 7.67 6 10.75V15.75L4 17.75V18.75H20V17.75L18 15.75Z"/>
      </svg>
    )
  }


  return (
    <header className="relative flex h-14 items-center justify-end px-6 overflow-hidden">
      {/* Solid background */}
      <div className={`absolute inset-0 ${navBgColor}`} />

      {/* White gradient overlay on left half */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(255, 255, 255, 0.63) 0%, rgba(255, 255, 255, 0.00) 100%)", width: "50%" }}
      />

      {/* Content */}
      <div className="relative flex items-center gap-6">
        {/* Time and Date */}
        <div className="text-sm font-medium text-white">
          {format(currentTime, "h:mm a | MMM d, yyyy")}
        </div>

        {/* Notification Icon */}
        {notificationConfig && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative p-2 hover:bg-gray-50/20 transition-colors rounded">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ width: "24px", height: "24px", flexShrink: 0 }}
                >
                  <path
                    d="M12 21.75C13.1 21.75 14 20.85 14 19.75H10C10 20.85 10.89 21.75 12 21.75ZM18 15.75V10.75C18 7.68 16.36 5.11 13.5 4.43V3.75C13.5 2.92 12.83 2.25 12 2.25C11.17 2.25 10.5 2.92 10.5 3.75V4.43C7.63 5.11 6 7.67 6 10.75V15.75L4 17.75V18.75H20V17.75L18 15.75Z"
                    fill="white"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#1a0f5c] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-sm">Notifications</h3>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500 text-sm">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.slice(0, 5).map((notification) => (
                      <div
                        key={notification.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className={getAvatarBgClass()}>
                              {getNotificationIcon(notification.type)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {!notification.viewed && <div className={`${getNavBgColor()} w-2 h-2 rounded-full mr-2 flex-shrink-0`}></div>}
                                <h4 className="font-bold text-gray-900 text-xs truncate">
                                  {notification.title}
                                </h4>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] text-gray-500">
                                  {notification.created &&
                                    formatDistanceToNow(notification.created.toDate(), { addSuffix: true })}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {notification.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-gray-200">
                <button
                  onClick={() => router.push(notificationConfig.notificationsPath)}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 text-center"
                >
                  View all notifications
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* User Profile Icon */}
        <button className="p-2 hover:bg-gray-50/20 transition-colors rounded" onClick={() => router.push('/account')}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: "24px", height: "24px", flexShrink: 0 }}
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6C13.93 6 15.5 7.57 15.5 9.5C15.5 11.43 13.93 13 12 13C10.07 13 8.5 11.43 8.5 9.5C8.5 7.57 10.07 6 12 6ZM12 20C9.97 20 7.57 19.18 5.86 17.12C7.55 15.8 9.68 15 12 15C14.32 15 16.45 15.8 18.14 17.12C16.43 19.18 14.03 20 12 20Z"
              fill="white"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
