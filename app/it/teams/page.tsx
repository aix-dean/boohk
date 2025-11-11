"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { AddTeammateDialog } from "@/components/AddTeammateDialog"
import { useAuth } from "@/contexts/auth-context"

export default function TeamPage() {
  const { user } = useAuth()

  const departments = [
    {
      name: "Sales",
      color: "bg-red-500",
      description: "Approves/declines booking orders from retail channels. Monitors sites' occupancy.",
      members: [],
    },
    {
      name: "Business Dev.",
      color: "bg-blue-500",
      description: "Manages company's inventory including its prices and specifications.",
      members: [],
    },
    {
      name: "Accounting",
      color: "bg-purple-700",
      description: "Verifies collections and financial reportings.",
      members: [],
    },
    {
      name: "I.T.",
      color: "bg-teal-600",
      description: "Adds teammates and handles integration of Boohk to internal ERP and CMS.",
      members: user?.email ? [user.email] : [],
    },
  ]

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<{ name: string; color: string; } | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Team</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {departments.map((dept) => (
            <div key={dept.name} className="bg-white rounded-lg p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-full flex-shrink-0 ${dept.color}`} />
                <h2 style={{ color: '#333', fontFamily: 'Inter', fontSize: '22px', fontWeight: '700', lineHeight: '28px' }}>{dept.name}</h2>
              </div>

              <div className="h-12 mb-6">
                <p className="text-[12px] text-[#717375] font-normal leading-[12px] font-['Inter']">{dept.description}</p>
              </div>
              <div className="border-t border-gray-200 mt-4 mb-4" />

              {dept.members.length > 0 && (
                <div className="mb-4 space-y-2">
                  {dept.members.map((member) => (
                    <div
                      key={member}
                      className="border-l-4 border-[#C4C4C4] bg-white px-3 py-2"
                      style={{ color: '#333', fontFamily: 'Inter', fontSize: '12px', fontWeight: '500', lineHeight: '12px' }}
                    >
                      {member}
                    </div>
                  ))}
                </div>
              )}

              <div className={dept.name === "I.T." ? "flex-1 flex items-center justify-end" : "flex-1 flex items-center justify-center"}>
                <Button
                  variant="outline"
                  size={dept.name === "I.T." ? "icon" : "sm"}
                  className={dept.name === "I.T." ? "w-6 h-6 border-[1.5px] border-[#C4C4C4] bg-white rounded-[6px]" : "w-[119px] h-[24px] px-[29px] py-0 items-center rounded-[6px] border-[1.5px] border-[#C4C4C4] bg-white text-[#333] text-center font-['Inter'] text-[12px] font-medium leading-[12px]"}
                  onClick={() => { setSelectedDepartment({ name: dept.name, color: dept.color }); setDialogOpen(true); }}
                >
                  {dept.name === "I.T." ? "+" : "+Add Teammate"}
                </Button>
              </div>
            </div>
          ))}
        </div>


        <AddTeammateDialog open={dialogOpen} onOpenChange={setDialogOpen} department={selectedDepartment} />
      </div>
    </div>
  )
}