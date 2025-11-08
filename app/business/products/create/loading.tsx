export default function BusinessProductCreateLoading() {
  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
      <div className="mx-auto grid w-full max-w-6xl gap-2">
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted"></div>
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted"></div>
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-muted animate-pulse"></div>
              <div className="ml-3">
                <div className="h-4 w-24 animate-pulse rounded-md bg-muted mb-1"></div>
                <div className="h-3 w-32 animate-pulse rounded-md bg-muted"></div>
              </div>
              {step < 4 && (
                <div className="flex-1 mx-4">
                  <div className="h-0.5 bg-muted animate-pulse"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex justify-center">
        <div className="grid gap-6 w-full max-w-2xl">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6 flex flex-col space-y-1.5">
              <div className="h-6 w-32 animate-pulse rounded-md bg-muted"></div>
              <div className="h-4 w-48 animate-pulse rounded-md bg-muted"></div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="space-y-2">
                    <div className="h-4 w-24 animate-pulse rounded-md bg-muted"></div>
                    <div className="h-10 w-full animate-pulse rounded-md bg-muted"></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center p-6 justify-between">
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted"></div>
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
