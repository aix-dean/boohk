import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ArrowUpFromLine, Loader2 } from "lucide-react";
import { MediaLibraryDialog } from "@/components/MediaLibraryDialog";
import { useAuth } from "@/contexts/auth-context";
import { Media } from "oh-db-models";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { createCMSContentDeployment } from "@/lib/cms-api";
import { useToast } from "@/hooks/use-toast";
import { uploadMediaFile, createMediaLibrary } from "@/lib/firebase-service";


interface Spot {
  id: string;
  number: number;
  status: "occupied" | "vacant";
  clientName?: string;
  imageUrl?: string;
  booking_id?: string;
}

interface Page {
  spot_number: number;
  schedules?: any[];
  widgets?: any[];
}

interface OperatorProgramContentDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   spot: Spot | null;
   productId?: string;
   activePages: Page[];
   playerOnline?: boolean;
   disabled?: boolean;
 }

export function OperatorProgramContentDialog({
   open,
   onOpenChange,
   spot,
   productId,
   activePages,
   playerOnline = true,
   disabled = false,
 }: OperatorProgramContentDialogProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const [scaledWidth, setScaledWidth] = useState<number | undefined>(undefined);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(
    undefined
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProductSpecs = async () => {
      if (!productId) return;

      try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const product = productSnap.data();
          const originalWidth = product.specs_rental?.width;
          const originalHeight = product.specs_rental?.height;
          if (originalWidth && originalHeight) {
            const availableWidth = 450;
            const availableHeight = 300;
            const scale = Math.min(
              availableWidth / originalWidth,
              availableHeight / originalHeight
            );
            setScaledWidth(Math.floor(originalWidth * scale));
            setScaledHeight(Math.floor(originalHeight * scale));
          }
        }
      } catch (error) {
        console.error("Error fetching product specs:", error);
      }
    };

    fetchProductSpecs();
  }, [productId]);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreviewUrl(url);
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    } else {
      setVideoPreviewUrl(null);
    }
  }, [videoFile]);

  useEffect(() => {
    if (spot) {
      const page = activePages.find((p) => p.spot_number === spot.number);
      const schedules = page?.schedules || [];
      if (schedules.length > 0) {
        const schedule = schedules[0];
        setStartDate(schedule.startDate || "");
        setEndDate(schedule.endDate || "");
      } else {
        setStartDate("");
        setEndDate("");
      }
      // Set edit mode: true if no content (creating), false if content exists (viewing)
      // Only allow edit mode in logistics
      setIsEditMode(!spot.imageUrl && pathname.includes('/logistics/'));
    }
  }, [spot, activePages]);

  const handleSave = async () => {
    if (!productId || !userData?.company_id || !spot) {
      toast({
        title: "Error",
        description: "Missing product, company, or spot information.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Get product data for player IDs
      const productRef = doc(db, "products", productId);
      const productSnap = await getDocs(
        query(collection(db, "products"), where("__name__", "==", productId))
      );
      const product = productSnap.docs[0]?.data();

      if (!product) {
        toast({
          title: "Error",
          description: "Product not found.",
          variant: "destructive",
        });
        return;
      }

      // Query existing playlists for this product
      const playlistQuery = query(
        collection(db, "playlist"),
        where("product_id", "==", productId),
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

      // Create schedule for the operator program
      const schedules = [
        {
          startDate: startDate,
          endDate: endDate,
          plans: [
            {
              weekDays: [0, 1, 2, 3, 4, 5, 6], // All days
              startTime: "00:00",
              endTime: "23:59",
            },
          ],
        },
      ];

      // Get media URL and file info
      let mediaUrl: string | null = null;
      let duration = 9000; // default 9 seconds
      let mediaType = "VIDEO";
      let finalSelectedMedia = selectedMedia;

      let fileInfo: { size: number; md5: string | null } = { size: 0, md5: null };

      if (selectedMedia) {
        finalSelectedMedia = selectedMedia;
        mediaUrl = selectedMedia.url;
        // For library media, try to get accurate file info, fallback to stored values
        fileInfo = {
          size: selectedMedia.size || 0,
          md5: null, // Media library doesn't store md5
        };
        try {
          const response = await fetch("/api/file-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: selectedMedia.url }),
          });
          if (response.ok) {
            fileInfo = await response.json();
          }
        } catch (error) {
          console.error("Error getting file info for library media:", error);
          // Keep the fallback values
        }
        duration = selectedMedia.duration
          ? selectedMedia.duration * 1000
          : 9000;
        mediaType = selectedMedia.type?.startsWith("video/")
          ? "VIDEO"
          : "IMAGE";
      } else if (videoFile) {
        // Upload the file to Firebase Storage and create media library entry
        setIsUploading(true);
        try {
          toast({
            title: "Uploading",
            description: "Uploading file to media library...",
          });

          // Upload file to Firebase Storage
          const uploadedUrl = await uploadMediaFile(
            videoFile,
            userData.company_id
          );

          // Create media library entry with initial metadata
          const mediaData = {
            companyId: userData.company_id,
            name: videoFile.name,
            title: videoFile.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
            url: uploadedUrl,
            type: videoFile.type,
            size: videoFile.size,
            uploadedBy: userData.uid,
          };

          const mediaId = await createMediaLibrary(mediaData);

          // Get accurate file info using the API
          fileInfo = { size: videoFile.size, md5: null };
          try {
            const response = await fetch("/api/file-info", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: mediaData.url }),
            });
            if (response.ok) {
              fileInfo = await response.json();
            }
          } catch (error) {
            console.error("Error getting file info:", error);
            // Keep the calculated values
          }

          // Create a temporary Media object for playlist creation
          finalSelectedMedia = {
            id: mediaId,
            ...mediaData,
            uploadDate: Timestamp.now(),
            modifiedDate: Timestamp.now(),
            deleted: false,
            dateDeleted: null as any, // This field is not used in our logic
          };

          // Set the selected media state to show preview
          setSelectedMedia(finalSelectedMedia);

          mediaUrl = uploadedUrl;
          duration = 9000; // Default duration for uploaded videos
          mediaType = videoFile.type.startsWith("video/") ? "VIDEO" : "IMAGE";

          toast({
            title: "Success",
            description: "File uploaded to media library successfully.",
          });
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError);
          toast({
            title: "Error",
            description: "Failed to upload file. Please try again.",
            variant: "destructive",
          });
          return;
        } finally {
          setIsUploading(false);
        }
      }

      if (!mediaUrl) {
        toast({
          title: "Error",
          description: "No media selected.",
          variant: "destructive",
        });
        return;
      }

      // Create new page for operator program
      const newPage = {
        name: `operator-program-spot-${spot.number}`,
        schedules: schedules,
        client_id: userData.company_id,
        client_name: "Operator Program",
        acceptByUid: userData.uid,
        acceptBy: `${userData.first_name || ""} ${userData.last_name || ""}`,
        spot_number: spot.number,
        widgets: [
          {
            zIndex: 1,
            type: 'VIDEO',
            size: fileInfo.size,
            md5: fileInfo.md5,
            duration: duration,
            url: mediaUrl!,
            layout: {
              x: "0%",
              y: "0%",
              width: "100%",
              height: "100%",
            },
          },
        ],
      };

      // Remove existing page for this spot if editing, then add new page
      const filteredPages = existingPages.filter(page => page.spot_number !== spot.number);
      const allPages = [...filteredPages, newPage];

      // Sort pages by spot_number
      allPages.sort((a, b) => a.spot_number - b.spot_number);

      // Create playlist document
      const playlistDoc = {
        playerIds: product.playerIds,
        product_id: productId,
        company_id: userData.company_id,
        created: serverTimestamp(),
        pages: allPages,
      };

      await addDoc(collection(db, "playlist"), playlistDoc);

      // Deploy to CMS
      const schedule = {
        startDate: "2020-04-11",
        endDate: "2060-05-12",
        plans: [
          {
            weekDays: [0, 1, 2, 3, 4, 5, 6],
            startTime: product.cms.start_time,
            endTime: product.cms.end_time,
          },
        ],
      };

      const cmsPages = playlistDoc.pages.map((page) => ({
        name: page.name,
        schedules: page.schedules,
        widgets: page.widgets,
      }));
      console.log(`CMS Pages: `, JSON.stringify(playlistDoc));
      await createCMSContentDeployment(
        product.playerIds || [],
        schedule,
        cmsPages
      );

      toast({
        title: "Success",
        description: "Operator program has been created and deployed.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error creating operator program:", error);
      toast({
        title: "Error",
        description: "Failed to create operator program. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isEditMode) {
      setIsEditMode(false);
      setVideoFile(null);
      setSelectedMedia(null);
    } else {
      onOpenChange(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleBrowseMedia = () => {
    setMediaLibraryOpen(true);
  };

  const handleSelectMedia = (media: Media) => {
    setSelectedMedia(media);
    setVideoFile(null); // Clear uploaded file if media library item is selected
  };

  // Check if form is valid for saving
  const isFormValid =
    startDate &&
    endDate &&
    (isEditMode ? (videoFile || selectedMedia) : (videoFile || selectedMedia || spot?.imageUrl)) &&
    !isUploading;

  if (!spot) return null;

  const page = activePages.find((p) => p.spot_number === spot.number);
  const schedules = page?.schedules || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[500px] h-[470px] rounded-xl overflow-auto flex flex-col gap-4">
        <DialogHeader className="relative">
          <DialogTitle className="text-left">Operator Content</DialogTitle>
          <DialogClose className="absolute top-[-10px] right-[-10px]">
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>
        <div className="space-y-2 bg-white rounded-xl">
          {/* Info Section */}
          <div className="flex justify-between text-left mb-4">
            {/* Left Container */}

            {/* Right Container */}
            <div className="flex-1">
              {/* Dates */}
              <div className="flex items-start">
                <span className="w-[48px] text-xs text-gray-600 whitespace-nowrap">
                  Dates:
                </span>
                {isEditMode ? (
                  <div className="flex gap-1">
                    <input
                      type="date"
                      className="rounded-md bg-white border-silver border border-solid w-[80px] h-5 text-xs font-medium px-1"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="text-xs">-</span>
                    <input
                      type="date"
                      className="rounded-md bg-white border-silver border border-solid w-[80px] h-5 text-xs font-medium px-1"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                ) : (
                  <span className="text-xs font-bold whitespace-nowrap ml-2">
                    {schedules.length > 0
                      ? (() => {
                          const startDate = schedules[0].startDate?.toDate
                            ? schedules[0].startDate.toDate()
                            : new Date(schedules[0].startDate);
                          const endDate = schedules[0].endDate?.toDate
                            ? schedules[0].endDate.toDate()
                            : new Date(schedules[0].endDate);
                          const startStr = startDate.toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          );
                          const endStr = endDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                          return startStr === endStr
                            ? startStr
                            : `${startStr} - ${endStr}`;
                        })()
                      : "N/A"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex">
              {/* Spot Number */}
              <div className="flex items-center">
                <span className="w-[113px] text-xs text-gray-600 whitespace-nowrap">
                  Spot Number:
                </span>
                <span className="text-xs font-bold truncate whitespace-nowrap">
                  {spot.number}
                </span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="relative flex items-center justify-center bg-gray-400">
            <div
              className={`flex items-center justify-center overflow-hidden ${scaledWidth && scaledHeight ? "" : "aspect-square"}`}
              style={
                scaledWidth && scaledHeight
                  ? { width: `${scaledWidth}px`, height: `${scaledHeight}px` }
                  : {}
              }
            >
              {isUploading ? (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                  <div className="text-sm text-gray-600">
                    Uploading file...
                  </div>
                </div>
              ) : (videoFile || selectedMedia) || (spot.imageUrl && !isEditMode) ? (
                <video
                  key={
                    selectedMedia
                      ? selectedMedia.url
                      : videoFile
                        ? videoPreviewUrl
                        : spot.imageUrl
                  }
                  src={
                    selectedMedia
                      ? selectedMedia.url
                      : videoFile
                        ? videoPreviewUrl!
                        : spot.imageUrl
                  }
                  width={scaledWidth}
                  height={scaledHeight}
                  className="object-fill h-full w-full"
                  controls
                  autoPlay
                  muted
                />
              ) : isEditMode && pathname.includes('/logistics/') ? (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 inset-0 flex items-center justify-center h-[210px] w-[139px] rounded-md bg-black bg-opacity-50">
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <div className="rounded-[7.5px] bg-white border-gray-400 border-2 border-solid flex items-center justify-center py-2 px-8 mb-2">
                        <div className="px-2 border-gray-500">
                          <ArrowUpFromLine className="font-bold" />
                        </div>
                      </div>
                      <div className="text-center text-white text-xs">
                        Upload video
                      </div>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          setVideoFile(e.target.files?.[0] || null);
                          setSelectedMedia(null);
                        }}
                        className="hidden"
                      />
                    </label>
                    <div className="text-center text-xs mt-2 text-white">
                      OR
                    </div>
                    <div className="flex flex-col items-center">
                      <button
                        className="rounded-[6px] bg-white text-gray-700 w-[94px] h-[24px] text-xs font-medium mb-2"
                        onClick={handleBrowseMedia}
                      >
                        Browse
                      </button>
                      <div className="text-center text-xs text-white">
                        from Media Library
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {pathname.includes('/logistics/') && (
          <DialogFooter>
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  className="w-[90px] h-6 rounded-md border-silver text-xs font-medium"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  className="w-[90px] h-6 rounded-[6px] bg-green-700 text-xs font-bold"
                  onClick={handleSave}
                  disabled={isSaving || !isFormValid}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Saving
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </>
            ) : (
              <button
                onClick={handleEdit}
                className={`w-[90px] text-sm font-semibold h-[24px] rounded-[6px] border border-gray-400 ${!playerOnline || disabled || pathname.includes('/business/inventory/') ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                disabled={!playerOnline || disabled || pathname.includes('/business/inventory/')}
              >
                Edit
              </button>
            )}
          </DialogFooter>
        )}
      </DialogContent>

      <MediaLibraryDialog
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        onSelectMedia={handleSelectMedia}
      />
    </Dialog>
  );
}
