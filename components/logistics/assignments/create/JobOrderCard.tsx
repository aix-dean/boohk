import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { JobOrderSelectionDialog } from './JobOrderSelectionDialog';
import type { JobOrder } from '@/lib/types/job-order';

interface JobOrderCardProps {
  company_id: string;
  product_id: string; // Add product_id prop
  onHideJobOrderCard: () => void; // New prop for hiding the card
}

export function JobOrderCard({ company_id, product_id, onHideJobOrderCard }: JobOrderCardProps) {
  const [showJobOrderList, setShowJobOrderList] = useState(false);
  const [availableJobOrders, setAvailableJobOrders] = useState<JobOrder[]>([]);
  const [selectedJobOrder, setSelectedJobOrder] = useState<JobOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJobOrderSelectionDialog, setShowJobOrderSelectionDialog] = useState(false);

  const handleIdentifyJobOrderClick = async () => {
    setIsLoading(true);
    setError(null);
    setShowJobOrderList(true); // Show the list when button is clicked
    try {
      const response = await fetch(`/api/logistics/job-orders/by-company/${company_id}?productId=${product_id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAvailableJobOrders(data);
    } catch (err) {
      console.error("Failed to fetch job orders:", err);
      setError("Failed to load job orders. Please try again.");
      setAvailableJobOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectJobOrder = (jobOrder: JobOrder) => {
    setSelectedJobOrder(jobOrder);
    setShowJobOrderList(false); // Hide the list after selection
    onHideJobOrderCard(); // Call the callback to hide the card in the parent
  };

  const handleClearJobOrder = () => {
    setSelectedJobOrder(null);
    setShowJobOrderList(false);
    setAvailableJobOrders([]);
  };

  const handleReplaceJobOrder = (jobOrder: any) => {
    setSelectedJobOrder(jobOrder);
    setShowJobOrderSelectionDialog(false);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-2xl font-bold">JOB ORDER</span>
          </div>
          {selectedJobOrder && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowJobOrderSelectionDialog(true)}>
                  Replace JO
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearJobOrder}>
                  Clear JO
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading && <p>Loading job orders...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {!selectedJobOrder && !showJobOrderList && !isLoading && !error && (
          <div className="w-full flex justify-center items-center py-4">
            <Button variant="outline" size="sm" onClick={handleIdentifyJobOrderClick}><span style={{ color: 'var(--LIGHTER-BLACK, #333)', textAlign: 'center', fontFamily: 'Inter', fontSize: '12px', fontStyle: 'normal', fontWeight: 500, lineHeight: '100%' }}>Identify JO</span></Button>
          </div>
        )}

        {showJobOrderList && !isLoading && !error && (
          availableJobOrders.length === 0 ? (
            <p>No job orders available for this product site.</p>
          ) : (
            <ScrollArea className="h-72 w-full rounded-md border">
              <div className="p-4">
                {availableJobOrders.map((jobOrder) => (
                  <Button
                    key={jobOrder.id}
                    variant="ghost"
                    className="w-full justify-start mb-2"
                    onClick={() => handleSelectJobOrder(jobOrder)}
                  >
                    JO#: {jobOrder.joNumber} - {jobOrder.siteName} - {jobOrder.jobDescription}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )
        )}

        {selectedJobOrder && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>JO#:</Label>
                <p className="font-medium">{selectedJobOrder.joNumber}</p>
              </div>
              <div className="space-y-2">
                <Label>Campaign Name:</Label>
                <p className="font-medium">{selectedJobOrder.campaignName}</p>
              </div>
            </div>
            {/* You can add more fields from selectedJobOrder here */}
            <div className="space-y-2">
              <Label>Deadline:</Label>
              <p className="font-medium">Dec 15, 2025</p>
            </div>

            <div className="space-y-2">
              <Label>Material Specs:</Label>
              <p className="font-medium">Perforated Sticker</p>
            </div>

            <div className="space-y-1">
              <Label>Attachment:</Label>
              <div className="space-y-1">
                <div className="w-[70px] h-[70px] flex flex-col justify-center items-center" style={{ background: 'rgba(196, 196, 196, 0.5)', borderRadius: '5.341px', gap: '0px' }}>
                  <img
                    src={selectedJobOrder.attachments?.url || "/logistics-sa-create-dl.png"}
                    alt="Attachment"
                    className="rounded-md h-6 w-6 object-cover cursor-pointer"
                    onClick={() => window.open(selectedJobOrder.attachments?.url || "/logistics-sa-create-dl.png", '_blank')}
                  />
                  <p className="text-center text-sm text-gray-600" style={{ fontSize: '5.483px', fontStyle: 'normal', fontWeight: 600, lineHeight: '0.8', marginTop: '5px' }}>Upload</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks:</Label>
              <p className="font-medium">N/A</p>
            </div>

            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <Label>Requested by:</Label>
                <p className="font-medium">Noemi Abellanada</p>
              </div>
              <Button variant="link" size="sm">Change</Button>
            </div>
          </>
        )}
      </CardContent>

      <JobOrderSelectionDialog
        open={showJobOrderSelectionDialog}
        onOpenChange={setShowJobOrderSelectionDialog}
        productId={product_id}
        companyId={company_id}
        onSelectJobOrder={handleReplaceJobOrder}
      />
    </Card>
  );
}
