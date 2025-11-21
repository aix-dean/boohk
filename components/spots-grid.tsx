import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { Booking } from "oh-db-models";
import {
  createCMSContentDeployment,
  checkPlayerOnlineStatus,
} from "@/lib/cms-api";
import { useToast } from "@/hooks/use-toast";
import { BookingCongratulationsDialog } from "@/components/BookingCongratulationsDialog";
import { SpotContentDialog } from "@/components/SpotContentDialog";
import { NewBookingDialog } from "@/components/NewBookingDialog";
import { BookingSpotSelectionDialog } from "@/components/BookingSpotSelectionDialog";
import { OperatorProgramContentDialog } from "@/components/OperatorProgramContentDialog";
import { MediaPlayer } from "./MediaPlayer";

interface Spot {
  id: string;
  number: number;
  status: "occupied" | "vacant";
  clientName?: string;
  imageUrl?: string;
  endDate?: Date;
  booking_id?: string;
}

interface Page {
  spot_number: number;
  schedules?: any[];
  widgets?: any[];
}

interface SpotsGridProps {
   spots: Spot[];
   totalSpots: number;
   occupiedCount: number;
   vacantCount: number;
   productId?: string;
   currentDate: string;
   router?: any;
   selectedSpots?: number[];
   onSpotToggle?: (spotNumber: number) => void;
   showSummary?: boolean;
   bg?: boolean;
   bookingRequests?: Booking[];
   onBookingAccepted?: () => void;
   disableBookingActions?: boolean;
   disableEmptySpotClicks?: boolean;
 }

