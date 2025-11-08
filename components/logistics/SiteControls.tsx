"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
  Settings,
  Power,
  RotateCcw,
  Pause,
  ToggleLeft,
  Timer,
  RefreshCw,
  Camera,
  TestTube,
  Play,
  Sun,
  FolderSyncIcon as Sync,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ComingSoonModal } from "../coming-soon-dialog";

interface SiteControlsProps {
  product: any;
}

export default function SiteControls({ product }: SiteControlsProps) {


  // State for brightness slider - three-tier state management
  const oldBrightnessRef = useRef(50); // baseline value
  const [currentBrightness, setCurrentBrightness] = useState(50); // current displayed value
  const [newBrightness, setNewBrightness] = useState(50); // proposed value

  // State for volume slider - three-tier state management
  const oldVolumeRef = useRef(50);
  const [currentVolume, setCurrentVolume] = useState(50); // current displayed value
  const [newVolume, setNewVolume] = useState(50); // proposed value

  // Toast hook
  const { toast } = useToast();

  const handleAutoBrightness = async () => {
    const previousValue = oldBrightnessRef.current;

    if (!product.playerIds || product.playerIds.length === 0) {
      toast({
        title: "Failed",
        description: "No Player ID",
        variant: "destructive",
      });
      return;
    }
    // Store the old value before attempting auto brightness
    try {
      const response = await fetch(
        "https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/realtime-control/brightness",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerIds: product.playerIds,
            value: 50,
            noticeUrl: "http://www.abc.com/notice",
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Auto Brightness request sent successfully",
        });
        // Update old brightness to the new successful value
        setNewBrightness(50);
      } else {
        toast({
          title: "Failed",
          description: `Invalid Player ID`,
          variant: "destructive",
        });
        // Revert to the old brightness value
        setNewBrightness(previousValue);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Failed",
        description: `Invalid Player ID`,
        variant: "destructive",
      });
      setNewBrightness(previousValue);
    }
  };

  const handleScreenshot = async () => {
    if (!product.playerIds || product.playerIds.length === 0) {
      toast({
        title: "Failed",
        description: "No Player ID",
        variant: "destructive",
      });
    }
    try {
      const response = await fetch(
        "https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/realtime-control/screenshot",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerIds: product.playerIds,
            noticeUrl: "http://www.abc.com/notice",
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`screen shot data: `);
        if (data.screenshotUrl || data.url) {
          // Automatically download the screenshot
          const screenshotUrl = data.screenshotUrl || data.url;
          const link = document.createElement("a");
          link.href = screenshotUrl;
          link.download = `screenshot_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          toast({
            title: "Success",
            description:
              "Screenshot request sent, but no download URL received",
          });
        }
      } else {
        toast({
          title: "Failed",
          description: `Invalid Player ID`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error taking screenshot");
    }
  };

  const handlePauseContent = async () => {
    if (!product.playerIds || product.playerIds.length === 0) {
      toast({
        title: "Failed",
        description: "No Player ID",
        variant: "destructive",
      });
    }
    try {
      const response = await fetch(
        "https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/solutions/cancel",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerIds: product.playerIds,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Content paused successfully",
        });
      } else {
        toast({
          title: "Failed",
          description: `Invalid Player ID`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error pausing content");
    }
  };

  const handleRestart = async () => {
    if (!product.playerIds || product.playerIds.length === 0) {
      toast({
        title: "Failed",
        description: "No Player ID",
        variant: "destructive",
      });
    }
    try {
      const statusResponse = await fetch(
        "https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/realtime-control/restart",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerIds: product?.playerIds,
          }),
        }
      );
      if (statusResponse.ok) {
        toast({
          title: "Success",
          description: "The Player successfully restart",
        });
      } else {
        toast({
          title: "Failed",
          description: `Invalid Player ID`,
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Error fetching player status:", e);
    }
  };

  const setBrightnessValue = (value: number[]) => {
    setNewBrightness(value[0]); // store the temporary new brightness
    console.log(`new brightness : ${newBrightness}`);
  };

  const setVolumeValue = (value: number[]) => {
    setNewVolume(value[0]); // store the temporary new volume
  };

  // Function to apply brightness control
  const handleApplyBrightness = async () => {
    const valueToApply = newBrightness;
    const previousValue = oldBrightnessRef.current;
    console.log(`old brightness apply : ${previousValue}`);
    try {
      if (!product.playerIds || product.playerIds.length === 0) {
        toast({
          title: "Failed",
          description: "No Player ID",
          variant: "destructive",
        });
        setNewBrightness(previousValue);
        return;
      }

      const response = await fetch(
        "https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/realtime-control/brightness",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerIds: product?.playerIds,
            value: newBrightness,
            noticeUrl: "http://www.abc.com/notice",
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: `Brightness set to ${newBrightness}% successfully`,
        });
        oldBrightnessRef.current = valueToApply;
        // Update old brightness to the new successful value
      } else {
        toast({
          title: "Failed",
          description: `Invalid Player ID`,
          variant: "destructive",
        });
        // Revert to the old brightness value
        setNewBrightness(previousValue); // Also revert the slider position
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error setting brightness");
      // Revert to the old brightness value
      setNewBrightness(previousValue); // Also revert the slider position
    }
  };

  // Function to apply volume control
  const handleApplyVolume = async () => {
    const previousVolume = oldVolumeRef.current;
    const applyToValue = newVolume
    try {
      if (!product.playerIds || product.playerIds.length === 0) {
        toast({
          title: "Failed",
          description: "No Player ID",
          variant: "destructive",
        });
        setNewVolume(previousVolume)
        return;
      }

      const response = await fetch(
        "https://cms-novacloud-272363630855.asia-southeast1.run.app/api/v1/players/realtime-control/volume",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerIds: product.playerIds,
            value: newVolume,
            noticeUrl: "http://www.abc.com/notice",
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: `Volume set to ${newVolume}% successfully`,
        });
        // Update old volume to the new successful value
        setNewVolume(applyToValue);
      } else {
        toast({
          title: "Failed",
          description: `Invalid Player ID`,
          variant: "destructive",
        });
        // Revert to the old volume value
        setNewVolume(previousVolume); // Also revert the slider position
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error setting volume");
      // Revert to the old volume value
      setNewVolume(previousVolume); // Also revert the slider position
    }
  };

  return (
    <div className="space-y-6">
      <div className="w-full">
        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> */}
        {/* LED Site Status */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings size={18} />
              LED Site Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Power Status</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">{ledStatus.powerStatus}</span>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Connection</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">{ledStatus.connection}</span>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Temperature</span>
                <p className="text-sm mt-1">{ledStatus.temperature}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Video Source</span>
                <p className="text-sm mt-1">{ledStatus.videoSource}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Active Content</span>
                <p className="text-sm mt-1 text-blue-600">{ledStatus.activeContent}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Last Time Sync</span>
                <p className="text-sm mt-1">{ledStatus.lastTimeSync}</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <span className="text-sm font-medium text-gray-500">Last Reboot</span>
                <p className="text-sm mt-1">{ledStatus.lastReboot}</p>
              </div>
            </div>

            {ledStatus.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="text-sm font-medium">⚠ Warnings</span>
                </div>
                <ul className="mt-1 text-sm text-yellow-700">
                  {ledStatus.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card> */}

        {/* Remote Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power size={18} />
              Remote Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <Power size={16} />
              </Button>
              <Button
                variant="outline"
                onClick={handleRestart}
                className="flex items-center gap-2 bg-transparent"
              >
                <RotateCcw size={16} />
                Restart Players
              </Button>
            </div>

            <div>
              <h4 className="font-medium mb-3">Content Controls</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                  onClick={handlePauseContent}
                >
                  <Pause size={16} />
                  Pause Content
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <ToggleLeft size={16} />
                  Switch Source
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">System Controls</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Timer size={16} />
                  NTP Time Sync
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <RefreshCw size={16} />
                  Screen Refresh
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Monitoring</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                  onClick={handleScreenshot}
                >
                  <Camera size={16} />
                  Screenshot
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <RefreshCw size={16} />
                  Refresh Status
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Quick Actions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <TestTube size={16} />
                  Test Pattern
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Play size={16} />
                  Run Diagnostics
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                  onClick={handleAutoBrightness}
                >
                  <Sun size={16} />
                  Auto Brightness
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Sync size={16} />
                  Sync Playback
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Preview */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>Content</span>
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                Display Health
              </Badge>
              <span>Structure</span>
            </div>
            <span>
              {new Date().toLocaleDateString()}, {new Date().toLocaleTimeString()}
            </span>
            <Button size="sm" variant="outline">
              Live
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {livePreview.map((preview) => (
              <div key={preview.id} className="text-center">
                <div className="bg-gray-100 rounded-lg p-2 mb-2">
                  <Image
                    src={preview.image || "/placeholder.svg"}
                    alt={preview.id}
                    width={150}
                    height={100}
                    className="w-full h-auto rounded"
                  />
                </div>
                <p className="text-sm font-medium truncate">{preview.id}</p>
                <Badge
                  className={
                    preview.health.includes("100%")
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }
                >
                  {preview.health}
                </Badge>
              </div>
            ))}
          </div>

          <Button className="mt-4 bg-blue-600 hover:bg-blue-700">Create Service Assignment</Button>
        </CardContent>
      </Card> */}

      {/* Brightness and Volume Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Brightness Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Slider
                value={[newBrightness]}
                onValueChange={(value) => setBrightnessValue(value)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>0%</span>
                <span>{newBrightness}%</span>
                <span>100%</span>
              </div>
              <Button onClick={handleApplyBrightness} className="w-full">
                Apply Brightness
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Slider
                value={[newVolume]}
                onValueChange={(value) => setVolumeValue(value)}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>0%</span>
                <span>{currentVolume}%</span>
                <span>100%</span>
              </div>
              <Button onClick={handleApplyVolume} className="w-full">
                Apply Volume
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
