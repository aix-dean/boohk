"use client"; // Convert to client component

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context"; // Assuming useAuth provides user data
import { RegistrationSuccessDialog } from "@/components/registration-success-dialog"; // Import the dialog
import { RouteProtection } from "@/components/route-protection";
import {
  getServiceAssignmentsByCompanyId,
  ServiceAssignment,
  getCalendarEventsForWindow,
  CalendarEvent,
} from "@/lib/firebase-service";
import { getPettyCashConfig, getActivePettyCashCycle, PettyCashConfig, PettyCashCycle, getLatestPettyCashCycle, savePettyCashExpense, updatePettyCashCycleTotal, getPettyCashCycles, getPettyCashExpenses, uploadFileToFirebase } from "@/lib/petty-cash-service"
import { getOccupancyData } from "@/lib/firebase-service"
import { AlertTriangle } from "lucide-react"
import { AddExpenseDialog } from "@/components/add-expense-dialog"
import { useToast } from "@/hooks/use-toast"
import { searchServiceAssignments, type SearchResult, type SearchResponse } from "@/lib/algolia-service"
import { useDebounce } from "@/hooks/use-debounce"
import { ActiveUsersGrid } from "@/components/active-users-grid"
import { salesQuotaService } from "@/lib/sales-quota-service"
import { SalesQuotaBreakdownDialog } from "@/components/sales-quota-breakdown-dialog"
import type { SalesQuotaSummary } from "@/lib/types/sales-quota"
import { SalesEvent, getSalesEvents } from "@/lib/planner-service"
import { EventDetailsDialog } from "@/components/event-details-dialog"
import { getTodosByUser } from "@/lib/todo-service"
import type { Todo } from "@/lib/types/todo"
import { bookingService } from "@/lib/booking-service"
import type { Booking } from "@/lib/booking-service"

