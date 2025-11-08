"use client"

import { PettyCashFundTable } from "@/components/accounting/encashment/petty-cash"
import { RevolvingFundTable } from "@/components/accounting/encashment/revolving-fund"
import { AdditionalEncashmentsTable } from "@/components/accounting/encashment/additional-encashments"
import { Separator } from "@/components/ui/separator"

export default function EncashmentPage() {
  return (
    <div className="flex-1 p-4 md:p-6 space-y-8">
      <PettyCashFundTable />
      <Separator />
      <RevolvingFundTable />
      <Separator />
      <AdditionalEncashmentsTable />
    </div>
  )
}
