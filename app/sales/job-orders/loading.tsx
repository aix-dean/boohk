import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-8 w-20" />
      </div>

      <Skeleton className="h-10 w-full max-w-md mb-4" />

      <div className="flex-1 overflow-hidden border rounded-lg">
        <Skeleton className="h-12 w-full" /> {/* Table Header */}
        <div className="space-y-2 p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton className="fixed bottom-6 right-6 h-14 w-36 rounded-full" />
    </div>
  )
}
