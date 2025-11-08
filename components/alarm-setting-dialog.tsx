"use client"

import * as React from "react"
import { X, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AlarmSettingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AlarmSettingDialog({ open, onOpenChange }: AlarmSettingDialogProps) {
  const [hour, setHour] = React.useState("03")
  const [minute, setMinute] = React.useState("30")
  const [period, setPeriod] = React.useState("PM")
  const [sound, setSound] = React.useState("Bing Bang")
  const [repeat, setRepeat] = React.useState("Custom")
  const [label, setLabel] = React.useState("Monthly Check-up")

  const incrementHour = () => {
    const currentHour = Number.parseInt(hour)
    const newHour = currentHour === 12 ? 1 : currentHour + 1
    setHour(newHour.toString().padStart(2, "0"))
  }

  const decrementHour = () => {
    const currentHour = Number.parseInt(hour)
    const newHour = currentHour === 1 ? 12 : currentHour - 1
    setHour(newHour.toString().padStart(2, "0"))
  }

  const incrementMinute = () => {
    const currentMinute = Number.parseInt(minute)
    const newMinute = currentMinute === 59 ? 0 : currentMinute + 1
    setMinute(newMinute.toString().padStart(2, "0"))
  }

  const decrementMinute = () => {
    const currentMinute = Number.parseInt(minute)
    const newMinute = currentMinute === 0 ? 59 : currentMinute - 1
    setMinute(newMinute.toString().padStart(2, "0"))
  }

  const togglePeriod = () => {
    setPeriod(period === "AM" ? "PM" : "AM")
  }

  const handleSetAlarm = () => {
    // Handle alarm setting logic here
    console.log("Alarm set:", { hour, minute, period, sound, repeat, label })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold">Alarm Setting (Illumination)</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-6 w-6"
            onClick={() => onOpenChange(false)}
          >
            
          </Button>
        </DialogHeader>

        <div className="px-6 py-6 space-y-6">
          {/* Time Picker */}
          <div className="flex justify-center items-center space-x-8">
            {/* Hour */}
            <div className="flex flex-col items-center">
              <Button variant="ghost" size="icon" className="h-8 w-8 mb-2" onClick={incrementHour}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-4xl font-bold w-16 text-center">{hour}</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 mt-2" onClick={decrementHour}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Minute */}
            <div className="flex flex-col items-center">
              <Button variant="ghost" size="icon" className="h-8 w-8 mb-2" onClick={incrementMinute}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-4xl font-bold w-16 text-center">{minute}</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 mt-2" onClick={decrementMinute}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* AM/PM */}
            <div className="flex flex-col items-center">
              <Button variant="ghost" size="icon" className="h-8 w-8 mb-2" onClick={togglePeriod}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="text-4xl font-bold w-16 text-center">{period}</div>
              <Button variant="ghost" size="icon" className="h-8 w-8 mt-2" onClick={togglePeriod}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium w-20">Sounds</Label>
              <Select value={sound} onValueChange={setSound}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bing Bang">Bing Bang</SelectItem>
                  <SelectItem value="Chime">Chime</SelectItem>
                  <SelectItem value="Bell">Bell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium w-20">Repeat</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Custom">Custom</SelectItem>
                  <SelectItem value="Daily">Daily</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium w-20">Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-48"
                placeholder="Enter label"
              />
            </div>
          </div>

          {/* Set Alarm Button */}
          <div className="flex justify-center pt-4">
            <Button onClick={handleSetAlarm} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2">
              Set Alarm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
