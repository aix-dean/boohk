import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function ChatThreadLoading() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header Skeleton */}
      <div className="flex items-center space-x-4 mb-6">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Chat Container Skeleton */}
      <Card className="h-[600px] flex flex-col">
        <CardContent className="flex-1 p-4">
          <div className="space-y-4">
            {/* Message skeletons */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <div className="flex items-start space-x-2 max-w-[70%]">
                  {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-48" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>

        {/* Input area skeleton */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </Card>
    </div>
  )
}
