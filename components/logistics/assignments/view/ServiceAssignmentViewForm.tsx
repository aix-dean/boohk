import { ServiceAssignmentViewCard } from './ServiceAssignmentViewCard';
import { ServiceExpenseViewCard } from './ServiceExpenseViewCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format } from "date-fns";
import type { Timestamp } from "firebase/firestore";
import type { Product } from "@/lib/firebase-service";
import type { Team } from "@/lib/types/team";
import type { JobOrder } from "@/lib/types/job-order";

// Job Order Details Card Component
function JobOrderDetailsCard({
  jobOrder,
}: {
  jobOrder: JobOrder;
}) {
  // Helper function to format date
  const formatDate = (date: string | Date | Timestamp | undefined) => {
    if (!date) return "N/A";
    try {
      const dateObj = date instanceof Date ? date : typeof date === 'string' ? new Date(date) : date.toDate();
      return format(dateObj, "MMM d, yyyy");
    } catch (error) {
      return "N/A";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">JOB ORDER</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex justify-between items-center">
          <p className="text-blue-600 font-medium">JO#: {jobOrder.joNumber}</p>
          <p className="text-sm text-gray-500">{formatDate(jobOrder.created)}</p>
        </div>
        <div className="flex items-center">
          <Label className="w-1/2">JO Type:</Label>
          <p className="w-1/2 font-medium m-0 p-0">{jobOrder.joType}</p>
        </div>
        <div className="flex items-center">
          <Label className="w-1/2">Site Name:</Label>
          <p className="w-1/2 font-medium m-0 p-0">{jobOrder.siteName}</p>
        </div>
        <div className="flex items-center">
          <Label className="w-1/2">Deadline:</Label>
          <p className="w-1/2 font-medium m-0 p-0">{formatDate(jobOrder.deadline)}</p>
        </div>
        <div className="space-y-2">
          <Label>Attachments:</Label>
          {jobOrder.siteImageUrl ? (
            <img
              src={jobOrder.siteImageUrl}
              alt="Site Image"
              className="rounded-md h-32 w-32 object-cover"
            />
          ) : jobOrder.attachments && jobOrder.attachments.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {jobOrder.attachments.slice(0, 4).map((attachment, index) => (
                <img
                  key={index}
                  src={attachment.url}
                  alt={attachment.name}
                  className="rounded-md h-16 w-16 object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No attachments</p>
          )}
        </div>
        <div className="flex items-center">
          <Label className="w-1/2">Remarks:</Label>
          <p className="w-1/2 font-medium m-0 p-0">{jobOrder.remarks || "N/A"}</p>
        </div>
        <div className="flex items-center">
          <Label className="w-1/2">Requested by:</Label>
          <p className="w-1/2 font-medium m-0 p-0">{jobOrder.requestedBy}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ServiceAssignmentViewForm({
  assignmentData,
  products,
  teams,
  jobOrderData,
}: {
  assignmentData: any;
  products: Product[];
  teams: Team[];
  jobOrderData: JobOrder | null;
}) {
  return (
    <div className="flex flex-col lg:flex-row p-4">
      <div className="flex flex-col gap-6 w-full lg:w-[60%]">
        <ServiceAssignmentViewCard
          assignmentData={assignmentData}
          products={products}
          teams={teams}
          jobOrderData={jobOrderData}
        />
      </div>
      <div className="flex flex-col gap-6 w-full lg:w-[40%]">
        {jobOrderData && (
          <JobOrderDetailsCard
            jobOrder={jobOrderData}
          />
        )}
        <ServiceExpenseViewCard
          expenses={assignmentData.serviceExpenses || []}
        />
      </div>
    </div>
  );
}