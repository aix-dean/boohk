import { Skeleton } from "@/components/ui/skeleton"

export default function BusinessInventoryLoading() {
  return (
    <div className="flex min-h-screen">
      <div className="flex-1 p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="border border-gray-200 shadow-md rounded-xl overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
