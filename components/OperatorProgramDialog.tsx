import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ArrowUpFromLine, X, Loader2 } from "lucide-react";
import { MediaLibraryDialog } from "@/components/MediaLibraryDialog";
import { useAuth } from "@/contexts/auth-context";
import { Media } from "oh-db-models";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, orderBy, limit, Timestamp } from "firebase/firestore";
import { createCMSContentDeployment } from "@/lib/cms-api";
import { useToast } from "@/hooks/use-toast";
import { uploadMediaFile, createMediaLibrary } from "@/lib/firebase-service";

interface OperatorProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spotNumber: number;
  productId?: string;
}

export function OperatorProgramDialog({
  open,
  onOpenChange,
  spotNumber,
  productId,
}: OperatorProgramDialogProps) {
  const { userData } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (!productId || !userData?.company_id) {
      toast({
        title: "Error",
        description: "Missing product or company information.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get product data for player IDs
      const productRef = doc(db, "products", productId);
      const productSnap = await getDocs(query(collection(db, "products"), where("__name__", "==", productId)));
      const product = productSnap.docs[0]?.data();

      if (!product) {
        toast({
          title: "Error",
          description: "Product not found.",
          variant: "destructive"
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
      const schedules = [{
        startDate: startDate,
        endDate: endDate,
        plans: [{
          weekDays: [0, 1, 2, 3, 4, 5, 6], // All days
          startTime: "00:00",
          endTime: "23:59"
        }]
      }];

      // Get media URL and file info
      let mediaUrl: string | null = null;
      let fileInfo = { size: 12000, md5: "placeholder-md5" };
      let duration = 9000; // default 9 seconds
      let mediaType = "VIDEO";
      let finalSelectedMedia = selectedMedia;

      if (selectedMedia) {
        finalSelectedMedia = selectedMedia;
        mediaUrl = selectedMedia.url;
        // For library media, try to get accurate file info, fallback to stored values
        fileInfo = { size: selectedMedia.size || 12000, md5: "placeholder-md5" };
        try {
          const response = await fetch('/api/file-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: selectedMedia.url })
          });
          if (response.ok) {
            fileInfo = await response.json();
          }
        } catch (error) {
          console.error('Error getting file info for library media:', error);
          // Keep the fallback values
        }
        duration = selectedMedia.duration ? selectedMedia.duration * 1000 : 9000;
        mediaType = selectedMedia.type?.startsWith("video/") ? "VIDEO" : "IMAGE";
      } else if (videoFile) {
        // Upload the file to Firebase Storage and create media library entry
        setIsUploading(true);
        try {
          toast({
            title: "Uploading",
            description: "Uploading file to media library..."
          });

          // Upload file to Firebase Storage
          const uploadedUrl = await uploadMediaFile(videoFile, userData.company_id);

          // Get accurate file info using the API
          let fileInfo = { size: videoFile.size, md5: "placeholder-md5" };
          try {
            const response = await fetch('/api/file-info', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: uploadedUrl })
            });
            if (response.ok) {
              fileInfo = await response.json();
            }
          } catch (error) {
            console.error('Error getting file info:', error);
            // Fall back to basic file info
          }

          // Create media library entry with accurate metadata
          const mediaData = {
            companyId: userData.company_id,
            name: videoFile.name,
            title: videoFile.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
            url: uploadedUrl,
            type: videoFile.type,
            size: fileInfo.size,
            uploadedBy: userData.uid,
          };

          const mediaId = await createMediaLibrary(mediaData);

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
          // fileInfo is already set above from the API call
          duration = 9000; // Default duration for uploaded videos
          mediaType = videoFile.type.startsWith("video/") ? "VIDEO" : "IMAGE";

          toast({
            title: "Success",
            description: "File uploaded to media library successfully."
          });
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError);
          toast({
            title: "Error",
            description: "Failed to upload file. Please try again.",
            variant: "destructive"
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
          variant: "destructive"
        });
        return;
      }

      // Create new page for operator program
      const newPage = {
        name: `operator-program-spot-${spotNumber}`,
        schedules: schedules,
        client_id: userData.company_id,
        client_name: "Operator Program",
        acceptByUid: userData.uid,
        acceptBy: `${userData.first_name || ""} ${userData.last_name || ""}`,
        spot_number: spotNumber,
        widgets: [{
          zIndex: 1,
          type: mediaType,
          size: fileInfo.size,
          md5: fileInfo.md5,
          duration: duration,
          url: mediaUrl!,
          layout: {
            x: "0%",
            y: "0%",
            width: "100%",
            height: "100%"
          }
        }]
      };

      // Combine existing pages with new operator program page
      const allPages = [...existingPages, newPage];

      // Create playlist document
      const playlistDoc = {
        playerIds: product.playerIds,
        product_id: productId,
        company_id: userData.company_id,
        created: serverTimestamp(),
        pages: allPages
      };

      await addDoc(collection(db, "playlist"), playlistDoc);

      // Deploy to CMS
      const schedule = {
        startDate: "2020-04-11",
        endDate: "2060-05-12",
        plans: [{
          weekDays: [0, 1, 2, 3, 4, 5, 6],
          startTime: "00:00",
          endTime: "23:59"
        }]
      };

      const cmsPages = playlistDoc.pages.map(page => ({
        name: page.name,
        schedules: page.schedules,
        widgets: page.widgets
      }));

      await createCMSContentDeployment(product.playerIds || [], schedule, cmsPages);

      toast({
        title: "Success",
        description: "Operator program has been created and deployed."
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error creating operator program:", error);
      toast({
        title: "Error",
        description: "Failed to create operator program. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleBrowseMedia = () => {
    setMediaLibraryOpen(true);
  };

  const handleSelectMedia = (media: Media) => {
    setSelectedMedia(media);
    setVideoFile(null); // Clear uploaded file if media library item is selected
  };

  // Check if form is valid for saving
  const isFormValid = startDate && endDate && (videoFile || selectedMedia) && !isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[491px] h-[470px]  flex flex-col text-left text-xs text-darkslategray font-inter overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <b className="text-base leading-[114%]">Operator's Program</b>
          <DialogClose>
            {" "}
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="leading-[114%]">Dates:</span>
            <input
              type="date"
              className="rounded-md bg-white border-silver border border-solid w-[120px] h-6 text-xs font-medium px-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start"
            />
            <span className="text-xs">-</span>
            <input
              type="date"
              className="rounded-md bg-white border-silver border border-solid w-[120px] h-6 text-xs font-medium px-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="leading-[114%]">Spot:</span>
            <b className="leading-[114%]">{spotNumber}</b>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-300">
          {selectedMedia || videoFile ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 text-center">
                <div className="text-sm font-medium text-gray-700 mb-2">{selectedMedia ? "Selected from Media Library:" : "Selected file:"}</div>
                <div className="bg-white rounded-lg p-4 max-w-xs">
                  <video
                    src={selectedMedia ? selectedMedia.url : videoPreviewUrl!}
                    className="w-full h-32 object-cover rounded"
                    controls={false}
                    muted
                  />
                  <div className="mt-2 text-xs text-gray-600">
                    {selectedMedia ? (selectedMedia.title || selectedMedia.name || "Untitled") : videoFile!.name}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBrowseMedia}
                className="mb-2"
              >
                {selectedMedia ? "Change Selection" : "Browse Media Library"}
              </Button>
              {!selectedMedia && (
                <label className="cursor-pointer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mb-2"
                  >
                    Change File
                  </Button>
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
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-4 ">
                {isUploading ? (
                  <div className="flex flex-col items-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                    <div className="text-sm text-gray-600">Uploading file...</div>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="rounded-[7.5px] bg-white border-gray-400 border-2 border-solid flex items-center justify-center py-2 px-8 mb-2">
                      <div className="px-2 border-gray-500">
                        <ArrowUpFromLine className="font-bold" />
                      </div>
                    </div>
                    <div className="text-center leading-[114%]">Upload video</div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        setVideoFile(e.target.files?.[0] || null);
                        setSelectedMedia(null); // Clear selected media if file is uploaded
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {!isUploading && (
                <>
                  <div className="text-center leading-[114%] mb-4">OR</div>
                  <div className="flex flex-col items-center">
                    <button
                      className="rounded-[6px] bg-white text-gray-700 w-[94px] h-[24px] text-xs font-medium mb-2"
                      onClick={handleBrowseMedia}
                    >
                      Browse
                    </button>
                    <div className="text-center leading-[114%]">from Media Library</div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
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
            disabled={!isFormValid}
          >
            Save
          </Button>
        </div>
      </DialogContent>

      <MediaLibraryDialog
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        onSelectMedia={handleSelectMedia}
      />
    </Dialog>
  );
}