// Existing imports and content of app/sales/dashboard/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { Timestamp, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userData } = useAuth(); // Get user data from auth context
  const { toast } = useToast();

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("Jun 2025");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [serviceAssignments, setServiceAssignments] = useState<
    ServiceAssignment[]
  >([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<{
    [date: string]: CalendarEvent[];
  }>({});
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [events, setEvents] = useState<SalesEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [calendarAssignments, setCalendarAssignments] = useState<ServiceAssignment[]>([])
  const [loadingCalendarAssignments, setLoadingCalendarAssignments] = useState(true)
  const [calendarTodos, setCalendarTodos] = useState<Todo[]>([])
  const [loadingCalendarTodos, setLoadingCalendarTodos] = useState(true)
  const [calendarBookings, setCalendarBookings] = useState<Booking[]>([])
  const [loadingCalendarBookings, setLoadingCalendarBookings] = useState(true)
  const [pettyCashConfig, setPettyCashConfig] = useState<PettyCashConfig | null>(null);
  const [pettyCashCycle, setPettyCashCycle] = useState<PettyCashCycle | null>(null);
  const [pettyCashBalance, setPettyCashBalance] = useState(0);
  const [loadingPettyCash, setLoadingPettyCash] = useState(true);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [loadingOccupancy, setLoadingOccupancy] = useState(true);

  // Sales Quota state
  const [salesQuotaSummary, setSalesQuotaSummary] = useState<SalesQuotaSummary | null>(null);
  const [loadingSalesQuota, setLoadingSalesQuota] = useState(true);
  const [isSalesQuotaDialogOpen, setIsSalesQuotaDialogOpen] = useState(false);
  const [eventDetailsDialogOpen, setEventDetailsDialogOpen] = useState(false)
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<SalesEvent | null>(null)

  // Product counts for Occupancy Index
  const [staticCount, setStaticCount] = useState(0);
  const [totalStatic, setTotalStatic] = useState(0);
  const [dynamicCount, setDynamicCount] = useState(0);
  const [totalDynamic, setTotalDynamic] = useState(0);

  // Calculate occupancy percentage
  const totalUnavailable = staticCount + dynamicCount;
  const totalProducts = totalStatic + totalDynamic;
  const occupancyPercentage = totalProducts > 0 ? Math.round((totalUnavailable / totalProducts) * 100) : 0;

  // Service Assignments Search state
  const [serviceAssignmentsSearchTerm, setServiceAssignmentsSearchTerm] = useState("")
  const [serviceAssignmentsSearchResults, setServiceAssignmentsSearchResults] = useState<SearchResult[]>([])
  const [serviceAssignmentsSearchResponse, setServiceAssignmentsSearchResponse] = useState<SearchResponse | null>(null)
  const [isSearchingServiceAssignments, setIsSearchingServiceAssignments] = useState(false)
  const [serviceAssignmentsSearchError, setServiceAssignmentsSearchError] = useState<string | null>(null)
  const debouncedServiceAssignmentsSearchTerm = useDebounce(serviceAssignmentsSearchTerm, 500)

  // Service Assignments Pagination state
  const [serviceAssignmentsCurrentPage, setServiceAssignmentsCurrentPage] = useState(1)
  const serviceAssignmentsItemsPerPage = 10

  // Check if petty cash balance is low
  const isPettyCashBalanceLow = pettyCashConfig ? pettyCashBalance <= pettyCashConfig.warning_amount : false;

  // Fetch petty cash config on component mount
  useEffect(() => {
    const fetchPettyCashConfig = async () => {
      if (userData?.company_id) {
        try {
          const config = await getPettyCashConfig(userData.company_id);
          setPettyCashConfig(config);
        } catch (error) {
          console.error("Error fetching petty cash config:", error);
        }
      }
    };

    fetchPettyCashConfig();
  }, [userData?.company_id]);

  useEffect(() => {
    const registeredParam = searchParams.get("registered");
    const dialogShownKey = "registrationSuccessDialogShown";

    if (registeredParam === "true" && !sessionStorage.getItem(dialogShownKey)) {
      setShowSuccessDialog(true);
      sessionStorage.setItem(dialogShownKey, "true"); // Mark as shown for this session
      // Remove the query parameter immediately
      router.replace("/sales/dashboard", undefined);
    }
  }, [searchParams, router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setServiceAssignmentsCurrentPage(1);
  }, [debouncedServiceAssignmentsSearchTerm]);

  useEffect(() => {
    const fetchServiceAssignments = async () => {
      if (userData?.company_id) {
        setLoadingAssignments(true);
        try {
          const assignments = await getServiceAssignmentsByCompanyId(
            userData.company_id
          );
          setServiceAssignments(assignments);
        } catch (error) {
          console.error("Error fetching service assignments:", error);
        } finally {
          setLoadingAssignments(false);
        }
      }
    };

    fetchServiceAssignments();
  }, [userData?.company_id]);

  useEffect(() => {
    const fetchCalendarEvents = async () => {
      if (userData?.company_id) {
        setLoadingCalendar(true);
        try {
          // Fetch all events for the 3-day window at once
          const events = await getCalendarEventsForWindow(userData.company_id);
          setCalendarEvents(events);
        } catch (error) {
          console.error("Error fetching calendar events:", error);
        } finally {
          setLoadingCalendar(false);
        }
      }
    };

    fetchCalendarEvents();
  }, [userData?.company_id]);

  // Set up real-time listener for latest petty cash cycle
  useEffect(() => {
    console.log("Setting up real-time listener for latest cycle - userData:", userData)
    console.log("Company ID:", userData?.company_id)

    if (!userData?.company_id) {
      console.log("No company_id found, skipping cycle listener")
      return
    }

    setLoadingPettyCash(true)

    const cyclesRef = collection(db, "petty_cash_cycles")
    const q = query(
      cyclesRef,
      where("company_id", "==", userData.company_id),
      orderBy("cycle_no", "desc"),
      limit(1)
    )

    console.log("Setting up onSnapshot for latest petty cash cycle")
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log("onSnapshot triggered for latest cycle, docs:", querySnapshot.size)
      querySnapshot.docChanges().forEach((change) => {
        console.log("Change type:", change.type, "doc id:", change.doc.id, "data:", change.doc.data())
      })
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0]
        const cycle = { id: doc.id, ...doc.data() } as PettyCashCycle
        console.log("Latest cycle updated to:", cycle.cycle_no, "id:", cycle.id)
        setPettyCashCycle(cycle)

        // Calculate remaining balance: config amount - cycle expenses
        const balance = pettyCashConfig ? pettyCashConfig.amount - (cycle?.total || 0) : 0
        setPettyCashBalance(balance)
      } else {
        console.log("No cycles found, setting currentCycle to null")
        setPettyCashCycle(null)
        setPettyCashBalance(pettyCashConfig?.amount || 0)
      }
      setLoadingPettyCash(false)
    }, (error) => {
      console.error("Error in onSnapshot for latest cycle:", error)
      setPettyCashCycle(null)
      setPettyCashBalance(pettyCashConfig?.amount || 0)
      setLoadingPettyCash(false)
    })

    return unsubscribe
  }, [userData?.company_id, pettyCashConfig?.amount])

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      if (!userData?.company_id) return;

      setLoadingEvents(true);
      try {
        const fetchedEvents = await getSalesEvents(true, "admin", userData.company_id);
        setEvents(fetchedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [userData?.company_id]);

  // Fetch product counts for Occupancy Index
  useEffect(() => {
    const fetchProductCounts = async () => {
      if (!userData?.company_id) return;

      setLoadingOccupancy(true);
      try {
        const occupancyData = await getOccupancyData(userData.company_id);

        setStaticCount(occupancyData.staticUnavailable);
        setTotalStatic(occupancyData.staticTotal);
        setDynamicCount(occupancyData.dynamicUnavailable);
        setTotalDynamic(occupancyData.dynamicTotal);
      } catch (error) {
        console.error("Error fetching product counts:", error);
      } finally {
        setLoadingOccupancy(false);
      }
    };

    fetchProductCounts();
  }, [userData?.company_id]);

  // Fetch sales quota data
  useEffect(() => {
    const fetchSalesQuotaData = async () => {
      if (!userData?.company_id) return;

      setLoadingSalesQuota(true);
      try {
        const currentDate = new Date();
        const summary = await salesQuotaService.getSalesQuotaSummary(
          userData.company_id,
          currentDate.getMonth() + 1, // getMonth() returns 0-11, we need 1-12
          currentDate.getFullYear()
        );
        setSalesQuotaSummary(summary);
      } catch (error) {
        console.error("Error fetching sales quota data:", error);
        // Set default values if no data exists
        setSalesQuotaSummary({
          averageAchievement: 0,
          totalAssociates: 0,
          associatesOnTrack: 0,
          associatesBelowTarget: 0,
          totalTargets: 0,
          totalActual: 0,
        });
      } finally {
        setLoadingSalesQuota(false);
      }
    };

    fetchSalesQuotaData();
  }, [userData?.company_id]);

  // Fetch todos for calendar
  useEffect(() => {
    const fetchTodos = async () => {
      if (!userData?.company_id) {
        setCalendarTodos([]);
        return;
      }

      setLoadingCalendarTodos(true);
      try {
        const fetchedTodos = await getTodosByUser("", userData.company_id, "admin");
        // Filter to ensure only non-deleted todos that are not completed are displayed
        const activeTodos = fetchedTodos.filter(todo => !todo.isDeleted && (todo.status === "todo" || todo.status === "in-progress"));
        setCalendarTodos(activeTodos);
      } catch (error) {
        console.error("Error fetching todos:", error);
        setCalendarTodos([]);
      } finally {
        setLoadingCalendarTodos(false);
      }
    };

    fetchTodos();
  }, [userData?.company_id]);

  // Fetch bookings for calendar
  useEffect(() => {
    const fetchBookings = async () => {
      if (!userData?.company_id) {
        setCalendarBookings([]);
        return;
      }

      setLoadingCalendarBookings(true);
      try {
        // Get both completed and collectible (reserved) bookings for the company
        const [completedBookings, reservedBookings] = await Promise.all([
          bookingService.getCompletedBookings(userData.company_id),
          bookingService.getCollectiblesBookings(userData.company_id)
        ]);

        // Combine and deduplicate bookings
        const allBookings = [...completedBookings, ...reservedBookings];
        const uniqueBookings = allBookings.filter((booking, index, self) =>
          index === self.findIndex(b => b.id === booking.id)
        );

        setCalendarBookings(uniqueBookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        setCalendarBookings([]);
      } finally {
        setLoadingCalendarBookings(false);
      }
    };

    fetchBookings();
  }, [userData?.company_id]);

  // Search service assignments when search term or page changes
  useEffect(() => {
    const performServiceAssignmentsSearch = async () => {
      if (!debouncedServiceAssignmentsSearchTerm.trim()) {
        setServiceAssignmentsSearchResults([])
        setServiceAssignmentsSearchResponse(null)
        setIsSearchingServiceAssignments(false)
        setServiceAssignmentsSearchError(null)
        return
      }

      setIsSearchingServiceAssignments(true)
      setServiceAssignmentsSearchError(null)

      try {
        console.log(`Searching service assignments for: "${debouncedServiceAssignmentsSearchTerm}" page: ${serviceAssignmentsCurrentPage - 1}`)
        const response = await searchServiceAssignments(
          debouncedServiceAssignmentsSearchTerm,
          userData?.company_id || undefined,
          serviceAssignmentsCurrentPage - 1, // Algolia page starts at 0
          serviceAssignmentsItemsPerPage
        )

        if (response && Array.isArray(response.hits)) {
          setServiceAssignmentsSearchResults(response.hits)
          setServiceAssignmentsSearchResponse(response)
          console.log(`Service assignments search returned ${response.hits.length} results`)

          if (response.error) {
            setServiceAssignmentsSearchError(response.error)
          } else {
            setServiceAssignmentsSearchError(null)
          }
        } else {
          console.error("Invalid service assignments search response:", response)
          setServiceAssignmentsSearchResults([])
          setServiceAssignmentsSearchResponse(null)
          setServiceAssignmentsSearchError(response.error || "Received invalid search results")
        }
      } catch (error) {
        console.error("Service assignments search error:", error)
        setServiceAssignmentsSearchResults([])
        setServiceAssignmentsSearchResponse(null)
        setServiceAssignmentsSearchError("Failed to perform search")
      } finally {
        setIsSearchingServiceAssignments(false)
      }
    }

    performServiceAssignmentsSearch()
  }, [debouncedServiceAssignmentsSearchTerm, serviceAssignmentsCurrentPage, userData?.company_id])

  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    // No need to remove query param here, it's already done in useEffect
  };

  const handleServiceAssignmentsNextPage = () => {
    setServiceAssignmentsCurrentPage(prev => prev + 1);
  };

  const handleServiceAssignmentsPreviousPage = () => {
    setServiceAssignmentsCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleEventClick = (event: SalesEvent) => {
    setSelectedEventForDetails(event)
    setEventDetailsDialogOpen(true)
  }

  const getItemTitle = (type: string, item: any) => {
    switch (type) {
      case 'calendar':
      case 'event':
        return item.title;
      case 'assignment':
        return item.saNumber;
      case 'todo':
        return item.title;
      case 'booking':
        return item.reservation_id || item.id.slice(-8);
      default:
        return '';
    }
  }

  // Calculate paginated service assignments for non-search mode
  const serviceAssignmentsStartIndex = (serviceAssignmentsCurrentPage - 1) * serviceAssignmentsItemsPerPage;
  const paginatedServiceAssignments = serviceAssignments.slice(
    serviceAssignmentsStartIndex,
    serviceAssignmentsStartIndex + serviceAssignmentsItemsPerPage
  );

  // Pagination props
  const isSearchingServiceAssignmentsMode = debouncedServiceAssignmentsSearchTerm.trim() !== "";
  const totalServiceAssignmentsPages = Math.ceil(serviceAssignments.length / serviceAssignmentsItemsPerPage);
  const serviceAssignmentsHasMore = isSearchingServiceAssignmentsMode
    ? serviceAssignmentsSearchResponse ? serviceAssignmentsSearchResponse.page < serviceAssignmentsSearchResponse.nbPages - 1 : false
    : serviceAssignmentsCurrentPage < totalServiceAssignmentsPages;
  const serviceAssignmentsTotalItems = isSearchingServiceAssignmentsMode
    ? serviceAssignmentsSearchResults.length
    : paginatedServiceAssignments.length;
  const serviceAssignmentsTotalOverall = isSearchingServiceAssignmentsMode
    ? serviceAssignmentsSearchResponse?.nbHits
    : serviceAssignments.length;

  const handleAddExpense = async (data: { item: string; amount: number; requestedBy: string; attachments: File[] }) => {
    console.log("handleAddExpense called with data:", data)
    if (!userData?.company_id || !userData?.uid) {
      console.log("Missing user data:", { company_id: userData?.company_id, uid: userData?.uid })
      toast({
        title: "Error",
        description: "User authentication required",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Getting latest cycle for company:", userData.company_id)
      // Get latest cycle
      const latestCycle = await getLatestPettyCashCycle(userData.company_id)
      console.log("Latest cycle:", latestCycle)
      if (!latestCycle) {
        toast({
          title: "Error",
          description: "No petty cash cycle found. Please create a cycle first.",
          variant: "destructive",
        })
        return
      }

      // Upload attachments
      console.log("Uploading attachments:", data.attachments.length, "files")
      const attachmentUrls: string[] = []
      for (const file of data.attachments) {
        try {
          console.log("Uploading file:", file.name)
          const url = await uploadFileToFirebase(file, `petty-cash/${userData.company_id}/${latestCycle.id}`)
          console.log("Uploaded URL:", url)
          attachmentUrls.push(url)
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError)
          toast({
            title: "Upload Error",
            description: `Failed to upload ${file.name}`,
            variant: "destructive",
          })
          return
        }
      }
      console.log("All attachments uploaded:", attachmentUrls)

      // Save expense
      console.log("Saving expense with data:", {
        companyId: userData.company_id,
        userId: userData.uid,
        cycleId: latestCycle.id,
        expenseData: {
          item: data.item,
          amount: data.amount,
          requestedBy: data.requestedBy,
          attachment: attachmentUrls,
        }
      })
      if (!latestCycle.id) {
        toast({
          title: "Error",
          description: "Invalid cycle ID",
          variant: "destructive",
        })
        return
      }
      await savePettyCashExpense(
        userData.company_id,
        userData.uid,
        latestCycle.id,
        {
          item: data.item,
          amount: data.amount,
          requestedBy: data.requestedBy,
          attachment: attachmentUrls,
        }
      )
      console.log("Expense saved successfully")

      // Update cycle total
      const newTotal = latestCycle.total + data.amount
      console.log("Updating cycle total from", latestCycle.total, "to", newTotal)
      if (!latestCycle.id) {
        toast({
          title: "Error",
          description: "Invalid cycle ID for update",
          variant: "destructive",
        })
        return
      }
      await updatePettyCashCycleTotal(latestCycle.id, newTotal)
      console.log("Cycle total updated")


      toast({
        title: "Success",
        description: "Expense added successfully",
      })

    } catch (error) {
      console.error("Error adding expense:", error)
      toast({
        title: "Error",
        description: "Failed to add expense",
        variant: "destructive",
      })
    } finally {
      setIsAddExpenseOpen(false)
    }
  }

  // Define a type for department data
  interface Department {
    id: string;
    name: string;
    headerColor: string; // Tailwind class name for header background
    contentBgColor: string; // New: Tailwind class name for content background
    members: string[];
    metricLabel?: string;
    metricValue?: string;
    badgeCount?: number;
    href?: string;
    isAvailable?: boolean;
  }

  // Department Card Component
  function DepartmentCard({ department }: { department: Department }) {
    const cardContent = (
      <>
        <CardHeader
          className={cn(
            "relative p-4 rounded-t-lg",
            department.isAvailable !== false
              ? department.headerColor
              : "bg-gray-400",
            department.isAvailable === false && "grayscale"
          )}
        >
          <CardTitle
            className={cn(
              "text-white text-lg font-semibold flex justify-between items-center",
              department.isAvailable === false && "opacity-60"
            )}
          >
            {department.name}
            {department.badgeCount !== undefined && (
              <Badge
                className={cn(
                  "bg-white text-gray-800 rounded-full px-2 py-0.5 text-xs font-bold",
                  department.isAvailable === false && "opacity-60"
                )}
              >
                {department.badgeCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "p-4 rounded-b-lg flex flex-col justify-between flex-grow",
            department.isAvailable !== false
              ? department.contentBgColor
              : "bg-gray-100",
            department.isAvailable === false && "grayscale"
          )}
        >
          <div>
            {department.members.map((member, index) => (
              <p
                key={index}
                className={cn(
                  "text-sm text-gray-700 flex items-center gap-1",
                  department.isAvailable === false && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    department.isAvailable !== false
                      ? "bg-green-500"
                      : "bg-gray-400"
                  )}
                />
                {member}
              </p>
            ))}
            {department.metricLabel && department.metricValue && (
              <div
                className={cn(
                  "mt-4 text-sm",
                  department.isAvailable === false && "opacity-60"
                )}
              >
                <p className="text-gray-500">{department.metricLabel}</p>
                <p className="font-bold text-gray-800">
                  {department.metricValue}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className={cn(
              "mt-4 w-full bg-transparent",
              department.isAvailable === false &&
              "opacity-60 cursor-not-allowed"
            )}
            disabled={department.isAvailable === false}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Widget
          </Button>
        </CardContent>
      </>
    );

    if (department.href && department.isAvailable !== false) {
      return (
        <Link href={department.href} passHref>
          <Card className="h-full flex flex-col overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
            {cardContent}
          </Card>
        </Link>
      );
    }

    return (
      <Card
        className={cn(
          "h-full flex flex-col overflow-hidden",
          department.isAvailable === false && "cursor-not-allowed"
        )}
      >
        {cardContent}
      </Card>
    );
  }

  const departmentData: Department[] = [
    {
      id: "sales",
      name: "Sales",
      headerColor: "bg-department-sales-red",
      contentBgColor: "bg-card-content-sales",
      members: [],
      badgeCount: 2,
      href: "/sales/dashboard",
      isAvailable: true,
    },
    {
      id: "logistics",
      name: "Logistics/ Operations",
      headerColor: "bg-department-logistics-blue",
      contentBgColor: "bg-card-content-logistics",
      members: [],
      badgeCount: 1,
      href: "/logistics/dashboard",
      isAvailable: true,
    },
    {
      id: "creatives",
      name: "Creatives/Contents",
      headerColor: "bg-department-creatives-orange",
      contentBgColor: "bg-card-content-creatives",
      members: [],
      href: "/cms/dashboard",
      isAvailable: true,
    },
    {
      id: "accounting",
      name: "Accounting",
      headerColor: "bg-department-accounting-purple",
      contentBgColor: "bg-card-content-accounting",
      members: [],
      href: "/accounting/dashboard",
      isAvailable: true,
    },
    {
      id: "treasury",
      name: "Treasury",
      headerColor: "bg-department-treasury-green",
      contentBgColor: "bg-card-content-treasury",
      members: [],
      href: "/treasury",
      isAvailable: true,
    },
    {
      id: "it",
      name: "I.T.",
      headerColor: "bg-department-it-teal",
      contentBgColor: "bg-card-content-it",
      members: [],
      href: "/it",
      isAvailable: true,
    },
    {
      id: "fleet",
      name: "Fleet",
      headerColor: "bg-department-fleet-gray",
      contentBgColor: "bg-card-content-fleet",
      members: [],
      badgeCount: 1,
      isAvailable: false,
    },
    {
      id: "finance",
      name: "Finance",
      headerColor: "bg-department-finance-green",
      contentBgColor: "bg-card-content-finance",
      members: [],
      href: "/finance",
      isAvailable: true,
    },
    {
      id: "media",
      name: "Media/ Procurement",
      headerColor: "bg-department-media-lightblue",
      contentBgColor: "bg-card-content-media",
      members: [],
      badgeCount: 2,
      isAvailable: false,
    },
    {
      id: "businessDev",
      name: "Business Dev.",
      headerColor: "bg-department-businessdev-darkpurple",
      contentBgColor: "bg-card-content-businessdev",
      members: [],
      href: "/business/inventory",
      isAvailable: true,
    },
    {
      id: "legal",
      name: "Legal",
      headerColor: "bg-department-legal-darkred",
      contentBgColor: "bg-card-content-legal",
      members: [],
      badgeCount: 2,
      isAvailable: false,
    },
    {
      id: "corporate",
      name: "Corporate",
      headerColor: "bg-department-corporate-lightblue",
      contentBgColor: "bg-card-content-corporate",
      members: [],
      badgeCount: 1,
      isAvailable: false,
    },
    {
      id: "hr",
      name: "Human Resources",
      headerColor: "bg-department-hr-pink",
      contentBgColor: "bg-card-content-hr",
      members: [],
      badgeCount: 1,
      isAvailable: false,
    },
    {
      id: "specialTeam",
      name: "Special Team",
      headerColor: "bg-department-specialteam-lightpurple",
      contentBgColor: "bg-card-content-specialteam",
      members: [],
      isAvailable: false,
    },
    {
      id: "marketing",
      name: "Marketing",
      headerColor: "bg-department-marketing-red",
      contentBgColor: "bg-card-content-marketing",
      members: [],
      isAvailable: false,
    },
  ];

  // Filter departments based on search term
  const filteredDepartments = departmentData.filter((department) => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return (
      department.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      department.members.some((member) =>
        member.toLowerCase().includes(lowerCaseSearchTerm)
      )
    );
  });

  const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDepartments = filteredDepartments.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <RouteProtection requiredRoles="admin">
      <div className="min-h-screen bg-[#fafafa]">
        {/* Main Content */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-[#000000]">
              {userData?.first_name
                ? `${userData.first_name.charAt(0).toUpperCase()}${userData.first_name.slice(1).toLowerCase()}'s Dashboard`
                : "Dashboard"}
            </h2>
            <Button
              variant="outline"
              className="bg-[#ffffff] border-[#c4c4c4] hover:bg-[#fafafa]"
            >
              Announcements
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 mb-8 h-[600px]">
            {/* Calendar Section - spans 2 rows in column 1 */}
            <div className="lg:col-span-1 lg:row-span-2">
              <Card className="bg-[#ffffee] border-[#ffdea2] border-2 rounded-2xl h-full relative p-2">
                <CardContent className="h-full overflow-y-auto pt-2">
                  {loadingCalendar ? (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18da69]"></div>
                      <p>Loading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Today's events */}
                      <div className="flex-1 space-y-2 pb-4">
                        <h4 className="font-medium mb-2">
                          Today{" "}
                          {new Date().toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </h4>
                        {(() => {
                          const today = new Date();
                          const todayKey = today.toDateString();
                          const todayCalendarEvents = calendarEvents[todayKey] || [];
                          const todaySalesEvents = events.filter(event =>
                            event.start instanceof Date &&
                            event.start.toDateString() === todayKey
                          );
                          const todayAssignments = serviceAssignments.filter(assignment => {
                            if (!assignment.coveredDateStart) return false;
                            const date = assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart :
                              (assignment.coveredDateStart as any).toDate ? (assignment.coveredDateStart as any).toDate() :
                              new Date(assignment.coveredDateStart);
                            return date.toDateString() === todayKey;
                          });
                          const todayTodos = calendarTodos.filter(todo =>
                            todo.start_date &&
                            (todo.start_date instanceof Date ? todo.start_date.toDateString() :
                             (todo.start_date as any).toDate ? (todo.start_date as any).toDate().toDateString() :
                             new Date(todo.start_date as string).toDateString()) === todayKey
                          );
                          const todayBookings = calendarBookings.filter(booking =>
                            booking.start_date &&
                            (booking.start_date instanceof Date ? booking.start_date.toDateString() : new Date(booking.start_date.seconds * 1000).toDateString()) === todayKey
                          );

                          const allTodayItems = [
                            ...todayCalendarEvents.map(event => ({ type: 'calendar', item: event, color: event.color || '#10b981' })),
                            ...todaySalesEvents.map(event => ({ type: 'event', item: event, color: '#ff9696' })),
                            ...todayAssignments.map(assignment => ({ type: 'assignment', item: assignment, color: '#73bbff' })),
                            ...todayTodos.map(todo => ({ type: 'todo', item: todo, color: '#ffe522' })),
                            ...todayBookings.map(booking => ({ type: 'booking', item: booking, color: '#7fdb97' }))
                          ];

                          return allTodayItems.length > 0 ? (
                            allTodayItems.slice(0, 5).map((item, index) => (
                              <div
                                key={`today-${index}`}
                                className="p-2 rounded text-sm mb-1 text-black"
                                style={{
                                  backgroundColor: item.color
                                }}
                              >
                                <span className="font-medium">
                                  {getItemTitle(item.type, item.item)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-2 text-[#a1a1a1] text-xs">
                              No items for today.
                            </div>
                          );
                        })()}
                      </div>

                      {/* Tomorrow's events */}
                      <div className="flex-1 space-y-2 py-4 border-t border-[#e0e0e0]">
                        <h4 className="font-medium mb-2">
                          {(() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            return tomorrow.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                          })()}
                          ,{" "}
                          {(() => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            return tomorrow.getFullYear();
                          })()}
                        </h4>
                        {(() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          const tomorrowKey = tomorrow.toDateString();
                          const tomorrowCalendarEvents = calendarEvents[tomorrowKey] || [];
                          const tomorrowSalesEvents = events.filter(event =>
                            event.start instanceof Date &&
                            event.start.toDateString() === tomorrowKey
                          );
                          const tomorrowAssignments = serviceAssignments.filter(assignment => {
                            if (!assignment.coveredDateStart) return false;
                            const date = assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart :
                              (assignment.coveredDateStart as any).toDate ? (assignment.coveredDateStart as any).toDate() :
                              new Date(assignment.coveredDateStart);
                            return date.toDateString() === tomorrowKey;
                          });
                          const tomorrowTodos = calendarTodos.filter(todo =>
                            todo.start_date &&
                            (todo.start_date instanceof Date ? todo.start_date.toDateString() :
                             (todo.start_date as any).toDate ? (todo.start_date as any).toDate().toDateString() :
                             new Date(todo.start_date as string).toDateString()) === tomorrowKey
                          );
                          const tomorrowBookings = calendarBookings.filter(booking =>
                            booking.start_date &&
                            (booking.start_date instanceof Date ? booking.start_date.toDateString() : new Date(booking.start_date.seconds * 1000).toDateString()) === tomorrowKey
                          );

                          const allTomorrowItems = [
                            ...tomorrowCalendarEvents.map(event => ({ type: 'calendar', item: event, color: event.color || '#10b981' })),
                            ...tomorrowSalesEvents.map(event => ({ type: 'event', item: event, color: '#ff9696' })),
                            ...tomorrowAssignments.map(assignment => ({ type: 'assignment', item: assignment, color: '#73bbff' })),
                            ...tomorrowTodos.map(todo => ({ type: 'todo', item: todo, color: '#ffe522' })),
                            ...tomorrowBookings.map(booking => ({ type: 'booking', item: booking, color: '#7fdb97' }))
                          ];

                          return allTomorrowItems.length > 0 ? (
                            allTomorrowItems.slice(0, 5).map((item, index) => (
                              <div
                                key={`tomorrow-${index}`}
                                className="p-2 rounded text-sm mb-1 text-black"
                                style={{
                                  backgroundColor: item.color
                                }}
                              >
                                <span className="font-medium">
                                  {getItemTitle(item.type, item.item)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[#a1a1a1] text-center py-2">
                              No items for this day.
                            </p>
                          );
                        })()}
                      </div>

                      {/* Day after tomorrow's events */}
                      <div className="flex-1 space-y-2 pt-4">
                        <h4 className="font-medium mb-2">
                          {(() => {
                            const dayAfter = new Date();
                            dayAfter.setDate(dayAfter.getDate() + 2);
                            return dayAfter.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                          })()}
                          ,{" "}
                          {(() => {
                            const dayAfter = new Date();
                            dayAfter.setDate(dayAfter.getDate() + 2);
                            return dayAfter.getFullYear();
                          })()}
                        </h4>
                        {(() => {
                          const dayAfter = new Date();
                          dayAfter.setDate(dayAfter.getDate() + 2);
                          const dayAfterKey = dayAfter.toDateString();
                          const dayAfterCalendarEvents = calendarEvents[dayAfterKey] || [];
                          const dayAfterSalesEvents = events.filter(event =>
                            event.start instanceof Date &&
                            event.start.toDateString() === dayAfterKey
                          );
                          const dayAfterAssignments = serviceAssignments.filter(assignment => {
                            if (!assignment.coveredDateStart) return false;
                            const date = assignment.coveredDateStart instanceof Date ? assignment.coveredDateStart :
                              (assignment.coveredDateStart as any).toDate ? (assignment.coveredDateStart as any).toDate() :
                              new Date(assignment.coveredDateStart);
                            return date.toDateString() === dayAfterKey;
                          });
                          const dayAfterTodos = calendarTodos.filter(todo =>
                            todo.start_date &&
                            (todo.start_date instanceof Date ? todo.start_date.toDateString() :
                             (todo.start_date as any).toDate ? (todo.start_date as any).toDate().toDateString() :
                             new Date(todo.start_date as string).toDateString()) === dayAfterKey
                          );
                          const dayAfterBookings = calendarBookings.filter(booking =>
                            booking.start_date &&
                            (booking.start_date instanceof Date ? booking.start_date.toDateString() : new Date(booking.start_date.seconds * 1000).toDateString()) === dayAfterKey
                          );

                          const allDayAfterItems = [
                            ...dayAfterCalendarEvents.map(event => ({ type: 'calendar', item: event, color: event.color || '#10b981' })),
                            ...dayAfterSalesEvents.map(event => ({ type: 'event', item: event, color: '#ff9696' })),
                            ...dayAfterAssignments.map(assignment => ({ type: 'assignment', item: assignment, color: '#73bbff' })),
                            ...dayAfterTodos.map(todo => ({ type: 'todo', item: todo, color: '#ffe522' })),
                            ...dayAfterBookings.map(booking => ({ type: 'booking', item: booking, color: '#7fdb97' }))
                          ];

                          return allDayAfterItems.length > 0 ? (
                            allDayAfterItems.slice(0, 5).map((item, index) => (
                              <div
                                key={`dayAfter-${index}`}
                                className="p-2 rounded text-sm mb-1 text-black"
                                style={{
                                  backgroundColor: item.color
                                }}
                              >
                                <span className="font-medium">
                                  {getItemTitle(item.type, item.item)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[#a1a1a1] text-center py-2">
                              No items for this day.
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Petty Cash - Row 1, Column 2 */}
            <div className="lg:col-span-1">
              <Card className="bg-[#ffffff] shadow-sm h-full relative px-2">
                <CardHeader>
                  <CardTitle className="text-lg">Petty Cash</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[200px] relative">
                  <div className="flex flex-col items-center justify-center text-center">
                    {loadingPettyCash ? (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18da69]"></div>
                        <p>Loading...</p>
                      </div>
                    ) : (
                      <>
                        <div className={`text-3xl font-bold mb-2 flex items-center justify-center gap-2 ${isPettyCashBalanceLow ? 'text-red-600' : 'text-[#18da69]'}`}>
                          {isPettyCashBalanceLow && <AlertTriangle className="w-6 h-6 text-red-600" />}
                          <span>₱{pettyCashBalance.toLocaleString()}</span>
                        </div>
                        {isPettyCashBalanceLow && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md mb-2 text-center">
                            ⚠️ Petty cash balance is low!
                          </div>
                        )}
                        <div className="text-sm text-[#a1a1a1] text-center">
                          Cycle#: {pettyCashCycle ? pettyCashCycle.cycle_no.toString().padStart(4, '0') : "0000"}
                        </div>
                      </>
                    )}
                  </div>

                  <Button
                    className="bg-[#737fff] hover:bg-[#5a5fff] text-white absolute bottom-4 right-4"
                    onClick={() => setIsAddExpenseOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Expense
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Active Users - Row 1, Column 3 */}
            <div className="lg:col-span-1">
              <Card className="bg-[#ffffff] shadow-sm h-full px-2">
                <CardHeader>
                  <CardTitle className="text-lg">Active Users</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {userData?.company_id && (
                    <ActiveUsersGrid companyId={userData.company_id} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sales Quota Index - Row 2, Column 2 */}
            <div className="lg:col-span-1">
              <Card
                className="bg-[#ffffff] shadow-sm h-full px-2 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setIsSalesQuotaDialogOpen(true)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">Sales Quota Index</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingSalesQuota ? (
                    <div className="flex items-center justify-center h-20">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#18da69]"></div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <div className="w-full bg-[#e0e0e0] rounded-full h-3">
                          <div
                            className="bg-[#18da69] h-3 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(salesQuotaSummary?.averageAchievement || 0, 100)}%`
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-end mt-1">
                          <span className="text-sm font-medium">
                            {salesQuotaSummary?.averageAchievement || 0}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-[#a1a1a1]">
                        Sales Team Leader to set targets per sales associate.
                        Sales Quota Index here is the average of the entire Sales
                        Team. Click to view breakdown per sales associate.
                      </p>
                      {salesQuotaSummary && salesQuotaSummary.totalAssociates > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          {salesQuotaSummary.associatesOnTrack} of {salesQuotaSummary.totalAssociates} associates on track
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Occupancy Index - Row 2, Column 3 */}
            <div className="lg:col-span-1">
              <Card className="bg-[#ffffff] shadow-sm h-[300px] relative h-full px-2">
                <CardHeader>
                  <CardTitle className="text-lg">Occupancy Index</CardTitle>
                </CardHeader>
                <CardContent >
                  {loadingOccupancy ? (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#18da69]"></div>
                      <p>Loading...</p>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      {/* Occupancy Details - Left Side */}
                      <div className="flex-1">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Static BB</span>
                            <span className="font-medium">{staticCount}/{totalStatic}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>LED BB</span>
                            <span className="font-medium">{dynamicCount}/{totalDynamic}</span>
                          </div>
                        </div>
                      </div>

                      {/* Circular Progress - Right Side */}
                      <div className="flex-1 flex justify-center">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center justify-center mb-2">
                            <div className="relative w-20 h-20">
                              <svg
                                className="w-20 h-20 transform -rotate-90"
                                viewBox="0 0 36 36"
                              >
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="#e0e0e0"
                                  strokeWidth="2"
                                />
                                <path
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="#18da69"
                                  strokeWidth="2"
                                  strokeDasharray={`${occupancyPercentage}, 100`}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-bold">{occupancyPercentage}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-[#18da69]"></div>
                              <span>Occupied</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-[#c4c4c4]"></div>
                              <span>Vacant</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Service Assignments Table */}
          <Card className="bg-[#ffffff] shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Service Assignments</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#a1a1a1] w-4 h-4" />
                  <Input
                    placeholder="Search service assignments..."
                    value={serviceAssignmentsSearchTerm}
                    onChange={(e) => setServiceAssignmentsSearchTerm(e.target.value)}
                    className="pl-10 w-64 bg-[#fafafa] border-[#e0e0e0]"
                  />
                  {isSearchingServiceAssignments && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#a1a1a1]"></div>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e0e0e0]">
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        SA#
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        RV#
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        Site
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        End Date
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        Campaign Name
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        Crew
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-[#000000]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAssignments ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-4 text-[#a1a1a1]"
                        >
                          Loading service assignments...
                        </td>
                      </tr>
                    ) : serviceAssignmentsSearchTerm.trim() ? (
                      // Show search results
                      isSearchingServiceAssignments ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="text-center py-4 text-[#a1a1a1]"
                          >
                            Searching service assignments...
                          </td>
                        </tr>
                      ) : serviceAssignmentsSearchResults.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="text-center py-4 text-[#a1a1a1]"
                          >
                            No service assignments found for "{serviceAssignmentsSearchTerm}".
                          </td>
                        </tr>
                      ) : (
                        serviceAssignmentsSearchResults.map((result) => (
                          <tr
                            key={result.objectID}
                            className="border-b border-[#e0e0e0]"
                          >
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).saNumber || result.objectID}
                            </td>
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).joNumber || (result as any).projectSiteId || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).serviceType || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).projectSiteName || result.location || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).coveredDateEnd ? new Date((result as any).coveredDateEnd).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).jobDescription || result.name || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).assignedTo || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-[#000000]">
                              {(result as any).status || "N/A"}
                            </td>
                          </tr>
                        ))
                      )
                    ) : serviceAssignments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-4 text-[#a1a1a1]"
                        >
                          No service assignments found.
                        </td>
                      </tr>
                    ) : (
                      paginatedServiceAssignments.map((assignment) => (
                        <tr
                          key={assignment.id}
                          className="border-b border-[#e0e0e0]"
                        >
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment.saNumber}
                          </td>
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment.joNumber || assignment.projectSiteId}
                          </td>
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment.serviceType}
                          </td>
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment.projectSiteName}
                          </td>
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment?.coveredDateEnd
                              ? new Date(assignment.coveredDateEnd).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment.jobDescription}
                          </td>
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment.assignedTo}
                          </td>
                          <td className="py-3 px-4 text-[#000000]">
                            {assignment.status}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={serviceAssignmentsCurrentPage}
                itemsPerPage={serviceAssignmentsItemsPerPage}
                totalItems={serviceAssignmentsTotalItems}
                totalOverall={serviceAssignmentsTotalOverall}
                onNextPage={handleServiceAssignmentsNextPage}
                onPreviousPage={handleServiceAssignmentsPreviousPage}
                hasMore={serviceAssignmentsHasMore}
              />
            </CardContent>
          </Card>
        </div>

        {/* Registration Success Dialog */}
        <RegistrationSuccessDialog
          isOpen={showSuccessDialog}
          firstName={userData?.first_name || ""} // Pass the user's first name
          onClose={handleCloseSuccessDialog}
        />

        <AddExpenseDialog
          isOpen={isAddExpenseOpen}
          onClose={() => setIsAddExpenseOpen(false)}
          onSubmit={handleAddExpense}
        />

        <SalesQuotaBreakdownDialog
          isOpen={isSalesQuotaDialogOpen}
          onClose={() => setIsSalesQuotaDialogOpen(false)}
          companyId={userData?.company_id || ""}
          month={new Date().getMonth() + 1}
          year={new Date().getFullYear()}
        />

        <EventDetailsDialog
          isOpen={eventDetailsDialogOpen}
          onClose={() => setEventDetailsDialogOpen(false)}
          event={selectedEventForDetails}
        />
      </div>
    </RouteProtection>
  );
}
