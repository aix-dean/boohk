import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function SiteNotFound() {
  return (
    <div className="container mx-auto py-12 flex flex-col items-center justify-center text-center">
      <div className="bg-red-100 p-4 rounded-full mb-4">
        <AlertCircle className="h-12 w-12 text-red-600" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Site Not Found</h1>
      <p className="text-gray-500 mb-6 max-w-md">The site you're looking for doesn't exist or has been removed.</p>
      <Button asChild>
        <Link href="/operations/dashboard">Return to Dashboard</Link>
      </Button>
    </div>
  )
}
