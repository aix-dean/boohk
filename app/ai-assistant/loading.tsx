import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AIAssistantLoading() {
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center mb-6">
        <Skeleton className="h-10 w-10 rounded-full mr-2" />
        <div className="flex items-center">
          <Skeleton className="h-8 w-8 rounded-full mr-2" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="h-[calc(100vh-180px)]">
            <CardHeader>
              <div className="flex items-center">
                <Skeleton className="h-6 w-6 rounded-full mr-2" />
                <div>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-60" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Skeleton className="h-10 w-10 rounded-full mr-2" />
                  <Skeleton className="h-20 w-3/4 rounded-lg" />
                </div>
                <div className="flex items-start justify-end">
                  <Skeleton className="h-16 w-2/3 rounded-lg" />
                  <Skeleton className="h-10 w-10 rounded-full ml-2" />
                </div>
                <div className="flex items-start">
                  <Skeleton className="h-10 w-10 rounded-full mr-2" />
                  <Skeleton className="h-28 w-3/4 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden md:block">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-60" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center">
                <Skeleton className="h-6 w-6 rounded-full mr-2" />
                <Skeleton className="h-6 w-40" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
              <div className="mt-4">
                <Skeleton className="h-4 w-40 mb-2" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-4 w-full mt-1" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
