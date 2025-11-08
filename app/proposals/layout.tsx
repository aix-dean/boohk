import type React from "react"

export default function ProposalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This layout bypasses the main app authentication
  // It's specifically for public proposal viewing
  return <div className="min-h-screen">{children}</div>
}
