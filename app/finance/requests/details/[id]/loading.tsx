export default function RequestDetailsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-muted rounded animate-pulse" />
        <div>
          <div className="h-8 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-32 mt-2 animate-pulse" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-lg border">
            <div className="p-6">
              <div className="h-6 bg-muted rounded w-32 animate-pulse mb-4" />
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border">
            <div className="p-6">
              <div className="h-6 bg-muted rounded w-32 animate-pulse mb-4" />
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg border">
        <div className="p-6">
          <div className="h-6 bg-muted rounded w-32 animate-pulse mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  <div>
                    <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                    <div className="h-3 bg-muted rounded w-20 mt-1 animate-pulse" />
                  </div>
                </div>
                <div className="h-8 bg-muted rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
