"use client";

import {
  getProductById,
  uploadFileToFirebaseStorage,
  updateProduct,
  getServiceAssignmentsByProductId,
} from "@/lib/firebase-service";

// Global type declarations for Google Maps
declare global {
  interface Window {
    google: any;
  }
}
import { notFound, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Calendar,
  MapPin,
  AlertTriangle,
  Shield,
  Zap,
  Users,
  Settings,
  Eye,
  History,
  FileCheck,
  ArrowLeft,
  MoreVertical,
  Edit,
  Sun,
  Play,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { useRef, useState, useEffect, use } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ServiceAssignmentDetailsDialog } from "@/components/service-assignment-details-dialog";
import { CreateReportDialog } from "@/components/create-report-dialog";
import { SiteReportsTable } from "@/components/logistics/reports/SiteReportsTable";
import { SiteServiceAssignmentsTable } from "@/components/logistics/assignments/SiteServiceAssignmentsTable";
import SiteControls from "@/components/logistics/SiteControls";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlarmSettingDialog } from "@/components/alarm-setting-dialog";
import { IlluminationIndexCardDialog } from "@/components/illumination-index-card-dialog";
import { DisplayIndexCardDialog } from "@/components/display-index-card-dialog";
import type { JobOrder } from "@/lib/types/job-order"; // Import the JobOrder type
import { useAuth } from "@/contexts/auth-context";
import SiteInformation from "@/components/SiteInformation";

