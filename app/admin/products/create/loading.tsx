import { Skeleton } from "@/components/ui/skeleton"

export default function AdminProductCreateLoading() {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Skeleton className="h-9 w-24" />
        </div>

        <div className="border rounded-lg">
          <div className="p-6 border-b">
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-24 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Media Upload */}
            <div className="space-y-4">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-40 w-full" />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
