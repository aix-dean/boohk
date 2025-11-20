"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ProofOfPlayTabProps {
}

const ProofOfPlayTab: React.FC<ProofOfPlayTabProps> = ({

}) => {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 2020 + 1 }, (_, i) => 2020 + i)

  return (
    <Card className="rounded-xl shadow-sm border-none p-4">
      <CardContent className="pb-4 overflow-x-auto">
        <h3 className="text-lg font-semibold mb-2">Proof of Play</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead>Airing ticket</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-t h-[64px]">
              <TableCell>Sample Ad 1</TableCell>
              <TableCell>T001</TableCell>
              <TableCell>2023-01-01</TableCell>
              <TableCell>2023-01-31</TableCell>
              <TableCell>Played</TableCell>
              <TableCell>Report 1</TableCell>
            </TableRow>
            <TableRow className="border-t">
              <TableCell>Sample Ad 2</TableCell>
              <TableCell>T002</TableCell>
              <TableCell>2023-02-01</TableCell>
              <TableCell>2023-02-28</TableCell>
              <TableCell>Pending</TableCell>
              <TableCell>Report 2</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default ProofOfPlayTab