// Google Map Component
const GoogleMap: React.FC<{ location: string; className?: string }> = ({
  location,
  className,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    const initializeMaps = async () => {
      try {
        await loadGoogleMaps();
        await initializeMap();
      } catch (error) {
        console.error("Error loading Google Maps:", error);
        setMapError(true);
      }
    };

    const initializeMap = async () => {
      if (!mapRef.current || !window.google) return;

      try {
        const geocoder = new window.google.maps.Geocoder();

        // Geocode the location
        geocoder.geocode(
          { address: location },
          (
            results: google.maps.GeocoderResult[] | null,
            status: google.maps.GeocoderStatus
          ) => {
            if (status === "OK" && results && results[0]) {
              const map = new window.google.maps.Map(mapRef.current!, {
                center: results[0].geometry.location,
                zoom: 15,
                disableDefaultUI: true,
                gestureHandling: "none",
                zoomControl: false,
                mapTypeControl: false,
                scaleControl: false,
                streetViewControl: false,
                rotateControl: false,
                fullscreenControl: false,
                styles: [
                  {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }],
                  },
                ],
              });

              // Add marker
              new window.google.maps.Marker({
                position: results[0].geometry.location,
                map: map,
                title: location,
                icon: {
                  url:
                    "data:image/svg+xml;charset=UTF-8," +
                    encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ef4444"/>
                  </svg>
                `),
                  scaledSize: new window.google.maps.Size(32, 32),
                  anchor: new window.google.maps.Point(16, 32),
                },
              });

              setMapLoaded(true);
            } else {
              console.error("Geocoding failed:", status);
              setMapError(true);
            }
          }
        );
      } catch (error) {
        console.error("Error initializing map:", error);
        setMapError(true);
      }
    };

    initializeMaps();
  }, [location]);

  if (mapError) {
    return (
      <div
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
      >
        <div className="text-center text-gray-500">
          <p className="text-sm">Map unavailable</p>
          <p className="text-xs mt-1">{location}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to convert Firebase timestamp to readable date
export const formatFirebaseDate = (timestamp: any): string => {
  if (!timestamp) return "";

  try {
    // Check if it's a Firebase Timestamp object
    if (timestamp && typeof timestamp === "object" && timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // If it's already a string or Date, handle accordingly
    if (typeof timestamp === "string") {
      return timestamp;
    }

    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    return "";
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
};

type Props = {
  params: Promise<{ id: string }>;
};

interface ServiceAssignment {
  id: string;
  saNumber: string;
  projectSiteId: string;
  projectSiteName: string;
  projectSiteLocation: string;
  serviceType: string;
  assignedTo: string;
  jobDescription: string;
  requestedBy: {
    id: string;
    name: string;
    department: string;
  };
  message: string;
  campaignName?: string;
  coveredDateStart: any;
  coveredDateEnd: any;
  alarmDate: any;
  alarmTime: string;
  attachments: { name: string; type: string }[];
  status: string;
  created: any;
  updated: any;
}

export default function SiteDetailsPage({ params }: Props) {
  const resolvedParams = use(params) as { id: string };
  const [product, setProduct] = useState<any>(null);
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]); // Changed from serviceAssignments
  const [serviceAssignments, setServiceAssignments] = useState<
    ServiceAssignment[]
  >([]); // Keep service assignments for other parts if needed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [alarmDialogOpen, setAlarmDialogOpen] = useState(false);
  const [illuminationIndexCardDialogOpen, setIlluminationIndexCardDialogOpen] =
    useState(false);
  const [displayIndexCardDialogOpen, setDisplayIndexCardDialogOpen] =
    useState(false);
  const [blueprintDialogOpen, setBlueprintDialogOpen] = useState(false);
  const [createReportDialogOpen, setCreateReportDialogOpen] = useState(false);
  const [selectedBlueprintFile, setSelectedBlueprintFile] =
    useState<File | null>(null);
  const [blueprintPreviewUrl, setBlueprintPreviewUrl] = useState<string | null>(
    null
  );
  const [isUploadingBlueprint, setIsUploadingBlueprint] = useState(false);
  const [blueprintSuccessDialogOpen, setBlueprintSuccessDialogOpen] =
    useState(false);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [fullscreenBlueprint, setFullscreenBlueprint] = useState<{
    blueprint: string;
    uploaded_by: string;
    created: any;
  } | null>(null);
  const [fullscreenDialogOpen, setFullscreenDialogOpen] = useState(false);
  const [fullscreenPdfPageNumber, setFullscreenPdfPageNumber] = useState(1);
  const [fullscreenPdfNumPages, setFullscreenPdfNumPages] = useState<
    number | null
  >(null);
  const [structureUpdateDialogOpen, setStructureUpdateDialogOpen] =
    useState(false);
  const [structureForm, setStructureForm] = useState({
    color: "",
    contractor: "",
    condition: "",
  });
  const [maintenanceHistoryDialogOpen, setMaintenanceHistoryDialogOpen] =
    useState(false);
  const [comingSoonDialogOpen, setComingSoonDialogOpen] = useState(false);
  const [maintenanceHistory, setMaintenanceHistory] = useState<
    ServiceAssignment[]
  >([]);
  const [maintenanceHistoryLoading, setMaintenanceHistoryLoading] =
    useState(false);
  const [isCreatingSA, setIsCreatingSA] = useState(false);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userData } = useAuth();

  // Custom CSS for checkboxes
  const checkboxStyles = `
    .custom-checkbox {
      -webkit-appearance: none;
      appearance: none;
      width: 1rem;
      height: 1rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      background-color: #d1d5db;
      position: relative;
      cursor: pointer;
    }
    .custom-checkbox:checked {
      background-color: #22c55e;
      border-color: #22c55e;
    }
    .custom-checkbox:checked:disabled {
      background-color: #22c55e;
      border-color: #22c55e;
      opacity: 1;
    }
    .custom-checkbox:checked::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 0.75rem;
      font-weight: bold;
    }
    .custom-checkbox:focus {
      outline: 2px solid #22c55e;
      outline-offset: 2px;
    }
  `;

  // Custom CSS for switch
  const switchStyles = `
    .custom-switch {
      position: relative;
      display: inline-flex;
      height: 2rem;
      width: 4rem;
      shrink: 0;
      cursor: pointer;
      border-radius: 9999px;
      border: 2px solid;
      transition: all 0.2s ease-in-out;
    }
    .custom-switch[data-state="checked"] {
      background-color: #22c55e;
      border-color: #22c55e;
    }
    .custom-switch[data-state="unchecked"] {
      background-color: #d1d5db;
      border-color: #d1d5db;
    }
    .custom-switch span {
      pointer-events: none;
      display: block;
      height: 1.25rem;
      width: 1.25rem;
      border-radius: 9999px;
      background-color: white;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      transition: transform 0.2s ease-in-out;
    }
    .custom-switch[data-state="checked"] span {
      transform: translateX(2rem);
    }
    .custom-switch[data-state="unchecked"] span {
      transform: translateX(0.25rem);
    }
  `;

  const [compliance, setCompliance] = useState({
    lease_agreement: false,
    mayors_permit: false,
    bir_registration: false,
    structural_approval: false,
  });

  const [illuminationOn, setIlluminationOn] = useState(true);
  const [illuminationMode, setIlluminationMode] = useState("Manual");

  // Fetch product data and job orders
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch product data
        const productData = await getProductById(resolvedParams.id);
        if (!productData) {
          notFound();
        }
        setProduct(productData);

        // Fetch job orders for this product
        const jobOrdersQuery = query(
          collection(db, "job_orders"), // Changed collection to "job_orders"
          where("product_id", "==", resolvedParams.id), // Assuming "product_id" links to the site
          where("product_id", "==", resolvedParams.id), // Assuming "product_id" links to the site
          orderBy("createdAt", "desc") // Changed from 'created' to 'createdAt'
        );

        const jobOrdersSnapshot = await getDocs(jobOrdersQuery);
        const jobOrdersData: JobOrder[] = []; // Changed to JobOrder[]

        jobOrdersSnapshot.forEach((doc) => {
          jobOrdersData.push({
            id: doc.id,
            ...doc.data(),
          } as JobOrder); // Cast to JobOrder
        });

        setJobOrders(jobOrdersData); // Set job orders

        // Optionally, fetch service assignments if they are still needed elsewhere
        // For now, we'll assume the "Job Orders" card is the primary place for this data.
        // If service assignments are needed for other components, their fetching logic
        // would need to be re-added here or in a separate useEffect.
      } catch (err) {
        setError(err as Error);
        console.error("Error fetching data (SiteDetailsPage):", err); // More specific error logging
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  // Initialize compliance and illumination state from product data
  useEffect(() => {
    if (product?.compliance) {
      setCompliance({
        lease_agreement: product.compliance.lease_agreement || false,
        mayors_permit: product.compliance.mayors_permit || false,
        bir_registration: product.compliance.bir_registration || false,
        structural_approval: product.compliance.structural_approval || false,
      });
    }
    // Ensure illumination defaults to on state
    setIlluminationOn(true);
  }, [product]);

  const handleCreateServiceAssignment = () => {
    setIsCreatingSA(true);
    router.push(
      `/logistics/assignments/create?projectSite=${resolvedParams.id}`
    );
    setTimeout(() => setIsCreatingSA(false), 1000);
  };

  const handleBlueprintFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if file is image or PDF
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        alert("Please select an image or PDF file");
        return;
      }

      setSelectedBlueprintFile(file);
      setPdfNumPages(null);
      setPdfPageNumber(1);
      setIsPdfLoading(true);

      // Create preview URL for both images and PDFs
      const previewUrl = URL.createObjectURL(file);
      setBlueprintPreviewUrl(previewUrl);
    }
  };

  const handleBlueprintUpload = async () => {
    if (!selectedBlueprintFile || !product || !userData) return;

    setIsUploadingBlueprint(true);
    try {
      // Upload to Firebase Storage
      const downloadURL = await uploadFileToFirebaseStorage(
        selectedBlueprintFile,
        `blueprints/${product.id}/`
      );

      // Create new blueprint entry
      const blueprintKey = Date.now().toString(); // Use timestamp as unique key
      const uploaderName =
        `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
        userData.email ||
        "Unknown User";

      const newBlueprintEntry = {
        blueprint: downloadURL,
        uploaded_by: uploaderName,
        created: new Date(),
      };

      // Get existing blueprints or create empty array
      // Handle both old format (object) and new format (array)
      let existingBlueprints: Array<{
        blueprint: string;
        uploaded_by: string;
        created: any;
      }> = [];

      if (product.blueprints) {
        if (Array.isArray(product.blueprints)) {
          // New format - already an array
          existingBlueprints = product.blueprints;
        } else {
          // Old format - convert object to array
          existingBlueprints = Object.values(product.blueprints);
        }

        // Convert old format blueprints to new format and sort by created timestamp (most recent first)
        existingBlueprints = existingBlueprints.map((bp: any) => ({
          blueprint: bp.blueprint,
          uploaded_by: bp.uploaded_by || bp.uploaded || "Unknown User", // Handle both old and new formats
          created: bp.created,
        }));

        existingBlueprints.sort((a: { created: any }, b: { created: any }) => {
          const timeA =
            a.created instanceof Date
              ? a.created.getTime()
              : a.created?.seconds * 1000 || 0;
          const timeB =
            b.created instanceof Date
              ? b.created.getTime()
              : b.created?.seconds * 1000 || 0;
          return timeB - timeA;
        });
      }

      // Add new blueprint to the array
      const updatedBlueprints = [...existingBlueprints, newBlueprintEntry];

      // Update product with new blueprints map
      await updateProduct(product.id, { blueprints: updatedBlueprints });

      // Update local product state
      setProduct({ ...product, blueprints: updatedBlueprints });

      // Reset states
      setSelectedBlueprintFile(null);
      setBlueprintPreviewUrl(null);

      // Close blueprint dialog and show success dialog
      setBlueprintDialogOpen(false);
      setBlueprintSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error uploading blueprint:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Failed to upload blueprint: ${errorMessage}. Please try again.`);
    } finally {
      setIsUploadingBlueprint(false);
    }
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const onPdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPdfNumPages(numPages);
    setIsPdfLoading(false);
  };

  const onPdfLoadError = (error: Error) => {
    console.error("Error loading PDF:", error);
    setIsPdfLoading(false);
  };

  const isPdfFile = (url: string) => {
    return url.toLowerCase().endsWith(".pdf");
  };

  const handleBlueprintClick = (blueprint: {
    blueprint: string;
    uploaded_by: string;
    created: any;
  }) => {
    setFullscreenBlueprint(blueprint);
    setFullscreenDialogOpen(true);
    setFullscreenPdfPageNumber(1);
    setFullscreenPdfNumPages(null);
  };

  const onFullscreenPdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setFullscreenPdfNumPages(numPages);
  };

  const handleStructureEdit = () => {
    // Pre-populate form with existing structure data
    setStructureForm({
      color: product.structure?.color || "",
      contractor: product.structure?.contractor || "",
      condition: product.structure?.condition || "",
    });
    setStructureUpdateDialogOpen(true);
  };

  const handleStructureUpdate = async () => {
    try {
      const updatedStructure = {
        ...structureForm,
        last_maintenance: new Date(), // Update last maintenance to current date
      };

      await updateProduct(product.id, { structure: updatedStructure });

      // Update local product state
      setProduct({ ...product, structure: updatedStructure });

      setStructureUpdateDialogOpen(false);
    } catch (error) {
      console.error("Error updating structure:", error);
      alert("Failed to update structure. Please try again.");
    }
  };

  const fetchMaintenanceHistory = async () => {
    if (!product?.id) return;

    setMaintenanceHistoryLoading(true);
    try {
      const assignments = await getServiceAssignmentsByProductId(product.id);
      setMaintenanceHistory(assignments);
    } catch (error) {
      console.error("Error fetching maintenance history:", error);
      setMaintenanceHistory([]);
    } finally {
      setMaintenanceHistoryLoading(false);
    }
  };

  const handleViewHistory = () => {
    setMaintenanceHistoryDialogOpen(true);
    fetchMaintenanceHistory();
  };

  const handleComplianceChange = async (field: keyof typeof compliance) => {
    const newCompliance = { ...compliance, [field]: !compliance[field] };
    setCompliance(newCompliance);
    // Update product data
    try {
      await updateProduct(product.id, { compliance: newCompliance } as any);
      // Update local product state
      setProduct({ ...product, compliance: newCompliance });
    } catch (error) {
      console.error("Error updating compliance:", error);
      // Revert on error
      setCompliance(compliance);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error Loading Site
          </h2>
          <p className="text-gray-600">{error.message}</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  // Determine if this is a static or dynamic site
  const contentType = (product.content_type || "").toLowerCase();
  const isStatic = contentType === "static";
  const isDynamic = contentType === "dynamic";
  const showControlTab = contentType === "digital" || contentType === "dynamic";
  const category = product.categories[0] || "";
  // Format dimensions
  const width = product.specs_rental?.width || 0;
  const height = product.specs_rental?.height || 0;
  const dimension =
    width && height ? `${width}ft x ${height}ft` : "Not specified";

  // Get location
  const location =
    product.specs_rental?.location ||
    product.light?.location ||
    "Unknown location";

  // Get geopoint
  const geopoint = product.specs_rental?.geopoint
    ? `${product.specs_rental.geopoint[0]},${product.specs_rental.geopoint[1]}`
    : "12.5346567742,14.09346723";

  // Get the first media item for the thumbnail
  const thumbnailUrl =
    product.media && product.media.length > 0
      ? product.media[0].url
      : isStatic
        ? "/roadside-billboard.png"
        : "/led-billboard-1.png";

  // Check if we should show specific view content
  const isFromContent = view === "content";
  const isFromStructure = view === "structure";
  const isFromCompliance = view === "compliance";
  const isFromIllumination = view === "illumination";
  const isFromDisplayHealth = view === "display-health";

  return (
    <div className="container py-4 space-y-4">
      <style
        dangerouslySetInnerHTML={{ __html: checkboxStyles + switchStyles }}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex flex-row items-center">
          <Link
            href="/logistics/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2
            className="text-lg"
            style={{
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: "24px",
              lineHeight: "120%",
              letterSpacing: "0%",
              color: "#000000",
            }}
          >
            Site Information
          </h2>
        </div>
        <div className="flex gap-2">
          <span className="mr-4 text-gray-700 font-medium text-xs mt-1">
            Create:
          </span>
          <button
            onClick={handleCreateServiceAssignment}
            disabled={isCreatingSA}
            className="w-[140px] rounded-[6.02px] h-[23px] text-xs font-medium bg-white border-silver border-solid border-[1.2px] box-border h-6"
          >
            {isCreatingSA ? <>Service Assignment..</> : "Service Assignment"}
          </button>
          <button
            onClick={() => {
              setIsCreatingReport(true);
              console.log("Create Report button clicked");
              setCreateReportDialogOpen(true);
              setTimeout(() => setIsCreatingReport(false), 1000);
            }}
            disabled={isCreatingReport}
            className="w-[93px] rounded-[6.02px] h-[23px] text-xs font-medium bg-white border-silver border-solid border-[1.2px] box-border h-6"
          >
            {isCreatingReport ? <>Report..</> : "Report"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Site Information */}
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-2">
            {/* Site Image and Map */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Site Image - Left Side */}
              <div className="relative aspect-square w-full">
                <Image
                  src={thumbnailUrl || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = isStatic
                      ? "/roadside-billboard.png"
                      : "/led-billboard-1.png";
                  }}
                />
              </div>

              {/* Google Map - Right Side */}
              <div className="relative aspect-square w-full bg-gray-100 overflow-hidden">
                <GoogleMap location={location} className="w-full h-full" />
              </div>
            </div>

            {/* Site Details */}
            <div className="space-y-2">
              <button className="w-full h-[25px] rounded-[6.02px] bg-white border-silver border-solid border-[1.2px] box-border text-xs font-medium text-center text-black">
                Site Calendar
              </button>
              <div className="flex flex-col w-full">
                <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left block">
                  Site
                </span>
                <b className="h-4 relative text-xs leading-[150%] inline-block font-inter text-darkslategray text-left">
                  {product.name || "Unnamed Site"}
                </b>
              </div>
              <div className="flex flex-col w-full">
                <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                  Location
                </span>
                <b className="text-xs truncate">{location}</b>
              </div>
              <div className="flex flex-col w-full">
                <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                  Geopoint
                </span>
                <b className="h-4 relative text-xs leading-[150%] inline-block font-inter text-darkslategray text-left">
                  {geopoint}
                </b>
              </div>
              <div className="flex flex-row w-full justify-between">
                <div className="flex flex-col w-full">
                  <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                    Type
                  </span>
                  <b className="h-4 text-xs">{category}</b>
                </div>
                <div className="flex flex-col w-full">
                  <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                    Dimension
                  </span>
                  <b className="h-4 text-xs">{dimension}</b>
                </div>
              </div>
              <div className="flex flex-col w-full">
                <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                  Orientation
                </span>
                <b className="h-4 relative text-xs leading-[150%] inline-block font-inter text-darkslategray text-left"></b>
              </div>
              <div className="flex flex-col w-full">
                <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                  Site Owner
                </span>
                <b className="h-4 relative text-xs leading-[150%] inline-block font-inter text-darkslategray text-left"></b>
              </div>
              <div className="flex flex-col w-full">
                <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                  Land Owner
                </span>
                <b className="h-4 relative text-xs leading-[150%] inline-block font-inter text-darkslategray text-left"></b>
              </div>
              <div className="flex flex-col w-full">
                <span className="text-[10px] leading-[150%] font-inter text-darkslategray text-left inline-block">
                  Partner
                </span>
                <b className="h-4 relative text-xs leading-[150%] inline-block font-inter text-darkslategray text-left"></b>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Site Data and Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row px-4 py-2 items-center justify-between">
              <span className="text-xs font-semibold">
                Job Orders{" "}
                {jobOrders.length > 0 ? `(${jobOrders.length})` : "0"}
              </span>
            </CardHeader>
            <CardContent className="px-4">
              {jobOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No job orders found for this site.
                </div>
              ) : (
                <div className="w-full overflow-x-auto overflow-y-hidden whitespace-nowrap flex space-x-2">
                  {jobOrders.map((jobOrder) => (
                    <div
                      key={jobOrder.id}
                      className="flex-shrink-0 w-[225px] h-[83px] flex items-center gap-3 rounded-lg bg-[#f0f7ff] border border-[#add0ff] cursor-pointer hover:shadow-md transition-shadow px-3 py-2"
                      onClick={() =>
                        router.push(
                          `/logistics/assignments/create?jobOrderId=${jobOrder.id}`
                        )
                      }
                    >
                      {/* Left Icon */}
                      <div className="flex-shrink-0 w-[36px] h-[36px] bg-gray-300 rounded-full flex items-center justify-center">
                        <Image
                          src="/icons/suitcase.png"
                          alt="JO"
                          width={36}
                          height={36}
                          className="object-cover"
                        />
                      </div>

                      {/* Text Content */}
                      <div className="flex flex-col justify-center overflow-hidden">
                        <p className="text-base font-bold m-0 truncate">
                          JO#{jobOrder.joNumber}
                        </p>
                        <p className="text-sm m-0 truncate">
                          from SALES-{jobOrder.requestedBy}
                        </p>
                        <p className="text-[10px] text-gray-600 m-0">
                          Sent on {formatFirebaseDate(jobOrder.created)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="">
            <Tabs defaultValue="gen-info" className="w-full">
              <TabsList
                className={`grid w-full ${showControlTab ? "grid-cols-5" : "grid-cols-4"}`}
              >
                <TabsTrigger value="gen-info">Gen. Info</TabsTrigger>
                <TabsTrigger value="content-history">
                  Content History
                </TabsTrigger>
                <TabsTrigger value="service-assignments">
                  Service Assignments
                </TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                {showControlTab && (
                  <TabsTrigger value="control">Control</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="gen-info" className="">
                <Card>
                  <CardHeader>
                    <CardTitle>General Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {/* Illumination */}
                      <div>
                        <div className="flex flex-row items-center justify-between px-4">
                          <div
                            className="text-lg flex items-center"
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 700,
                              fontSize: "16px",
                              lineHeight: "100%",
                              letterSpacing: "0%",
                              color: "#333",
                            }}
                          >
                            <Sun className="h-4 w-4 mr-2" />
                            Illumination
                          </div>
                          <div className="flex items-center space-x-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    console.log("Edit illumination clicked")
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex flex-col space-y-4">
                            <div className="flex items-start space-x-4">
                              <div className="flex flex-col items-center space-y-2">
                                <Switch
                                  checked={illuminationOn}
                                  onCheckedChange={(checked) => {
                                    if (!checked) {
                                      // Show "Coming Soon" dialog when trying to turn off
                                      setComingSoonDialogOpen(true);
                                      return;
                                    }
                                    setIlluminationOn(checked);
                                    // Update product data
                                    updateProduct(product.id, {
                                      illumination: {
                                        ...product.illumination,
                                        on: checked,
                                      },
                                    } as any)
                                      .then(() => {
                                        setProduct({
                                          ...product,
                                          illumination: {
                                            ...product.illumination,
                                            on: checked,
                                          },
                                        });
                                      })
                                      .catch((error) => {
                                        console.error(
                                          "Error updating illumination:",
                                          error
                                        );
                                        setIlluminationOn(!checked); // Revert on error
                                      });
                                  }}
                                  className="custom-switch"
                                />
                                <span className="text-xs text-gray-600">
                                  {illuminationOn ? "ON" : "OFF"}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <b className="leading-[100%] inline-block w-40 h-3 text-sm font-semibold">
                                  Switch:
                                </b>
                                <div className="leading-[100%] inline-block w-[211px] h-3.5 text-sm pt-2">
                                  6:00pm to 12:00pm
                                </div>
                              </div>
                            </div>

                            <div className="flex">
                              <div
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                                className="inline-block w-[107px]"
                              >
                                <p className="m-0">Upper:</p>
                                <p className="m-0">Bottom:</p>
                                <p className="m-0">Side (Left):</p>
                                <p className="m-0">Side (Right):</p>
                              </div>
                              <div
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 400,
                                  lineHeight: "132%",
                                }}
                                className="inline-block w-[134px]"
                              >
                                <p className="m-0">
                                  {product.specs_rental
                                    ?.illumination_upper_lighting_specs || "-"}
                                </p>
                                <p className="m-0">
                                  {product.specs_rental
                                    ?.illumination_bottom_lighting_specs || "-"}
                                </p>
                                <p className="m-0">
                                  {product.specs_rental
                                    ?.illumination_left_lighting_specs || "-"}
                                </p>
                                <p className="m-0">
                                  {product.specs_rental
                                    ?.illumination_right_lighting_specs || "-"}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <div
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 400,
                                  lineHeight: "132%",
                                }}
                              >
                                <span
                                  style={{
                                    color: "#333",
                                    fontFamily: "Inter",
                                    fontSize: "12px",
                                    fontStyle: "normal",
                                    fontWeight: 600,
                                    lineHeight: "132%",
                                  }}
                                >
                                  Average Monthly Electrical Consumption:{" "}
                                </span>
                                <span>
                                  {product.specs_rental
                                    ?.power_consumption_monthly || "-"}{" "}
                                  kWh/month
                                </span>
                              </div>
                              <button
                                onClick={() => setComingSoonDialogOpen(true)}
                                className="w-[93.971px] h-[23.493px] flex-shrink-0 border border-[#C4C4C4] bg-white rounded-[6.024px] text-center font-medium hover:bg-gray-50"
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 500,
                                  lineHeight: "100%",
                                }}
                              >
                                Index Card
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <hr className="border-gray-300" />

                      {/* Structure */}
                      <div>
                        <div className="flex flex-row items-center justify-between px-4">
                          <div>
                            <span
                              style={{
                                fontFamily: "Inter",
                                fontWeight: 700,
                                fontSize: "16px",
                                lineHeight: "100%",
                                letterSpacing: "0%",
                                color: "#333",
                                transform: "translate(0px, 0px)", // Add transform for position control
                              }}
                            >
                              Structure
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleStructureEdit}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          <div className="">
                            <div>
                              <span
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                              >
                                Color:
                              </span>{" "}
                              <span
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 400,
                                  lineHeight: "132%",
                                }}
                              >
                                {product.structure?.color || "Not Available"}
                              </span>
                            </div>
                            <div>
                              <span
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                              >
                                Contractor:
                              </span>{" "}
                              <span
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 400,
                                  lineHeight: "132%",
                                }}
                              >
                                {product.structure?.contractor ||
                                  "Not Available"}
                              </span>
                            </div>
                            <div>
                              <span
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                              >
                                Last Maintenance:
                              </span>{" "}
                              <span
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 400,
                                  lineHeight: "132%",
                                }}
                              >
                                {formatFirebaseDate(
                                  product.structure?.last_maintenance
                                ) || "Not Available"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <hr className="border-gray-300" />

                      {/* Compliance */}
                      <div>
                        <div className="flex flex-row items-center justify-between px-4">
                          <div
                            className="text-base flex items-center"
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 700,
                              fontSize: "16px",
                              lineHeight: "100%",
                              letterSpacing: "0%",
                              color: "#333",
                            }}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Compliance{" "}
                          </div>
                          <div className="flex items-center space-x-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    console.log("Edit compliance clicked")
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="px-4 pt-2 pb-4">
                          <div className="flex flex-col space-y-3">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="lease_agreement"
                                checked={compliance.lease_agreement}
                                disabled
                                className="custom-checkbox"
                              />
                              <label
                                htmlFor="lease_agreement"
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                              >
                                Lease Agreement
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="mayors_permit"
                                checked={compliance.mayors_permit}
                                disabled
                                className="custom-checkbox"
                              />
                              <label
                                htmlFor="mayors_permit"
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                              >
                                Mayor's Permit
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="bir_registration"
                                checked={compliance.bir_registration}
                                disabled
                                className="custom-checkbox"
                              />
                              <label
                                htmlFor="bir_registration"
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                              >
                                BIR Registration
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="structural_approval"
                                checked={compliance.structural_approval}
                                disabled
                                className="custom-checkbox"
                              />
                              <label
                                htmlFor="structural_approval"
                                style={{
                                  color: "#333",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 600,
                                  lineHeight: "132%",
                                }}
                              >
                                Structural Approval
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <hr className="border-gray-300" />

                      {/* Personnel */}
                      <div>
                        <div className="flex flex-row items-center justify-between px-4">
                          <div
                            className="text-base flex items-center"
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 700,
                              fontSize: "16px",
                              lineHeight: "100%",
                              letterSpacing: "0%",
                              color: "#333",
                            }}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Personnel
                          </div>
                          <div className="flex items-center space-x-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    console.log("Edit crew clicked")
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          {product.personnel && product.personnel.length > 0 ? (
                            <Table
                              className="border-none [&_tr]:border-none [&_td]:border-none [&_td]:py-1 [&_td]:pr-1 [&_td]:pl-0 [&_th]:border-none [&_th]:p-0 [&_tr]:hover:bg-transparent border-collapse"
                              style={{ borderSpacing: "0 0" }}
                            >
                              <TableHeader>
                                <TableRow className="h-8">
                                  <TableHead
                                    style={{
                                      color: "#333",
                                      fontFamily: "Inter",
                                      fontSize: "12px",
                                      fontStyle: "normal",
                                      fontWeight: 600,
                                      lineHeight: "132%",
                                    }}
                                  >
                                    Name
                                  </TableHead>
                                  <TableHead
                                    style={{
                                      color: "#333",
                                      fontFamily: "Inter",
                                      fontSize: "12px",
                                      fontStyle: "normal",
                                      fontWeight: 600,
                                      lineHeight: "132%",
                                    }}
                                  >
                                    Position
                                  </TableHead>
                                  <TableHead
                                    style={{
                                      color: "#333",
                                      fontFamily: "Inter",
                                      fontSize: "12px",
                                      fontStyle: "normal",
                                      fontWeight: 600,
                                      lineHeight: "132%",
                                    }}
                                  >
                                    Contact
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {product.personnel.map(
                                  (person: any, index: number) => (
                                    <TableRow key={index}>
                                      <TableCell
                                        style={{
                                          color: "#333",
                                          fontFamily: "Inter",
                                          fontSize: "12px",
                                          fontStyle: "normal",
                                          fontWeight: 400,
                                          lineHeight: "132%",
                                        }}
                                      >
                                        {person.name || ""}
                                      </TableCell>
                                      <TableCell
                                        style={{
                                          color: "#333",
                                          fontFamily: "Inter",
                                          fontSize: "12px",
                                          fontStyle: "normal",
                                          fontWeight: 400,
                                          lineHeight: "132%",
                                        }}
                                      >
                                        {person.position || ""}
                                      </TableCell>
                                      <TableCell
                                        style={{
                                          color: "#333",
                                          fontFamily: "Inter",
                                          fontSize: "12px",
                                          fontStyle: "normal",
                                          fontWeight: 400,
                                          lineHeight: "132%",
                                        }}
                                      >
                                        {person.contact || ""}
                                      </TableCell>
                                    </TableRow>
                                  )
                                )}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              <p
                                style={{
                                  color: "#666",
                                  fontFamily: "Inter",
                                  fontSize: "12px",
                                  fontStyle: "normal",
                                  fontWeight: 400,
                                  lineHeight: "132%",
                                }}
                              >
                                No personnel information available
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="content-history" className="">
                <Card>
                  <CardHeader>
                    <CardTitle>Content History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      Content history will be displayed here
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="service-assignments" className="">
                <Card>
                  <CardHeader>
                    <CardTitle>Service Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SiteServiceAssignmentsTable
                      projectSiteId={resolvedParams.id}
                      companyId={product.company_id}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reports" className="">
                <Card>
                  <CardHeader>
                    <CardTitle>Reports</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SiteReportsTable
                      projectSiteId={resolvedParams.id}
                      companyId={product.company_id}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {showControlTab && (
                <TabsContent value="control" className="">
                  <SiteControls product={product} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>

      {/* Keeping ServiceAssignmentDetailsDialog for now, but disabled, in case it's used elsewhere */}
      <ServiceAssignmentDetailsDialog
        open={false}
        onOpenChange={() => {}}
        assignmentId={null}
        onStatusChange={() => {}}
      />
      <AlarmSettingDialog
        open={alarmDialogOpen}
        onOpenChange={setAlarmDialogOpen}
      />
      <IlluminationIndexCardDialog
        open={illuminationIndexCardDialogOpen}
        onOpenChange={setIlluminationIndexCardDialogOpen}
        product={product}
        onCreateSA={() => {
          // Navigate to create service assignment with this site pre-selected
          router.push(
            `/logistics/assignments/create?projectSite=${resolvedParams.id}`
          );
          router.push(
            `/logistics/assignments/create?projectSite=${resolvedParams.id}`
          );
        }}
      />
      <DisplayIndexCardDialog
        open={displayIndexCardDialogOpen}
        onOpenChange={setDisplayIndexCardDialogOpen}
        onCreateSA={() => {
          // Navigate to create service assignment with this site pre-selected
          router.push(
            `/logistics/assignments/create?projectSite=${resolvedParams.id}`
          );
          router.push(
            `/logistics/assignments/create?projectSite=${resolvedParams.id}`
          );
        }}
      />
      <CreateReportDialog
        open={createReportDialogOpen}
        onOpenChange={setCreateReportDialogOpen}
        siteId={resolvedParams.id}
        module="logistics"
      />

      {/* Blueprint Dialog */}
      <Dialog open={blueprintDialogOpen} onOpenChange={setBlueprintDialogOpen}>
        <DialogContent className="max-w-2xl mx-auto max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Blueprints</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Upload Preview (when selecting a new file) */}
            {blueprintPreviewUrl && (
              <div className="w-full h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                {selectedBlueprintFile?.type === "application/pdf" ? (
                  <div className="w-full h-full">
                    <Document
                      file={blueprintPreviewUrl}
                      onLoadSuccess={onPdfLoadSuccess}
                      onLoadError={onPdfLoadError}
                      loading={
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                      }
                    >
                      <Page pageNumber={pdfPageNumber} width={200} />
                    </Document>
                  </div>
                ) : (
                  <img
                    src={blueprintPreviewUrl}
                    alt="New blueprint preview"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}

            {/* Blueprints List */}
            <div className="max-h-96 overflow-y-auto space-y-3">
              {(() => {
                // Get all blueprints (handle both old and new formats)
                let blueprints: Array<{
                  blueprint: string;
                  uploaded_by: string;
                  created: any;
                }> = [];

                if (product?.blueprints) {
                  if (Array.isArray(product.blueprints)) {
                    // New format - already an array
                    blueprints = product.blueprints;
                  } else {
                    // Old format - convert object to array
                    blueprints = Object.values(product.blueprints);
                  }
                }

                if (blueprints && blueprints.length > 0) {
                  // Sort by created timestamp (most recent first)
                  const sortedBlueprints = [...blueprints].sort(
                    (a: { created: any }, b: { created: any }) => {
                      const timeA =
                        a.created instanceof Date
                          ? a.created.getTime()
                          : a.created?.seconds * 1000 || 0;
                      const timeB =
                        b.created instanceof Date
                          ? b.created.getTime()
                          : b.created?.seconds * 1000 || 0;
                      return timeB - timeA;
                    }
                  );

                  return sortedBlueprints.map(
                    (
                      blueprint: {
                        blueprint: string;
                        uploaded_by: string;
                        created: any;
                      },
                      index: number
                    ) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-white"
                      >
                        {/* Left side - Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">
                            {blueprint.uploaded_by}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatFirebaseDate(blueprint.created)}
                          </div>
                        </div>

                        {/* Right side - Blueprint Preview */}
                        <div
                          className="w-20 h-20 bg-gray-100 rounded border overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleBlueprintClick(blueprint)}
                        >
                          {isPdfFile(blueprint.blueprint) ? (
                            <div className="w-full h-full">
                              <Document
                                file={blueprint.blueprint}
                                loading={
                                  <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                  </div>
                                }
                              >
                                <Page pageNumber={1} width={80} height={80} />
                              </Document>
                            </div>
                          ) : (
                            <img
                              src={blueprint.blueprint}
                              alt="Blueprint"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      </div>
                    )
                  );
                } else {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-sm">No blueprints uploaded yet</div>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleBlueprintFileSelect}
              className="hidden"
            />

            {/* Upload Button */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleUploadButtonClick}
                disabled={isUploadingBlueprint}
              >
                {selectedBlueprintFile ? "Change File" : "Add New Blueprints"}
              </Button>
              {selectedBlueprintFile && (
                <Button
                  className="flex-1"
                  onClick={handleBlueprintUpload}
                  disabled={isUploadingBlueprint}
                >
                  {isUploadingBlueprint ? "Uploading..." : "Upload Blueprint"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blueprint Success Dialog */}
      <Dialog
        open={blueprintSuccessDialogOpen}
        onOpenChange={setBlueprintSuccessDialogOpen}
      >
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Success</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="text-green-600 text-lg font-semibold mb-2">✓</div>
            <p className="text-gray-700">Blueprint uploaded successfully!</p>
          </div>
          <div className="flex justify-center">
            <Button
              onClick={() => setBlueprintSuccessDialogOpen(false)}
              className="w-full"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Blueprint Dialog */}
      <Dialog
        open={fullscreenDialogOpen}
        onOpenChange={setFullscreenDialogOpen}
      >
        <DialogContent className="max-w-6xl mx-auto max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {fullscreenBlueprint && (
                <div className="text-left">
                  <div className="font-medium">
                    {fullscreenBlueprint.uploaded_by}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatFirebaseDate(fullscreenBlueprint.created)}
                  </div>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {fullscreenBlueprint && (
              <div className="w-full h-full min-h-[60vh] bg-gray-100 rounded-lg overflow-hidden">
                {isPdfFile(fullscreenBlueprint.blueprint) ? (
                  <div className="w-full h-full relative">
                    <Document
                      file={fullscreenBlueprint.blueprint}
                      onLoadSuccess={onFullscreenPdfLoadSuccess}
                      loading={
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                      }
                    >
                      <Page
                        pageNumber={fullscreenPdfPageNumber}
                        width={800}
                        className="mx-auto"
                      />
                    </Document>
                    {fullscreenPdfNumPages && fullscreenPdfNumPages > 1 && (
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setFullscreenPdfPageNumber(
                              Math.max(1, fullscreenPdfPageNumber - 1)
                            )
                          }
                          disabled={fullscreenPdfPageNumber <= 1}
                          className="text-white hover:bg-white hover:text-black"
                        >
                          ‹
                        </Button>
                        <span className="text-sm">
                          Page {fullscreenPdfPageNumber} of{" "}
                          {fullscreenPdfNumPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setFullscreenPdfPageNumber(
                              Math.min(
                                fullscreenPdfNumPages,
                                fullscreenPdfPageNumber + 1
                              )
                            )
                          }
                          disabled={
                            fullscreenPdfPageNumber >= fullscreenPdfNumPages
                          }
                          className="text-white hover:bg-white hover:text-black"
                        >
                          ›
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <img
                    src={fullscreenBlueprint.blueprint}
                    alt="Fullscreen blueprint"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Structure Update Dialog */}
      <Dialog
        open={structureUpdateDialogOpen}
        onOpenChange={setStructureUpdateDialogOpen}
      >
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Structure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <input
                type="text"
                value={structureForm.color}
                onChange={(e) =>
                  setStructureForm({ ...structureForm, color: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter structure color"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contractor</label>
              <input
                type="text"
                value={structureForm.contractor}
                onChange={(e) =>
                  setStructureForm({
                    ...structureForm,
                    contractor: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contractor name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Condition</label>
              <input
                type="text"
                value={structureForm.condition}
                onChange={(e) =>
                  setStructureForm({
                    ...structureForm,
                    condition: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter structure condition"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setStructureUpdateDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStructureUpdate}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coming Soon Dialog */}
      <Dialog
        open={comingSoonDialogOpen}
        onOpenChange={setComingSoonDialogOpen}
      >
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Coming Soon</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-gray-700">This feature is coming soon!</p>
          </div>
          <div className="flex justify-center">
            <Button
              onClick={() => setComingSoonDialogOpen(false)}
              className="w-full"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Maintenance History Dialog */}
      <Dialog
        open={maintenanceHistoryDialogOpen}
        onOpenChange={setMaintenanceHistoryDialogOpen}
      >
        <DialogContent className="max-w-3xl mx-auto max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: "18px",
                lineHeight: "120%",
                letterSpacing: "0%",
                color: "#000000",
              }}
            >
              Maintenance History
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {maintenanceHistoryLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 400,
                    fontSize: "14px",
                    lineHeight: "120%",
                    letterSpacing: "0%",
                    color: "#666666",
                  }}
                >
                  Loading maintenance history...
                </p>
              </div>
            ) : (
              <div className="overflow-auto max-h-96 border rounded-md">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead
                        className="w-1/4"
                        style={{
                          fontFamily: "Inter",
                          fontWeight: 600,
                          fontSize: "14px",
                          lineHeight: "120%",
                          letterSpacing: "0%",
                          color: "#000000",
                        }}
                      >
                        Date
                      </TableHead>
                      <TableHead
                        className="w-1/4"
                        style={{
                          fontFamily: "Inter",
                          fontWeight: 600,
                          fontSize: "14px",
                          lineHeight: "120%",
                          letterSpacing: "0%",
                          color: "#000000",
                        }}
                      >
                        SA Type
                      </TableHead>
                      <TableHead
                        className="w-1/4"
                        style={{
                          fontFamily: "Inter",
                          fontWeight: 600,
                          fontSize: "14px",
                          lineHeight: "120%",
                          letterSpacing: "0%",
                          color: "#000000",
                        }}
                      >
                        SA No.
                      </TableHead>
                      <TableHead
                        className="w-1/4"
                        style={{
                          fontFamily: "Inter",
                          fontWeight: 600,
                          fontSize: "14px",
                          lineHeight: "120%",
                          letterSpacing: "0%",
                          color: "#000000",
                        }}
                      >
                        Report
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <p
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 500,
                              fontSize: "14px",
                              lineHeight: "120%",
                              letterSpacing: "0%",
                              color: "#666666",
                            }}
                          >
                            No maintenance history found for this site.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      maintenanceHistory.map((assignment) => (
                        <TableRow
                          key={assignment.id}
                          className="hover:bg-gray-50"
                        >
                          <TableCell
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 500,
                              fontSize: "14px",
                              lineHeight: "120%",
                              letterSpacing: "0%",
                              color: "#000000",
                            }}
                          >
                            {formatFirebaseDate(assignment.created)}
                          </TableCell>
                          <TableCell
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 400,
                              fontSize: "14px",
                              lineHeight: "120%",
                              letterSpacing: "0%",
                              color: "#333333",
                            }}
                          >
                            {assignment.serviceType || "N/A"}
                          </TableCell>
                          <TableCell
                            style={{
                              fontFamily: "Inter",
                              fontWeight: 400,
                              fontSize: "14px",
                              lineHeight: "120%",
                              letterSpacing: "0%",
                              color: "#333333",
                            }}
                          >
                            {assignment.saNumber || "N/A"}
                          </TableCell>
                          <TableCell>
                            {assignment.attachments &&
                            assignment.attachments.length > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                style={{
                                  fontFamily: "Inter",
                                  fontWeight: 600,
                                  fontSize: "14px",
                                  lineHeight: "120%",
                                  letterSpacing: "0%",
                                  color: "#000000",
                                }}
                              >
                                View Report
                              </Button>
                            ) : (
                              <span
                                style={{
                                  fontFamily: "Inter",
                                  fontWeight: 500,
                                  fontSize: "14px",
                                  lineHeight: "120%",
                                  letterSpacing: "0%",
                                  color: "#666666",
                                }}
                              >
                                N/A
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setMaintenanceHistoryDialogOpen(false)}
              className="w-32"
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: "14px",
                lineHeight: "120%",
                letterSpacing: "0%",
                color: "#FFFFFF",
              }}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
