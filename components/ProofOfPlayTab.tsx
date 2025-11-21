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
  const data : any = []
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
            {data && data.length > 0 ? (
              <TableRow className="border-t h-[64px]">
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  No proof of play data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default ProofOfPlayTab