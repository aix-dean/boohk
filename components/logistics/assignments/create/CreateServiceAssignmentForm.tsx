"use client"

import { ServiceAssignmentCard } from './ServiceAssignmentCard';
import { ServiceExpenseCard } from './ServiceExpenseCard';
import { ActionButtons } from './ActionButtons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Search, X, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from "date-fns";
import type { Timestamp } from "firebase/firestore";
import type { Product } from "@/lib/firebase-service";
import type { Team } from "@/lib/types/team";
import type { JobOrder } from "@/lib/types/job-order";
import { useState } from 'react';
import { JobOrderSelectionDialog } from './JobOrderSelectionDialog';
import { useToast } from "@/hooks/use-toast";

// Job Order Details Card Component
function JobOrderDetailsCard({
  jobOrder,
  onChange,
  onOpenDialog,
  onReplaceJO,
  setShowJobOrderSelectionDialog
}: {
  jobOrder: JobOrder;
  onChange: () => void;
  onOpenDialog?: () => void;
  onReplaceJO?: () => void;
  setShowJobOrderSelectionDialog: (value: boolean) => void;
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

  const fieldLabelClass = "text-[#333] font-['Inter'] text-[12px] font-bold leading-[1.2]";
  const fieldValueClass = "text-[#333] font-['Inter'] text-[12px] font-normal leading-[1.2]";

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
    <Card className="w-full bg-[#E6F5FF] border-[3px] border-dashed border-[#00D0FF]">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span className="text-[#333] font-['Inter'] text-[12px] font-[700] leading-[100%]">Tagged JO:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowJobOrderSelectionDialog(true)}>
                Replace JO
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onChange}>
                Clear JO
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex justify-between items-center">
          <p className="text-[#333] font-['Inter'] text-[20px] font-[700] leading-[100%]">JO#: {jobOrder.joNumber}</p>
        </div>
        <div className="flex items-center">
          <Label className={`${fieldLabelClass} w-1/2`}>JO Type:</Label>
          <p className={`w-1/2 ${fieldValueClass} m-0 p-0`}>{jobOrder.joType}</p>
        </div>
        <div className="flex items-center">
          <Label className={`${fieldLabelClass} w-1/2`}>Campaign Name:</Label>
          <p className={`w-1/2 ${fieldValueClass} m-0 p-0`}>{jobOrder.campaignName}</p>
        </div>
        <div className="flex items-center">
          <Label className={`${fieldLabelClass} w-1/2`}>Deadline:</Label>
          <p className={`w-1/2 ${fieldValueClass} m-0 p-0`}>{formatDate(jobOrder.deadline)}</p>
        </div>
        <div className="flex items-center">
          <Label className={`${fieldLabelClass} w-1/2`}>Material Specs:</Label>
          <p className={`w-1/2 ${fieldValueClass} m-0 p-0`}>{jobOrder.materialSpec || "N/A"}</p>
        </div>
        <div className="flex items-center">
          <Label className={`${fieldLabelClass} w-1/2`} style={{ textAlign: 'left' }}>Attachment:</Label>
          {jobOrder.siteImageUrl || jobOrder.attachments ? (
            <span className={`w-1/2 ${fieldValueClass} m-0 p-0 text-blue-500 underline font-bold cursor-pointer`} onClick={() => setIsDialogOpen(true)}>View Attachment</span>
          ) : (
            <p className={`w-1/2 ${fieldValueClass} m-0 p-0 text-gray-500`}>No attachments</p>
          )}
        </div>
        <div className="flex items-center">
          <Label className={`${fieldLabelClass} w-1/2`}>Remarks:</Label>
          <p className={`w-1/2 ${fieldValueClass} m-0 p-0`}>{jobOrder.remarks || "N/A"}</p>
        </div>
        <div className="flex items-center">
          <Label className={`${fieldLabelClass} w-1/2`}>Requested by:</Label>
          <p className={`w-1/2 ${fieldValueClass} m-0 p-0`}>{jobOrder.requestedBy}</p>
        </div>
      </CardContent>
    </Card>
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-4xl">
        <img src={(jobOrder.attachments ? jobOrder.attachments.url : jobOrder.siteImageUrl) || ''} alt="Attachment" className="mx-auto max-w-full h-auto" />
        <DialogClose asChild>
          <Button variant="ghost" size="sm" className="absolute top-2 right-2">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  </>
  );
}


interface FormData {
  projectSite: string;
  serviceType: string;
  assignedTo: string;
  serviceDuration: number;
  priority: string;
  equipmentRequired: string;
  materialSpecs: string;
  crew: string;
  gondola: string;
  technology: string;
  sales: string;
  remarks: string;
  message: string;
  startDate: Date | null;
  endDate: Date | null;
  alarmDate: Date | null;
  alarmTime: string;
  attachments: { name: string; type: string; file?: File }[];
  serviceExpenses: { name: string; amount: string }[];
  serviceCost: {
    crewFee: string;
    overtimeFee: string;
    transpo: string;
    tollFee: string;
    mealAllowance: string;
    otherFees: { name: string; amount: string }[];
    total: number;
  };
}

