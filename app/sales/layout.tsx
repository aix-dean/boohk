import type React from "react"
import { SalesChatWidget } from "@/components/sales-chat/sales-chat-widget"
export default function SalesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full">
      {children}
      <SalesChatWidget />
    </div>
  )
}
