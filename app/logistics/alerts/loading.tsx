import { Skeleton } from "@/components/ui/skeleton"

export default function NewsAndAlertsLoading() {
  return (
    <div className="flex-1 overflow-auto">
      <header className="flex justify-between items-center p-4 border-b border-gray-200">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
      </header>

      <main className="p-4 space-y-6">
        <section>
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-4 w-80 mb-3" />

          <div className="w-full">
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        </section>

        <section>
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-[100px] w-full rounded-lg" />
        </section>
      </main>
    </div>
  )
}