export function CreateServiceAssignmentForm({
  onSaveAsDraft,
  onSubmit,
  loading,
  generatingPDF,
  companyId,
  productId,
  formData,
  handleInputChange,
  products,
  teams,
  saNumber,
  jobOrderData,
  addExpense,
  removeExpense,
  updateExpense,
  calculateTotal,
  onOpenProductSelection,
  onIdentifyJO,
  onChangeJobOrder,
  onOpenJobOrderDialog,
  onClearJobOrder,
  onReplaceJobOrder,
  onFileUpload,
  onRemoveAttachment,
}: {
  onSaveAsDraft: () => Promise<void>;
  onSubmit: () => Promise<void>;
  loading: boolean;
  generatingPDF: boolean;
  companyId: string | null;
  productId: string;
  formData: FormData;
  handleInputChange: (field: string, value: any) => void;
  products: Product[];
  teams: Team[];
  saNumber: string;
  jobOrderData: JobOrder | null;
  addExpense: () => void;
  removeExpense: (index: number) => void;
  updateExpense: (index: number, field: "name" | "amount", value: string) => void;
  calculateTotal: () => number;
  onOpenProductSelection: () => void;
  onIdentifyJO?: () => void;
  onChangeJobOrder?: () => void;
  onOpenJobOrderDialog?: () => void;
  onClearJobOrder?: () => void;
  onReplaceJobOrder?: (jobOrder: JobOrder) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment?: (index: number) => void;
}) {
  const [showJobOrderSelectionDialog, setShowJobOrderSelectionDialog] = useState(false);
  const { toast } = useToast();

  return (
    <div className="flex flex-col lg:flex-row p-4">
      <div className="flex flex-col gap-6 w-full lg:w-[75%]">
        <ServiceAssignmentCard
          companyId={companyId}
          productId={productId}
          formData={formData}
          handleInputChange={handleInputChange}
          products={products}
          teams={teams}
          saNumber={saNumber}
          selectedJobOrder={jobOrderData}
          onOpenProductSelection={onOpenProductSelection}
          onClearJobOrder={onClearJobOrder}
          onFileUpload={onFileUpload}
          onRemoveAttachment={onRemoveAttachment}
        />
      </div>
      <div className="flex flex-col gap-6 w-full lg:w-[25%]">
        {jobOrderData ? (
          <JobOrderDetailsCard
            jobOrder={jobOrderData}
            onChange={onChangeJobOrder || (() => {})}
            onOpenDialog={onOpenJobOrderDialog}
            onReplaceJO={() => setShowJobOrderSelectionDialog(true)}
            setShowJobOrderSelectionDialog={setShowJobOrderSelectionDialog}
          />
        ) : (
          onIdentifyJO && (
            <Card className="w-full aspect-square bg-[#E6F5FF] border-[3px] border-dashed border-[#00D0FF] transition-all duration-200 hover:bg-[#D1EBFF]">
              <CardContent className="flex justify-center items-center h-full p-4">
                <Button
                  variant="outline"
                  className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition-colors"
                  onClick={onIdentifyJO}
                  disabled={loading || generatingPDF}
                  style={{
                    borderRadius: '20px',
                    border: '2px solid #A1A1A1',
                    background: '#FFF',
                    boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
                    width: '98px',
                    height: '27px',
                    flexShrink: 0,
                    cursor: loading || generatingPDF ? 'not-allowed' : 'pointer',
                    opacity: loading || generatingPDF ? 0.6 : 1,
                  }}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Identify JO
                </Button>
              </CardContent>
            </Card>
          )
        )}
        <ServiceExpenseCard
          expenses={formData.serviceExpenses}
          addExpense={addExpense}
          removeExpense={removeExpense}
          updateExpense={updateExpense}
          calculateTotal={calculateTotal}
        />
        <ActionButtons onSaveAsDraft={onSaveAsDraft} onSubmit={onSubmit} loading={loading} generatingPDF={generatingPDF} />
      </div>

      <JobOrderSelectionDialog
        open={showJobOrderSelectionDialog}
        onOpenChange={setShowJobOrderSelectionDialog}
        productId={productId}
        companyId={companyId || ""}
        onSelectJobOrder={(jobOrder) => {
          // Handle job order replacement
          setShowJobOrderSelectionDialog(false);
          if (onReplaceJobOrder) {
            onReplaceJobOrder(jobOrder);
            toast({
              title: "Job Order Replaced",
              description: `Successfully replaced with JO#: ${jobOrder.joNumber}`,
            });
          }
        }}
        selectedJobOrderId={jobOrderData?.id}
      />
    </div>
  );
}
