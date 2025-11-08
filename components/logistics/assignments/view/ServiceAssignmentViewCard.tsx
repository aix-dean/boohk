import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { format } from "date-fns";
import type { Product } from "@/lib/firebase-service";
import type { Team } from "@/lib/types/team";
import type { JobOrder } from "@/lib/types/job-order";

interface ServiceAssignmentViewCardProps {
  assignmentData: any;
  products: Product[];
  teams: Team[];
  jobOrderData: JobOrder | null;
}

export function ServiceAssignmentViewCard({
  assignmentData,
  products,
  teams,
  jobOrderData,
}: ServiceAssignmentViewCardProps) {
  const [currentTime, setCurrentTime] = useState("");

  // Set current time on component mount
  useEffect(() => {
    const now = new Date();
    setCurrentTime(now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }));
  }, []);

  // Helper function to safely parse and validate dates
  const parseDateSafely = (dateValue: any): Date | null => {
    if (!dateValue) return null;

    try {
      let date: Date;

      if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          return null;
        }
      } else if (typeof dateValue === 'number') {
        date = new Date(dateValue * 1000);
      } else if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        return null;
      }

      if (isNaN(date.getTime())) {
        return null;
      }

      return date;
    } catch (error) {
      console.warn('Error parsing date:', dateValue, error);
      return null;
    }
  };

  const selectedProduct = products.find(p => p.id === assignmentData.projectSiteId);
  const selectedTeam = teams.find(t => t.id === assignmentData.crew);

  // Get site information - prioritize assignment data, then fall back to product lookup
  const siteCode = selectedProduct?.site_code || assignmentData.projectSiteId?.substring(0, 8) || "-";
  const siteName = assignmentData.projectSiteName || selectedProduct?.name || "-";

  return (
    <Card className="w-[90%]">
      <CardHeader>
        <CardTitle>
          <div className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
            <div className="flex flex-col">
              <span className="text-xl font-bold">
                {siteCode}
              </span>
              <span className="text-base text-gray-500">
                {siteName}
              </span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <div className="flex flex-col lg:flex-row gap-4 p-4">
        <div className="flex flex-col gap-4 w-full lg:w-[70%]">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col text-sm">
              <p>SA#: {assignmentData.saNumber}</p>
              <p className="text-xs text-gray-500">
                {siteCode}
              </p>
            </div>
            <p className="text-sm">{currentTime}</p>
          </div>
          <CardContent className="grid gap-4">
            {/* Service Type - Row Layout */}
            <div className="flex items-center space-x-4">
              <Label htmlFor="serviceType" className="w-32 flex-shrink-0">Service Type:</Label>
              <div className="flex-1 p-2 bg-gray-50 rounded border">
                {assignmentData.serviceType || "N/A"}
              </div>
            </div>

            {/* Campaign Name - Row Layout */}
            {assignmentData.serviceType !== "Maintenance" && assignmentData.serviceType !== "Repair" && (
              <div className="flex items-center space-x-4">
                <Label className="w-32 flex-shrink-0">Campaign Name:</Label>
                <div className="flex-1 p-2 bg-gray-50 rounded border">
                  {assignmentData.campaignName || "N/A"}
                </div>
              </div>
            )}

            {/* Service Start Date - Row Layout */}
            <div className="flex items-center space-x-4">
              <Label className="w-32 flex-shrink-0">
                {["Monitoring", "Maintenance", "Repair"].includes(assignmentData.serviceType) ? "Service Date:" : "Service Start Date:"}
              </Label>
              <div className="flex-1 p-2 bg-gray-50 rounded border">
                {assignmentData.coveredDateStart ? format(parseDateSafely(assignmentData.coveredDateStart)!, "PPP") : "N/A"}
              </div>
            </div>

            {/* Service End Date - Row Layout */}
            <div className="flex items-center space-x-4">
              <Label className="w-32 flex-shrink-0">Service End Date:</Label>
              <div className="flex-1 p-2 bg-gray-50 rounded border">
                {assignmentData.coveredDateEnd ? format(parseDateSafely(assignmentData.coveredDateEnd)!, "PPP") : "N/A"}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Label htmlFor="serviceDuration" className="w-32 flex-shrink-0">Service Duration:</Label>
              <div className="flex-1 flex items-center space-x-2">
                <div className="flex-1 p-2 bg-gray-50 rounded border">
                  {assignmentData.serviceDuration || "N/A"}
                </div>
                <span className="text-sm text-gray-600 whitespace-nowrap">days</span>
              </div>
            </div>

            {!["Monitoring", "Change Material", "Maintenance", "Repair"].includes(assignmentData.serviceType) && (
              <div className="flex items-center space-x-4">
                <Label className="w-32 flex-shrink-0">Material Specs:</Label>
                <div className="flex-1 p-2 bg-gray-50 rounded border">
                  {assignmentData.materialSpecs || "N/A"}
                </div>
              </div>
            )}

            <div className="flex items-start space-x-4">
              <Label className="w-32 flex-shrink-0 pt-2">Attachment:</Label>
              <div className="flex-1">
                {assignmentData.serviceType === "Change Material" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Old Material</Label>
                      {jobOrderData?.siteImageUrl ? (
                        <img
                          src={jobOrderData.siteImageUrl}
                          alt="Old Material"
                          className="rounded-md h-32 w-full object-cover"
                        />
                      ) : (
                        <div className="h-32 w-full bg-gray-100 rounded flex items-center justify-center">
                          <span className="text-gray-500">No image available</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">New Material</Label>
                      {jobOrderData?.attachments ? (
                        <img
                          src={jobOrderData.attachments.url}
                          alt="New Material"
                          className="rounded-md h-32 w-full object-cover"
                        />
                      ) : (
                        <div className="h-32 w-full bg-gray-100 rounded flex items-center justify-center">
                          <span className="text-gray-500">No image available</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-32 w-32 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-500">No image</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Label className="w-32 flex-shrink-0">Remarks:</Label>
              <div className="flex-1 p-2 bg-gray-50 rounded border min-h-[40px]">
                {assignmentData.remarks || "N/A"}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Label className="w-32 flex-shrink-0">Crew:</Label>
              <div className="flex-1 p-2 bg-gray-50 rounded border">
                {selectedTeam?.name || assignmentData.assignedTo || "N/A"}
              </div>
            </div>


            {!["Monitoring", "Maintenance", "Repair"].includes(assignmentData.serviceType) && (
              <div className="flex items-center space-x-4">
                <Label className="w-32 flex-shrink-0">Gondola:</Label>
                <div className="flex-1 p-2 bg-gray-50 rounded border">
                  {assignmentData.gondola || "N/A"}
                </div>
              </div>
            )}

            {!["Monitoring", "Maintenance", "Repair"].includes(assignmentData.serviceType) && (
              <div className="flex items-center space-x-4">
                <Label className="w-32 flex-shrink-0">Logistics:</Label>
                <div className="flex-1 p-2 bg-gray-50 rounded border">
                  {assignmentData.sales || "N/A"}
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}