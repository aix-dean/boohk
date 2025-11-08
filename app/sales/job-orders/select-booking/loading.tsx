import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
      <span className="ml-2 text-lg">Loading bookings...</span>
    </div>
  )
}