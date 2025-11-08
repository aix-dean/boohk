import { Card, CardContent } from "@/components/ui/card"
import { Package2 } from "lucide-react"
import Link from "next/link"

// Update the page title
export default function LogisticsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Logistics Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/logistics/dashboard" className="block">
          <Card className="hover:bg-gray-50 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <Package2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Dashboard</h3>
                <p className="text-sm text-gray-500">Overview of key metrics and activities</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/logistics/products" className="block">
          <Card className="hover:bg-gray-50 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="bg-blue-100 p-2 rounded-full">
                <Package2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Products</h3>
                <p className="text-sm text-gray-500">Manage all products in the system</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
