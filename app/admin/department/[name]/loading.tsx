export default function DepartmentDetailsLoading() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-9 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>

      {/* Department Color Line */}
      <div className="h-1 w-full bg-gray-200 mb-6 rounded animate-pulse"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute left-2.5 top-2.5 h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-9 w-full bg-gray-200 rounded pl-8 animate-pulse"></div>
        </div>
        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
      </div>

      <div className="space-y-4">
        {/* Skeleton user cards */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="space-y-1">
                  <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex gap-1">
                  <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}