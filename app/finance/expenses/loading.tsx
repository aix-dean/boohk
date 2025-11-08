export default function LoadingExpenses() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-muted rounded w-40 animate-pulse" />
          <div className="h-4 bg-muted rounded w-64 mt-2 animate-pulse" />
        </div>
        <div className="h-10 w-48 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-10 w-full bg-muted rounded animate-pulse" />
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-card border rounded-lg">
            <div className="p-6 border-b">
              <div className="h-6 bg-muted rounded w-48 animate-pulse" />
              <div className="h-4 bg-muted rounded w-64 mt-2 animate-pulse" />
            </div>
            <div className="p-6 space-y-2">
              {[...Array(5)].map((__, j) => (
                <div key={j} className="h-12 w-full bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
