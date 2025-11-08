import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"

export default function LogisticsJobOrdersLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="relative mb-4">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>

        <Card className="border-gray-200 shadow-sm rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="font-semibold text-gray-900 py-3">JO #</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Site</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Date Requested</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">JO Type</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Deadline</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Requested By</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3">Assigned To</TableHead>
                <TableHead className="font-semibold text-gray-900 py-3 w-[50px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i} className="border-b border-gray-100">
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-4 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
