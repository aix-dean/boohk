import { Skeleton } from "@/components/ui/skeleton"

export default function BookingDetailsLoading() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Skeleton className="h-10 w-20 mr-4" />
        <Skeleton className="h-8 w-48" />
      </div>

      <Skeleton className="h-16 w-full mb-8" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="p-4">
            <Skeleton className="h-48 w-full mb-4" />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="p-4">
            <div className="mb-6 flex items-center">
              <Skeleton className="h-20 w-20 rounded-md mr-4" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-full mt-6" />
          </div>
        </div>
      </div>
    </div>
  )
}
