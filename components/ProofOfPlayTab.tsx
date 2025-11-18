"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ProofOfPlayTabProps {
  selectedYear: number
  setSelectedYear: (year: number) => void
}

const ProofOfPlayTab: React.FC<ProofOfPlayTabProps> = ({
  selectedYear,
  setSelectedYear,
}) => {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2020 + 1 }, (_, i) => 2020 + i)

  return (
    <Card className="rounded-xl shadow-sm border-none p-4">
      <CardContent className="pb-4 overflow-x-auto">
        <h3 className="text-lg font-semibold mb-2">Proof of Play</h3>
        <div className="flex justify-between items-start mb-6">
          {/* Left side - Title and Filter */}
          <div className="flex-1">
            <div className="mb-2">
              <label className="text-sm font-medium text-gray-700">Select a Year</label>
            </div>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-[70px] text-xs h-[24px]" >
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Right side - Statistics placeholder */}
          <div className="flex-1 justify-end">
            <div className="text-right">
              <div className="flex items-center justify-end">
                <span className="text-xs">Total Report:</span>
                <span className="text-xs font-bold">0</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 text-center text-gray-500">
          <p>No proof of play data available.</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default ProofOfPlayTab