export function SpotsGrid({
    spots,
    totalSpots,
    occupiedCount,
    vacantCount,
    productId,
    currentDate,
    router,
    selectedSpots,
    onSpotToggle,
    showSummary = true,
    bg = true,
    bookingRequests = [],
    onBookingAccepted,
    disableBookingActions = false,
    disableEmptySpotClicks = false,
  }: SpotsGridProps) {
   const { userData } = useAuth();
   const { toast } = useToast();
   const pathname = usePathname();
   const isBusinessInventory = pathname.includes("business/inventory");
   const effectiveDisableBookingActions = disableBookingActions || isBusinessInventory;
   const effectiveDisableEmptySpotClicks = disableEmptySpotClicks || isBusinessInventory;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeclineConfirmDialogOpen, setIsDeclineConfirmDialogOpen] =
    useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isBookingCongratulationsOpen, setIsBookingCongratulationsOpen] =
    useState(false);
  const [congratulationsBooking, setCongratulationsBooking] =
    useState<Booking | null>(null);
  const [isDeclineReasonDialogOpen, setIsDeclineReasonDialogOpen] =
    useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isThankYouDialogOpen, setIsThankYouDialogOpen] = useState(false);
  const [isSpotDialogOpen, setIsSpotDialogOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [hoveredSpots, setHoveredSpots] = useState<Record<number, boolean>>({});
  const [retailSpotNumbers, setRetailSpotNumbers] = useState<number[]>([]);
  const [takenSpotNumbers, setTakenSpotNumbers] = useState<number[]>([]);
  const [isOfflineDialogOpen, setIsOfflineDialogOpen] = useState(false);
  const [selectedSpotNumber, setSelectedSpotNumber] = useState<
    number | undefined
  >(undefined);
  const [isSpotSelectionOpen, setIsSpotSelectionOpen] = useState(false);
  const filteredBookings = bookingRequests.filter(
    (booking) => booking.for_screening === 0
  );
  const [playerStatus, setPlayerStatus] = useState<boolean>(); // playerId -> online status
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [playerOnline, setPlayerOnline] = useState<boolean | null>(null);
  const [activePages, setActivePages] = useState<Page[]>([]);
  const [isOperatorDialogOpen, setIsOperatorDialogOpen] = useState(false);
  const [selectedOperatorSpot, setSelectedOperatorSpot] = useState<Spot | null>(
    null
  );
  const [isCheckingOperatorPlayer, setIsCheckingOperatorPlayer] =
    useState(false);
  const [operatorPlayerOnline, setOperatorPlayerOnline] = useState<
    boolean | null
  >(null);

  // Add local state for spots to allow mutations
  const [localSpots, setLocalSpots] = useState<Spot[]>(spots);

  // Sync localSpots with props.spots when it changes
  useEffect(() => {
    setLocalSpots(spots);
  }, [spots]);

  // Update imageUrl for operator spots when activePages changes
  useEffect(() => {
    setLocalSpots((prevSpots) =>
      prevSpots.map((spot) => {
        if (!retailSpotNumbers.includes(spot.number)) {
          // For operator spots, find matching page in activePages
          const matchingPage = activePages.find(
            (page) => page.spot_number === spot.number
          );
          const newImageUrl = matchingPage?.widgets?.[0]?.url || null;
          return { ...spot, imageUrl: newImageUrl };
        }
        return spot; // Retail spots unchanged
      })
    );
  }, [activePages, retailSpotNumbers]);

  useEffect(() => {
    if (!productId) return;

    let unsubscribe: (() => void) | null = null;

    const setupListener = async () => {
      try {
        // Fetch product
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) return;

        const product = productSnap.data();
        setPlayerIds(product.playerIds || []);
        setRetailSpotNumbers(product.retail_spot?.spot_number || []);

        // Set up real-time listener for playlists
        unsubscribe = onSnapshot(
          query(
            collection(db, "playlist"),
            where("product_id", "==", productId),
            orderBy("created", "desc"),
            limit(1)
          ),
          (snapshot) => {
            if (!snapshot.empty) {
              const latestPlaylist = snapshot.docs[0].data();
              const existingPages = latestPlaylist.pages || [];

              // Filter out expired pages (where any schedule has endDate in the past)
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const activePagesTemp = existingPages.filter((page: any) =>
                page.schedules?.every((schedule: any) => {
                  let scheduleEndDate = schedule.endDate?.toDate
                    ? schedule.endDate.toDate()
                    : new Date(schedule.endDate);
                  scheduleEndDate.setHours(0, 0, 0, 0);
                  return scheduleEndDate >= today;
                })
              );
              setActivePages(activePagesTemp);
              // Extract taken spot numbers
              setTakenSpotNumbers(
                activePagesTemp.map((page: Page) => page.spot_number)
              );

              // Map spot numbers to image URLs
              const urls: Record<number, string> = {};
              activePagesTemp.forEach((page: Page) => {
                if (
                  page.spot_number &&
                  page.widgets &&
                  page.widgets.length > 0
                ) {
                  // Assume first widget has the url
                  const widget = page.widgets[0];
                  if (widget.url) {
                    urls[page.spot_number] = widget.url;
                  }
                }
              });
            } else {
              setActivePages([]);
              setTakenSpotNumbers([]);
            }
          }
        );
      } catch (error) {
        console.error("Error setting up listener:", error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [productId]);

  const handleSpotClick = (spotNumber: number) => {
    const spot = localSpots.find((s) => s.number === spotNumber);
    if (spot) {
      if (retailSpotNumbers.includes(spot.number)) {
        setSelectedSpot(spot);
        setIsSpotDialogOpen(true);
      } else {
        setSelectedOperatorSpot(spot);
        setIsOperatorDialogOpen(true);
      }
    }
  };

  const handleAcceptBooking = async (spotNumber: number) => {
    if (!selectedBooking) return;

    try {
      // Generate airing_code
      const airing_code = "BH" + Date.now();

      // Update booking to set for_screening = 2 (accepted), status to ongoing, and airing_code
      await updateDoc(doc(db, "booking", selectedBooking.id), {
        for_screening: 2,
        status: "ONGOING",
        airing_code,
        updated: new Date(),
      });

      // Update selectedBooking with airing_code for the dialog
      selectedBooking.airing_code = airing_code;

      toast({
        title: "Booking accepted",
        description: "The booking has been accepted and is now for screening.",
      });

      // Open congratulations dialog
      setCongratulationsBooking(selectedBooking);
      setIsBookingCongratulationsOpen(true);

      // Fetch product data for CMS API
      const productRef = doc(db, "products", productId!);
      const productSnap = await getDoc(productRef);
      const product: any = productSnap.exists()
        ? { id: productSnap.id, ...productSnap.data() }
        : null;

      if (product) {
        // Query the latest playlist for this product and playerIds
        const playlistQuery = query(
          collection(db, "playlist"),
          where("product_id", "==", product.id),
          where("playerIds", "==", product.playerIds),
          orderBy("created", "desc"),
          limit(1)
        );
        const playlistSnap = await getDocs(playlistQuery);
        let existingPages = [];
        if (!playlistSnap.empty) {
          const latestPlaylist = playlistSnap.docs[0].data();
          existingPages = latestPlaylist.pages || [];
        }

        // Filter out expired pages (where any schedule has endDate in the past)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today
        const activePages = existingPages.filter((page: any) =>
          page.schedules?.every((schedule: any) => {
            let scheduleEndDate = schedule.endDate?.toDate
              ? schedule.endDate.toDate()
              : new Date(schedule.endDate);
            scheduleEndDate.setHours(0, 0, 0, 0); // Set to start of that day
            return scheduleEndDate >= today;
          })
        );

        // Calculate the maximum spot_number from active pages
        let maxSpotNumber = 0;
        activePages.forEach((page: Page) => {
          if (page.spot_number && page.spot_number > maxSpotNumber)
            maxSpotNumber = page.spot_number;
        });

        // Call CMS API with booking and product data
        // Construct basic parameters - this may need adjustment based on actual CMS requirements
        const duration = product.cms.spot_duration * 1000 || 9000; // in milliseconds
        const schedules = {
          startDate: (() => {
            const date = selectedBooking.start_date?.toDate?.();
            return date
              ? date
                  .toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })
                  .replace(/\//g, "-")
              : new Date()
                  .toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })
                  .replace(/\//g, "-");
          })(),
          endDate: (() => {
            const date = selectedBooking.end_date?.toDate?.();
            return date
              ? date
                  .toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })
                  .replace(/\//g, "-")
              : new Date()
                  .toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" })
                  .replace(/\//g, "-");
          })(),

          plans: [
            {
              weekDays: [0, 1, 2, 3, 4, 5, 6], // All days
              startTime: product.cms.start_time || "00:00",
              endTime: product.cms.end_time || "23:59",
            },
          ],
        };
        const schedule = {
          startDate: "2020-04-11",
          endDate: "2060-05-12",
          plans: [
            {
              weekDays: [0, 1, 2, 3, 4, 5, 6], // All days
              startTime: product.cms.start_time || "00:00",
              endTime: product.cms.end_time || "23:59",
            },
          ],
        };
        // Get file size and MD5 before creating playlist
        let fileInfo: any = { size: 12000, md5: "placeholder-md5" };
        if (selectedBooking.url) {
          try {
            const response = await fetch("/api/file-info", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: selectedBooking.url }),
            });
            if (response.ok) {
              fileInfo = await response.json();
            }
          } catch (error) {
            console.error("Error getting file info:", error);
          }
        }

        const pages = selectedBooking.url
          ? [
              {
                name: `booking-${selectedBooking.id}-page`,
                widgets: [
                  {
                    zIndex: 1,
                    type: "VIDEO",
                    size: fileInfo.size,
                    md5: fileInfo.md5,
                    duration: duration,
                    url: selectedBooking.url,
                    layout: {
                      x: "0%",
                      y: "0%",
                      width: "100%",
                      height: "100%",
                    },
                  },
                ],
              },
            ]
          : [];

        // Create new pages with full properties
        const newBookingPages = pages.map((page, index) => ({
          ...page,
          schedules: [schedules],
          client_id: selectedBooking.client?.id || '',
          client_name: selectedBooking.client?.name || 'Unknown Client',
          acceptByUid: userData?.uid,
          acceptBy: `${userData?.first_name || ""} ${userData?.last_name || ""}`,
          booking_id: selectedBooking.id,
          spot_number: spotNumber,
        }));

        // Combine active existing pages with new booking pages
        const allPages = [...activePages, ...newBookingPages];

        // Create playlist document for specific product
        if (product.id) {
          const playlistDoc = {
            playerIds: product.playerIds,
            product_id: product.id,
            company_id: product.company_id,
            created: serverTimestamp(),
            pages: allPages,
          };
          await addDoc(collection(db, "playlist"), playlistDoc);

          // Sort playlist pages by spot_number ascending before CMS deployment
          playlistDoc.pages.sort(
            (a, b) => (a.spot_number || 0) - (b.spot_number || 0)
          );

          // Update activePages and takenSpotNumbers immediately for real-time UI update
          setActivePages((prev) => [...prev, ...newBookingPages]);
          setTakenSpotNumbers((prev) => [...prev, spotNumber]);

          console.log("Player is online, proceeding with CMS deployment");
          const playerIds = product.playerIds || [];
          // Check if player is online before CMS deployment

          console.log("Player is online, cannot deploy CMS content.");
          // Prepare pages for CMS (only name and widgets)
          const cmsPages = playlistDoc.pages.map((page) => ({
            name: page.name,
            schedules: page.schedules,
            widgets: page.widgets,
          }));

          await createCMSContentDeployment(playerIds, schedule, cmsPages);
        }
      }

      // Close dialog and refresh
      setIsDialogOpen(false);
      setSelectedBooking(null);
      setSelectedSpotNumber(undefined);
      onBookingAccepted?.();
    } catch (error) {
      console.error("Error accepting booking:", error);
      toast({
        title: "Error",
        description: "Failed to accept the booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineBooking = async () => {
    if (!selectedBooking) return;

    setIsDeclining(true);
    try {
      await updateDoc(doc(db, "booking", selectedBooking.id), {
        for_screening: 3,
        updated: new Date(),
      });

      toast({
        title: "Booking rejected",
        description: "The booking has been rejected.",
      });

      setIsDialogOpen(false);
      setSelectedBooking(null);
      onBookingAccepted?.();
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast({
        title: "Error",
        description: "Failed to reject the booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeclining(false);
    }
  };
  const formatBookingDates = (startDate: any, endDate: any): string => {
    if (!startDate || !endDate) return "N/A";
    try {
      const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
      const end = endDate.toDate ? endDate.toDate() : new Date(endDate);

      const startMonth = start.toLocaleDateString("en-US", { month: "short" });
      const startDay = start.getDate();
      const startYear = start.getFullYear();

      const endMonth = end.toLocaleDateString("en-US", { month: "short" });
      const endDay = end.getDate();
      const endYear = end.getFullYear();

      // If dates are the same, return single date
      if (start.getTime() === end.getTime()) {
        return `${startMonth} ${startDay} ${startYear}`;
      }

      // If same month and year, return "Nov 12 - 20 2020"
      if (startMonth === endMonth && startYear === endYear) {
        return `${startMonth} ${startDay} - ${endDay} ${startYear}`;
      }

      // Different months/years, return full range
      return `${startMonth} ${startDay} - ${endMonth} ${endDay} ${endYear}`;
    } catch (error) {
      console.error("Error formatting booking dates:", error);
      return "Invalid Dates";
    }
  };

  const handleSubmit = async () => {
    if (!selectedBooking) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "booking_declined"), {
        bookingId: selectedBooking.id,
        selectedReasons,
        otherReason,
        declinedAt: serverTimestamp(),
        clientId: selectedBooking.client?.id || '',
        clientName: selectedBooking.client?.name || 'Unknown Client',
        startDate: selectedBooking.start_date,
        endDate: selectedBooking.end_date,
        totalCost: selectedBooking.total_cost || selectedBooking.cost,
        productName:
          selectedBooking.product_name || selectedBooking.project_name,
      });
      await handleDeclineBooking();
      setIsDeclineReasonDialogOpen(false);
      setIsThankYouDialogOpen(true);
      setSelectedReasons([]);
      setOtherReason("");
    } catch (error) {
      console.error("Error declining booking:", error);
      toast({
        title: "Error",
        description: "Failed to decline booking.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const spotsContent = (
    <div className="flex gap-[13.758px] overflow-x-scroll pb-4 w-full pr-4">
      {localSpots.map((spot) => {
        const isClickable = spot.imageUrl || !effectiveDisableEmptySpotClicks;
        return (
          <div
            key={spot.id}
            className={`relative flex-shrink-0 w-[110px] h-[197px] bg-white p-1.5 rounded-[14px]  shadow-[-1px_3px_7px_-1px_rgba(0,0,0,0.25)] ${retailSpotNumbers.includes(spot.number) ? "border-4 border-[#737fff]" : "border border-gray-200"} overflow-hidden ${isClickable ? "cursor-pointer hover:shadow-lg" : ""} transition-shadow flex flex-col`}
            onClick={
              isClickable
                ? () => {
                    if (retailSpotNumbers.includes(spot.number)) {
                      setSelectedSpot(spot);
                      setIsSpotDialogOpen(true);
                    } else {
                      if (spot.imageUrl) {
                        // For viewing existing content, always open but check player for edit
                        setIsCheckingOperatorPlayer(true);
                        checkPlayerOnlineStatus(playerIds)
                          .then((status) => {
                            setOperatorPlayerOnline(status);
                            setSelectedOperatorSpot(spot);
                            setIsOperatorDialogOpen(true);
                            setIsCheckingOperatorPlayer(false);
                          })
                          .catch(() => {
                            setOperatorPlayerOnline(false);
                            setSelectedOperatorSpot(spot);
                            setIsOperatorDialogOpen(true);
                            setIsCheckingOperatorPlayer(false);
                          });
                      } else if (!disableEmptySpotClicks) {
                        // For creating new content, check player first (only if empty spots are clickable)
                        setIsCheckingOperatorPlayer(true);
                        checkPlayerOnlineStatus(playerIds)
                          .then((status) => {
                            if (!status) {
                              setIsOfflineDialogOpen(true);
                            } else {
                              setSelectedOperatorSpot(spot);
                              setIsOperatorDialogOpen(true);
                            }
                            setIsCheckingOperatorPlayer(false);
                          })
                          .catch(() => {
                            setIsOfflineDialogOpen(true);
                            setIsCheckingOperatorPlayer(false);
                          });
                      }
                    }
                  }
                : undefined
            }
          >
            {/* Image Section */}
            <div className="flex-1 relative rounded-[10px] bg-white flex justify-center overflow-hidden">
              {(() => {
                return spot.imageUrl ? (
                  <>
                    <MediaPlayer
                      url={spot.imageUrl}
                      className="w-full h-full object-cover rounded-[10px]"
                      controls={false}
                      playing={hoveredSpots[spot.number] || false}
                    />
                  </>
                ) : (
                  <div className="w-full h-full rounded-[10px] bg-gray-300"></div>
                );
              })()}
              {retailSpotNumbers.includes(spot.number) ? (
                <div></div>
              ) : (
                <div className="w-full bg-[#333] text-white text-xs absolute bottom-0 text-center py-0.5 rounded-md opacity-80">
                  Operator's Program
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="flex flex-col p-1 bg-white">
              {/* Spot Number */}
              <div className="text-[11px] font-semibold text-black">
                {spot.number}/{totalSpots}
              </div>

              {/* Status */}
              <div
                className={`text-[11px] font-semibold ${
                  spot.status === "occupied"
                    ? "text-[#00d0ff]"
                    : "text-[#a1a1a1]"
                }`}
              >
                {spot.status === "occupied" ? "Occupied" : "Vacant"}
              </div>

              {/* Client Name */}
              <div
                className={`text-[11px] truncate ${
                  spot.status === "occupied" ? "text-black" : "text-[#a1a1a1]"
                }`}
              >
                {`${
                  spot.endDate
                    ? `Till ${spot.endDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : "-"
                }` || "-"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (bg) {
    return (
      <div className="space-y-4">
        {filteredBookings.length > 0 && (
          <>
            <div
              style={{
                color: "#333",
                fontFamily: "Inter",
                fontSize: "12px",
                fontWeight: "700",
                lineHeight: "100%",
              }}
            >
              Booking Requests ({filteredBookings.length})
            </div>
            {/* Booking Requests Cards */}
            <div className="mb-4 overflow-x-auto">
              <div className="flex space-x-4 pb-2">
                {filteredBookings.map((booking) => {
                  return (
                    <div
                      key={booking.id}
                      className={`relative w-[245px] h-[76px] flex-shrink-0 rounded-[7.911px] border-[2.373px] border-[#B8D9FF] bg-[#F6F9FF] flex items-center cursor-pointer }`}
                      onClick={() => {
                        setSelectedBooking(booking);
                        setIsAccepting(true);
                        checkPlayerOnlineStatus(playerIds)
                          .then((status) => {
                            setPlayerOnline(status);
                            if (!status) {
                              setIsOfflineDialogOpen(true);
                              setIsAccepting(false);
                            }
                            setIsAccepting(false);
                          })
                          .catch(() => {
                            setPlayerOnline(false);
                          });
                        setIsDialogOpen(true);
                      }}
                    >
                      <div className="flex items-start gap-3 p-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M9 7V15L16 11L9 7ZM21 3H3C1.9 3 1 3.9 1 5V17C1 18.1 1.9 19 3 19H8V21H16V19H21C22.1 19 23 18.1 23 17V5C23 3.9 22.1 3 21 3ZM21 17H3V5H21V17Z"
                            fill="#333333"
                          />
                        </svg>
                        <div className="flex flex-col">
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              lineHeight: "132%",
                              color: "#333",
                              fontFamily: "Inter",
                            }}
                          >
                            {booking.reservation_id || booking.id.slice(-8)}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 400,
                              lineHeight: "132%",
                              color: "#333",
                              fontFamily: "Inter",
                            }}
                          >
                            {formatBookingDates(
                              booking.start_date,
                              booking.end_date
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              lineHeight: "132%",
                              color: "#333",
                              fontFamily: "Inter",
                            }}
                          >
                            {booking.transaction?.amount.toLocaleString(
                              "en-PH",
                              {
                                style: "currency",
                                currency: "PHP",
                              }
                            ) || "0"}
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="8" cy="2" r="1.5" fill="#333333" />
                          <circle cx="8" cy="8" r="1.5" fill="#333333" />
                          <circle cx="8" cy="14" r="1.5" fill="#333333" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
        <div
          style={{
            color: "#333",
            fontFamily: "Inter",
            fontSize: "12px",
            fontWeight: "700",
            lineHeight: "100%",
          }}
        >
          Site spots
        </div>
        {/* Spots Grid */}
        <div className="bg-[#ECECEC] rounded-[13.8px] p-4">
          {showSummary && (
            <div className="flex items-center justify-between text-sm mb-4">
              <div className="flex items-center gap-8">
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">
                    Total Spots:
                  </span>
                  <span className="text-gray-700">{totalSpots}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">
                    Total Occupied:
                  </span>
                  <span className="text-gray-700 font-medium">
                    {occupiedCount} (
                    {Math.round((occupiedCount / totalSpots) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">
                    Total Vacant:
                  </span>
                  <span className="font-bold text-gray-700">
                    {vacantCount} (
                    {Math.round((vacantCount / totalSpots) * 100)}%)
                  </span>
                </div>
              </div>
              <span
                onClick={() =>
                  router?.push(`/sales/products/${productId}/spots/1`)
                }
                className="text-gray-700 cursor-pointer"
              >
                as of {currentDate} {"->"}
              </span>
            </div>
          )}
          {spotsContent}
        </div>

        <NewBookingDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            booking={selectedBooking as any}
            playerOnline={playerOnline}
            isAccepting={isAccepting}
            onReject={() => {
              setIsDialogOpen(false);
              setIsDeclineConfirmDialogOpen(true);
            }}
            onAccept={() => {
              setIsDialogOpen(false);
              setIsConfirmDialogOpen(true);
            }}
            takenSpotNumbers={takenSpotNumbers}
            retailSpotNumbers={retailSpotNumbers}
            totalSpots={totalSpots}
            activePages={activePages}
            disabled={effectiveDisableBookingActions}
          />
        <BookingSpotSelectionDialog
           open={isSpotSelectionOpen}
           onOpenChange={setIsSpotSelectionOpen}
           retailSpotNumbers={retailSpotNumbers}
           totalSpots={totalSpots}
           takenSpotNumbers={takenSpotNumbers}
           activePages={activePages}
           booking={selectedBooking as any}
           onSpotSelect={(spotNumber) => {
             handleAcceptBooking(spotNumber);
             setIsSpotSelectionOpen(false);
           }}
         />
        <Dialog
          open={isConfirmDialogOpen}
          onOpenChange={setIsConfirmDialogOpen}
        >
          <DialogContent className="w-[283px] h-[153px] p-1">
            <DialogHeader className="relative p-0">
              <DialogTitle></DialogTitle>
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-2 ">
              <Image
                src="/check_outline.svg"
                alt="Check"
                width={32}
                height={32}
              />
              <p className="text-sm text-center">
                Are you sure you want to accept?
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                  setIsDialogOpen(true);
                }}
                className="w-[129px] h-[28px] rounded-[5.992px] border-[1.198px] border-[#C4C4C4] bg-[#FFF]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                  setIsSpotSelectionOpen(true);
                }}
                className="w-[115px] h-[28px] rounded-[5.992px] bg-[#1D0BEB]"
              >
                Yes, proceed
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isDeclineConfirmDialogOpen}
          onOpenChange={setIsDeclineConfirmDialogOpen}
        >
          <DialogContent className="w-[283px] h-[153px] p-1">
            <DialogHeader className="relative p-0">
              <DialogTitle></DialogTitle>
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center space-y-2 ">
              <Image
                src="/cancel_outline.svg"
                alt="Cancel"
                width={32}
                height={32}
              />
              <p className="text-sm text-center">
                Are you sure you want to reject?
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeclineConfirmDialogOpen(false);
                  setIsDialogOpen(true);
                }}
                className="w-[129px] h-[28px] rounded-[5.992px] border-[1.198px] border-[#C4C4C4] bg-[#FFF]"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsDeclineConfirmDialogOpen(false);
                  setIsDeclineReasonDialogOpen(true);
                }}
                className="w-[115px] h-[28px] rounded-[5.992px] bg-[#1D0BEB]"
              >
                Yes, proceed
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isDeclineReasonDialogOpen}
          onOpenChange={(open) => {
            setIsDeclineReasonDialogOpen(open);
            if (!open) {
              setSelectedReasons([]);
              setOtherReason("");
            }
          }}
        >
          <DialogContent
            style={{ width: "369px", height: "460px", flexShrink: 0 }}
            className="p-6"
          >
            <DialogHeader className="relative">
              <DialogTitle></DialogTitle>
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              <Image
                src="/boohk-logo.png"
                alt="boohk logo"
                width={40.984}
                height={51.228}
              />
              <h1 className="text-lg font-semibold text-center">
                Booking declined.
              </h1>
              <p
                style={{
                  color: "#333",
                  textAlign: "center",
                  fontFamily: "Inter",
                  fontSize: "12px",
                  fontWeight: 400,
                  lineHeight: "114%",
                }}
              >
                To help us understand and improve future requests, would you
                mind selecting a reason?
              </p>
              <div className="w-full space-y-2">
                {[
                  "Timing doesn't work",
                  "Creative not a good fit",
                  "Screen unavailable or under maintenance",
                  "Double booking or scheduling conflict",
                  "Other",
                ].map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <Checkbox
                      className="border-[#333333]"
                      checked={selectedReasons.includes(reason)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedReasons((prev) => [...prev, reason]);
                          setOtherReason((prev) => {
                            if (prev.includes(reason + ". ")) return prev;
                            return (
                              prev +
                              (prev && !prev.endsWith(" ") ? " " : "") +
                              reason +
                              ". "
                            );
                          });
                        } else {
                          setSelectedReasons((prev) =>
                            prev.filter((r) => r !== reason)
                          );
                          setOtherReason((prev) =>
                            prev.replace(new RegExp(reason + "\\. ", "g"), "")
                          );
                        }
                      }}
                    />
                    <label
                      style={{
                        color: "#333",
                        textAlign: "center",
                        fontFamily: "Inter",
                        fontSize: "12px",
                        fontWeight: 400,
                        lineHeight: "114%",
                      }}
                    >
                      {reason}
                    </label>
                  </div>
                ))}
              </div>
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                maxLength={150}
                placeholder="150 words"
                className="w-full h-20 p-2 border rounded resize-none"
                style={{
                  color: "#333",
                  fontFamily: "Inter",
                  fontSize: "12px",
                  fontWeight: 400,
                  lineHeight: "114%",
                }}
              />
            </div>
            <DialogFooter className="justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-[90px] h-[24px] rounded-[6.024px] bg-[#1D0BEB]"
                style={{
                  color: "#FFF",
                  textAlign: "center",
                  fontFamily: "Inter",
                  fontSize: "12px",
                  fontWeight: 700,
                  lineHeight: "12px",
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-1 h-4 w-4" />
                    Sending...
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isThankYouDialogOpen}
          onOpenChange={setIsThankYouDialogOpen}
        >
          <DialogContent
            style={{ width: "382px", height: "259px" }}
            className="p-6"
          >
            <DialogHeader className="relative">
              <DialogTitle></DialogTitle>
              <DialogClose className="absolute top-2 right-2">
                <X width="16" height="16" />
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              <Image
                src="/boohk-logo.png"
                alt="boohk logo"
                width={40.984}
                height={51.228}
                style={{ imageRendering: "pixelated" }}
              />
              <h1
                style={{
                  color: "#333",
                  textAlign: "center",
                  fontFamily: "Inter",
                  fontSize: "22px",
                  fontWeight: 700,
                  lineHeight: "100%",
                }}
              >
                Thank you!
              </h1>
              <p
                style={{
                  color: "#333",
                  textAlign: "center",
                  fontFamily: "Inter",
                  fontSize: "12px",
                  fontWeight: 400,
                  lineHeight: "114%",
                }}
              >
                You’ve chosen not to accept this campaign at this time. No
                worries! Your screen remains available for future opportunities.
                We’ll keep you posted when new requests come in.
              </p>
            </div>
            <DialogFooter className="justify-end">
              <Button
                onClick={() => setIsThankYouDialogOpen(false)}
                className="w-[90px] h-[24px] rounded-[6.024px] bg-[#1D0BEB]"
                style={{
                  color: "#FFF",
                  textAlign: "center",
                  fontFamily: "Inter",
                  fontSize: "12px",
                  fontWeight: 700,
                  lineHeight: "12px",
                }}
              >
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {congratulationsBooking && (
          <BookingCongratulationsDialog
            open={isBookingCongratulationsOpen}
            onOpenChange={(open) => {
              setIsBookingCongratulationsOpen(open);
              if (!open) {
                setCongratulationsBooking(null);
              }
            }}
            booking={congratulationsBooking}
          />
        )}
        <SpotContentDialog
          open={isSpotDialogOpen}
          onOpenChange={setIsSpotDialogOpen}
          spot={selectedSpot}
        />
        <OperatorProgramContentDialog
          open={isOperatorDialogOpen}
          onOpenChange={setIsOperatorDialogOpen}
          spot={selectedOperatorSpot}
          productId={productId}
          activePages={activePages}
          playerOnline={operatorPlayerOnline ?? true}
        />
        <Dialog
          open={isOfflineDialogOpen}
          onOpenChange={setIsOfflineDialogOpen}
        >
          <DialogContent className="sm:max-w-xs">
            <DialogHeader className="flex flex-col items-center p-4 pb-2 text-center">
              {/* ⚠️ Use a more modern/standard icon for the warning */}
              <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />

              <DialogTitle className="text-lg font-semibold">
                Device Offline
              </DialogTitle>

              <DialogDescription className="text-sm text-gray-500 mt-2 text-center">
                The LED is not online. Please check the device connection.
              </DialogDescription>

              {/* You can remove the DialogClose here and rely on the escape key or the final button */}
            </DialogHeader>

            {/* Optional Footer for standard button placement */}
            <DialogFooter className="flex justify-center item-center">
              <button
                onClick={() => setIsOfflineDialogOpen(false)}
                // Use a variant that matches your theme primary color (e.g., 'default' or 'primary')
                // Ensure the button is easily visible and clickable.
                className="w-full max-w-[120px] items-center bg-blue-600 rounded-md px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex justify-center"
              >
                OK, Got It
              </button>
            </DialogFooter>

            {/* Optional close button if needed, but often placed outside the footer/header for standard dialogs */}
            <DialogClose className="absolute top-3 right-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    );
  } else {
    return spotsContent;
  }
}
