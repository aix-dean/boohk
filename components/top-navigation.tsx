"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { format } from "date-fns"

export function TopNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const isSalesSection = pathname.startsWith("/sales")
  const isLogisticsSection = pathname.startsWith("/logistics")
  const isCmsSection = pathname.startsWith("/cms")
  const isAdminSection = pathname.startsWith("/admin")
  const isItSection = pathname.startsWith("/it")
  const isFinanceSection = pathname.startsWith("/finance")
  const isTreasurySection = pathname.startsWith("/treasury")
  const isAccountingSection = pathname.startsWith("/accounting")
  const isBusinessSection = pathname.startsWith("/business")

  const navBgColor = isSalesSection
    ? "bg-department-sales-red"
    : isAdminSection
      ? "bg-[#2a31b4]"
      : isCmsSection
        ? "bg-department-creatives-orange"
        : isItSection
          ? "bg-[#318080]"
          : isFinanceSection
            ? "bg-department-finance-green"
            : isTreasurySection
              ? "bg-[#379334]"
              : isAccountingSection
                ? "bg-department-accounting-purple"
                : isBusinessSection
                  ? "bg-[#4169e1]"
                  : isLogisticsSection
                    ? "bg-[#48a7fa]"
                    : "bg-[#A1A1A1]"

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
        </button>

        {/* Message Icon */}
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
              d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM9 11H7V9H9V11ZM13 11H11V9H13V11ZM17 11H15V9H17V11Z"
              fill="white"
            />
          </svg>
        </button>

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
