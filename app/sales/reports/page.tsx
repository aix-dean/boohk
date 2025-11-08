"use client";

import { useState, useEffect } from "react";
import {
  Search,
  MoreVertical,
  Plus,
  Printer,
  Eye,
  Trash2,
  History,
  Download,
  Share,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { type ReportData } from "@/lib/report-service";
import { CompanyService } from "@/lib/company-service";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ReportPostSuccessDialog } from "@/components/report-post-success-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { SentHistoryDialog } from "@/components/sent-history-dialog";
import { SendReportDialog } from "@/components/send-report-dialog";
import { useResponsive } from "@/hooks/use-responsive";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ca } from "date-fns/locale";

export default function SalesReportsPage() {
  const [filteredReports, setFilteredReports] = useState<Partial<ReportData>[]>(
    []
  );
  const [allReports, setAllReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const itemsPerPage = 15;

  const [companyLogo, setCompanyLogo] = useState<string>("");

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [postedReportId, setPostedReportId] = useState<string>("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [showSentHistoryDialog, setShowSentHistoryDialog] = useState(false);
  const [selectedReportForHistory, setSelectedReportForHistory] =
    useState<ReportData | null>(null);
  const [showSendReportDialog, setShowSendReportDialog] = useState(false);
  const [selectedReportForShare, setSelectedReportForShare] =
    useState<ReportData | null>(null);

  const router = useRouter();
  const { user, userData } = useAuth();
  const { toast } = useToast();

  // Set up real-time listener for reports
  useEffect(() => {
    if (!userData?.company_id) {
      setAllReports([]);
      setLoading(false);
      return;
    }

    console.log(
      "Setting up real-time listener for company:",
      userData.company_id
    );
    const q = query(
      collection(db, "reports"),
      where("companyId", "==", userData.company_id),
      orderBy("created", "desc")
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log(
        "Received snapshot update with",
        querySnapshot.docs.length,
        "reports"
      );
      const reports = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        attachments: Array.isArray(doc.data().attachments)
          ? doc.data().attachments
          : [],
      })) as ReportData[];
      setAllReports(reports);
    });

    return unsubscribe;
  }, [userData?.company_id]);

  // Filter and paginate reports when data or filters change
  useEffect(() => {
    filterReports();
  }, [allReports, searchQuery, currentPage, userData]);

  useEffect(() => {
    // Check if we just posted a report
    const lastPostedReportId = sessionStorage.getItem("lastPostedReportId");
    if (lastPostedReportId) {
      setPostedReportId(lastPostedReportId);
      setShowSuccessDialog(true);
      // Clear the session storage
      sessionStorage.removeItem("lastPostedReportId");
    }
  }, []);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchQuery]);

  // Fetch company logo
  useEffect(() => {
    const fetchCompanyLogo = async () => {
      if (userData?.company_id) {
        try {
          const companyData = await CompanyService.getCompanyData(
            userData.company_id
          );
          setCompanyLogo(companyData?.logo || "");
        } catch (error) {
          console.error("Error fetching company logo:", error);
        }
      }
    };
    fetchCompanyLogo();
  }, [userData?.company_id]);

  const formatDate = (date: any) => {
    if (!date) return "N/A";

    let dateObj: Date;
    if (date.toDate) {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }

    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getReportTypeDisplay = (reportType: string) => {
    switch (reportType) {
      case "completion-report":
        return "Completion";
      case "monitoring-report":
        return "Monitoring ";
      case "installation-report":
        return "Installation";
      case "roll-down":
        return "Roll Down";
      default:
        return reportType;
    }
  };

  const filterReports = () => {
    console.log(
      "filterReports called with searchQuery:",
      `"${searchQuery}"`,
      "currentPage:",
      currentPage,
      "allReports length:",
      allReports.length
    );

    if (!userData?.company_id) {
      setFilteredReports([]);
      setTotalReports(0);
      setLoading(false);
      return;
    }

    // Filter to published reports (exclude drafts)
    let filteredReportsList = allReports.filter(
      (report: ReportData) => report.status !== "draft"
    );
    console.log("Published reports:", filteredReportsList.length);

    if (searchQuery.trim().length > 0) {
      console.log("Filtering by search query:", `"${searchQuery}"`);
      const searchTerm = searchQuery.trim().toLowerCase();
      filteredReportsList = filteredReportsList.filter(
        (report: ReportData) =>
          report.siteName?.toLowerCase().includes(searchTerm) ||
          report.reportType?.toLowerCase().includes(searchTerm) ||
          report.createdByName?.toLowerCase().includes(searchTerm) ||
          report.id?.toLowerCase().includes(searchTerm) ||
          report.report_id?.toLowerCase().includes(searchTerm) ||
          report.client?.toLowerCase().includes(searchTerm)
      );
      console.log("Filtered reports:", filteredReportsList.length);
    }

    // Paginate client-side
    const offset = (currentPage - 1) * itemsPerPage;
    const paginatedReports = filteredReportsList.slice(
      offset,
      offset + itemsPerPage
    );
    console.log(
      "Paginated reports for page",
      currentPage,
      ":",
      paginatedReports.length
    );

    setFilteredReports(paginatedReports);
    setTotalReports(filteredReportsList.length);
    setLoading(false);
  };

  const handleViewReport = (report: ReportData) => {
    setSelectedReport(report);
    setShowReportDialog(true);
  };

  const handlePrintReport = async (report: string) => {
    // Navigate to detail page and trigger print there
    // This ensures the report is rendered and can be printed
    if (!report) {
      toast({
        title: "Print Report",
        description: "No report available to print.",
      });
      return;
    }
    try {
      const response = await fetch(report);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank")?.print();
    } catch (error) {
      console.error("Error printing report:", error);
    }
  };

  const handleViewSentHistory = (report: ReportData) => {
    setSelectedReportForHistory(report);
    setShowSentHistoryDialog(true);
  };

  const handleDownloadReport = async (report: ReportData) => {
    try {
      if (report.logistics_report) {
        const response = await fetch(report.logistics_report);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = getFileNameFromFirebaseUrl(report.logistics_report);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Download Started",
          description: "Report download has been initiated.",
        });
      } else {
        toast({
          title: "Download Failed",
          description: "No report file available for download.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading report:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download the report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShareReport = (report: ReportData) => {
    setSelectedReportForShare(report);
    setShowSendReportDialog(true);
  };

  const { isMobile } = useResponsive();

  function getFileNameFromFirebaseUrl(url: string) {
    const decoded = decodeURIComponent(url);
    const lastPart = decoded.split("/").pop()?.split("?")[0] ?? "";

    // If filename repeats, keep only the first occurrence
    const match = lastPart.match(/(quotation_[^.]+\.pdf)/);
    return match ? match[1] : lastPart;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Title */}
      <div className="px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Report</h2>
        <Button
          variant="outline"
          className="border-gray-400 rounded-[5px] w-[103px] h-[24px] text-xs"
          onClick={() => router.push("/sales/reports/sent-history")}
        >
          All Sent History
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-[13px] top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 opacity-30" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-[257px] h-[30px] rounded-[15px]"
            />
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white mx-6 mt-6 rounded-tl-[10px] rounded-tr-[10px] overflow-hidden">
        {/* Table Headers */}
        <div className="bg-white px-6 pt-4 hidden sm:block">
          <div className="grid grid-cols-8 pb-4 border-b border-gray-300 gap-4 text-xs font-semibold text-gray-900">
            <div>Date Issued</div>
            <div>Report ID</div>
            <div>Report Type</div>
            <div>Site</div>
            <div>Campaign</div>
            <div>Sender</div>
            <div>Attachment</div>
            <div>Actions</div>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading reports...</span>
            </div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No reports found
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-[#f6f9ff] border-2 border-[#b8d9ff] rounded-[10px] p-4 cursor-pointer hover:bg-[#e8f0ff]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewReport(report as ReportData);
                }}
              >
                {isMobile ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Date Issued:
                      </span>
                      <span className="text-gray-900">
                        {formatDate(report.created)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Report ID:
                      </span>
                      <span className="text-gray-900">
                        {report.report_id || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Report Type:
                      </span>
                      <span className="text-gray-900">
                        {getReportTypeDisplay(report.reportType || "")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Site:</span>
                      <span className="text-gray-900 font-bold">
                        {report.siteName || "Unknown Site"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Campaign:
                      </span>
                      <span className="text-gray-900">
                        {report.product?.name || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Sender:</span>
                      <span className="text-gray-900 truncate">
                        {report.createdByName || "Unknown User"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Attachment:
                      </span>
                      <div
                        className={
                          report.logistics_report
                            ? "text-[#2d3fff] underline cursor-pointer truncate"
                            : "text-gray-500"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (report.logistics_report) {
                            window.open(report.logistics_report, "_blank");
                          }
                        }}
                      >
                        {report.logistics_report
                          ? getFileNameFromFirebaseUrl(report.logistics_report)
                          : "—"}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Actions:
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1">
                            <MoreVertical className="h-4 w-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewSentHistory(report as ReportData);
                            }}
                          >
                            View Sent History
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareReport(report as ReportData);
                            }}
                          >
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadReport(report as ReportData);
                            }}
                          >
                            Download
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintReport(report.logistics_report || "");
                            }}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-8 gap-4 items-center text-sm">
                    <div className="text-gray-900">
                      {formatDate(report.date || report.created)}
                    </div>
                    <div className="text-gray-900 truncate">
                      {report.report_id || "N/A"}
                    </div>
                    <div className="text-gray-900 truncate">
                      {getReportTypeDisplay(report.reportType || "")}
                    </div>
                    <div className="text-gray-900 font-bold truncate">
                      {report.siteName || "Unknown Site"}
                    </div>
                    <div className="text-gray-900 truncate">
                      {report.product?.name || "N/A"}
                    </div>
                    <div className="text-gray-900 truncate">
                      {report.createdByName || "Unknown User"}
                    </div>
                    <div
                      className={
                        report.logistics_report
                          ? "text-[#2d3fff] underline cursor-pointer truncate"
                          : "text-gray-500"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (report.logistics_report) {
                          window.open(report.logistics_report, "_blank");
                        }
                      }}
                    >
                      {report.logistics_report
                        ? getFileNameFromFirebaseUrl(report.logistics_report)
                        : "—"}
                    </div>
                    <div className="text-gray-500">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1">
                            <MoreVertical className="h-4 w-4 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewSentHistory(report as ReportData);
                            }}
                          >
                            View Sent History
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareReport(report as ReportData);
                            }}
                          >
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadReport(report as ReportData);
                            }}
                          >
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintReport(report.logistics_report || "");
                            }}
                          >
                            Print
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalReports > itemsPerPage && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, totalReports)} of{" "}
            {totalReports} reports
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {Math.ceil(totalReports / itemsPerPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentPage((prev) =>
                  Math.min(Math.ceil(totalReports / itemsPerPage), prev + 1)
                )
              }
              disabled={currentPage === Math.ceil(totalReports / itemsPerPage)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Report Post Success Dialog */}
      <ReportPostSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        reportId={postedReportId}
      />

      {/* Report Details Dialog */}
      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        selectedReport={selectedReport}
      />

      {/* Sent History Dialog */}
      <SentHistoryDialog
        open={showSentHistoryDialog}
        onOpenChange={setShowSentHistoryDialog}
        reportId={selectedReportForHistory?.id}
        companyId={userData?.company_id || undefined}
        emailType="report"
      />

      {/* Send Report Dialog */}
      <SendReportDialog
        isOpen={showSendReportDialog}
        onClose={() => setShowSendReportDialog(false)}
        report={selectedReportForShare as ReportData}
        onSelectOption={() => {}}
      />
    </div>
  );
}
