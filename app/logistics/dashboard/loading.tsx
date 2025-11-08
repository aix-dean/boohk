import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex-1 p-4">
      <Skeleton className="h-8 w-64 mb-2" />
      <Skeleton className="h-4 w-48 mb-8" />

      <div className="flex gap-4 mb-6">
        <Skeleton className="h-10 w-[250px]" />
      </div>

      <div className="flex gap-4 mb-6">
        <Skeleton className="h-10 w-[450px]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(8)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
      </div>
    </div>
  )
}
