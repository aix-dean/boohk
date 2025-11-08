"use client"

import { useState, useEffect } from "react"

interface ExpenseCycle {
  id: string
  from: string
  until: string
  amount: number
  expenses: {
    item: string
    amount: number
    date: string
    requestedBy: string
  }[]
}
import { Search, ChevronDown, ChevronUp, MoreVertical, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddExpenseDialog } from "@/components/add-expense-dialog"
import { ConfigurationDialog } from "@/components/configuration-dialog"
import { ResponsiveTable } from "@/components/responsive-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/contexts/auth-context"
import { savePettyCashConfig, getPettyCashConfig, createPettyCashCycle, getNextCycleNo, getActivePettyCashCycle, completePettyCashCycle, getPettyCashCycles, getPettyCashExpenses, savePettyCashExpense, getLatestPettyCashCycle, updatePettyCashCycleTotal, updatePettyCashCycleConfigId, uploadFileToFirebase, type PettyCashCycle } from "@/lib/petty-cash-service"
import { db } from "@/lib/firebase"
import { onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useResponsive } from "@/hooks/use-responsive"
import { News_Cycle } from "next/font/google"
import { on } from "events"

export default function PettyCashPage() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const { isMobile, isTablet } = useResponsive()
  const [expandedCycles, setExpandedCycles] = useState<string[]>(["0012"])
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isConfigLoading, setIsConfigLoading] = useState(false)
  const [configData, setConfigData] = useState({ pettyCashAmount: 0, warnAmount: 0 })
  const [onHandAmount, setOnHandAmount] = useState(0) // Default fallback
  const [expenseCycles, setExpenseCycles] = useState<ExpenseCycle[]>([])
  const [isExpensesLoading, setIsExpensesLoading] = useState(false)
  const [currentCycle, setCurrentCycle] = useState<PettyCashCycle | null>(null)

  // Debug: Log onHandAmount changes
  useEffect(() => {
    console.log("onHandAmount state changed to:", onHandAmount)
  }, [onHandAmount])

  // Calculate on-hand amount as config amount minus current cycle total
  useEffect(() => {
    const calculatedOnHand = configData.pettyCashAmount - (currentCycle?.total || 0)
    setOnHandAmount(calculatedOnHand)
    console.log("Calculated on-hand amount:", calculatedOnHand, "config:", configData.pettyCashAmount, "cycle total:", currentCycle?.total || 0)
  }, [configData.pettyCashAmount, currentCycle?.total])

  // Load existing configuration on component mount
  useEffect(() => {
    const loadConfiguration = async () => {
      console.log("Loading configuration - userData:", userData)
      console.log("Company ID:", userData?.company_id)

      if (!userData?.company_id) {
        console.log("No company_id found, skipping configuration load")
        return
      }

      try {
        console.log("Fetching configuration for company:", userData.company_id)
        const existingConfig = await getPettyCashConfig(userData.company_id)
        console.log("Configuration fetched:", existingConfig)

        if (existingConfig) {
          console.log("Setting configuration data:", existingConfig.amount, existingConfig.warning_amount)
          setConfigData({
            pettyCashAmount: existingConfig.amount,
            warnAmount: existingConfig.warning_amount,
          })
          console.log("Configuration loaded, on-hand will be calculated automatically")
        } else {
          console.log("No configuration found in database")
        }
      } catch (error) {
        console.error("Error loading petty cash configuration:", error)
        // Keep default values if loading fails
      }
    }

    loadConfiguration()
  }, [userData?.company_id])

  // Load latest petty cash cycle on component mount with real-time updates
  useEffect(() => {
    console.log("Setting up real-time listener for latest cycle - userData:", userData)
    console.log("Company ID:", userData?.company_id)

    if (!userData?.company_id) {
      console.log("No company_id found, skipping cycle listener")
      return
    }

    const cyclesRef = collection(db, "petty_cash_cycles")
    const q = query(
      cyclesRef,
      where("company_id", "==", userData.company_id),
      orderBy("cycle_no", "desc"),
      limit(1)
    )

    console.log("Setting up onSnapshot for latest petty cash cycle")
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log("onSnapshot triggered for latest cycle, docs:", querySnapshot.size)
      querySnapshot.docChanges().forEach((change) => {
        console.log("Change type:", change.type, "doc id:", change.doc.id, "data:", change.doc.data())
      })
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0]
        const cycle = { id: doc.id, ...doc.data() } as PettyCashCycle
        console.log("Latest cycle updated to:", cycle.cycle_no, "id:", cycle.id)
        setCurrentCycle(cycle)
      } else {
        console.log("No cycles found, setting currentCycle to null")
        setCurrentCycle(null)
      }
    }, (error) => {
      console.error("Error in onSnapshot for latest cycle:", error)
      setCurrentCycle(null)
    })

    return unsubscribe
  }, [userData?.company_id])

  const toggleCycle = (cycleId: string) => {
    setExpandedCycles((prev) => (prev.includes(cycleId) ? prev.filter((id) => id !== cycleId) : [...prev, cycleId]))
  }

  const handleAddExpense = async (data: { item: string; amount: number; requestedBy: string; attachments: File[] }) => {
    console.log("handleAddExpense called with data:", data)
    if (!userData?.company_id || !userData?.uid) {
      console.log("Missing user data:", { company_id: userData?.company_id, uid: userData?.uid })
      toast({
        title: "Error",
        description: "User authentication required",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Getting latest cycle for company:", userData.company_id)
      // Get latest cycle
      const latestCycle = await getLatestPettyCashCycle(userData.company_id)
      console.log("Latest cycle:", latestCycle)
      if (!latestCycle) {
        toast({
          title: "Error",
          description: "No petty cash cycle found. Please create a cycle first.",
          variant: "destructive",
        })
        return
      }

      // Upload attachments
      console.log("Uploading attachments:", data.attachments.length, "files")
      const attachmentUrls: string[] = []
      for (const file of data.attachments) {
        try {
          console.log("Uploading file:", file.name)
          const url = await uploadFileToFirebase(file, `petty-cash/${userData.company_id}/${latestCycle.id}`)
          console.log("Uploaded URL:", url)
          attachmentUrls.push(url)
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError)
          toast({
            title: "Upload Error",
            description: `Failed to upload ${file.name}`,
            variant: "destructive",
          })
          return
        }
      }
      console.log("All attachments uploaded:", attachmentUrls)

      // Save expense
      console.log("Saving expense with data:", {
        companyId: userData.company_id,
        userId: userData.uid,
        cycleId: latestCycle.id,
        expenseData: {
          item: data.item,
          amount: data.amount,
          requestedBy: data.requestedBy,
          attachment: attachmentUrls,
        }
      })
      if (!latestCycle.id) {
        toast({
          title: "Error",
          description: "Invalid cycle ID",
          variant: "destructive",
        })
        return
      }
      await savePettyCashExpense(
        userData.company_id,
        userData.uid,
        latestCycle.id,
        {
          item: data.item,
          amount: data.amount,
          requestedBy: data.requestedBy,
          attachment: attachmentUrls,
        }
      )
      console.log("Expense saved successfully")

      // Update cycle total
      const newTotal = latestCycle.total + data.amount
      console.log("Updating cycle total from", latestCycle.total, "to", newTotal)
      if (!latestCycle.id) {
        toast({
          title: "Error",
          description: "Invalid cycle ID for update",
          variant: "destructive",
        })
        return
      }
      await updatePettyCashCycleTotal(latestCycle.id, newTotal)
      console.log("Cycle total updated")

      // Refresh expenses
      const updatedCycles = await getPettyCashCycles(userData.company_id)
      const transformedCycles: ExpenseCycle[] = await Promise.all(
        updatedCycles.map(async (cycle) => {
          const expenses = await getPettyCashExpenses(cycle.id!)
          const transformedExpenses = expenses.map(exp => ({
            item: exp.item,
            amount: exp.amount,
            date: formatDate(exp.created),
            requestedBy: exp.requested_by
          }))

          return {
            id: cycle.cycle_no.toString().padStart(4, '0'),
            from: formatDate(cycle.startDate),
            until: formatDate(cycle.endDate),
            amount: cycle.total,
            expenses: transformedExpenses
          }
        })
      )
      setExpenseCycles(transformedCycles)

      toast({
        title: "Success",
        description: "Expense added successfully",
      })

    } catch (error) {
      console.error("Error adding expense:", error)
      toast({
        title: "Error",
        description: "Failed to add expense",
        variant: "destructive",
      })
    } finally {
      setIsAddExpenseOpen(false)
    }
  }

  const handleSaveConfiguration = async (data: { pettyCashAmount: number; warnAmount: number }) => {
    console.log("handleSaveConfiguration called with data:", data)

    if (!userData?.company_id || !userData?.uid) {
      console.log("Missing user data:", { company_id: userData?.company_id, uid: userData?.uid })
      toast({
        title: "Error",
        description: "User authentication required",
        variant: "destructive",
      })
      return
    }

    setIsConfigLoading(true)

    try {
      console.log("Saving configuration to database...")
      // Save to database
      const configId = await savePettyCashConfig(
        userData.company_id,
        userData.uid,
        data.pettyCashAmount,
        data.warnAmount
      )
      console.log("Configuration saved with ID:", configId)

      // Update the latest cycle's config_id if a cycle exists
      try {
        const latestCycle = await getLatestPettyCashCycle(userData.company_id)
        if (latestCycle) {
          await updatePettyCashCycleConfigId(latestCycle.id!, configId)
          console.log("Updated latest cycle config_id to:", configId)
        } else {
          console.log("No latest cycle found, skipping config_id update")
        }
      } catch (cycleUpdateError) {
        console.error("Error updating cycle config_id:", cycleUpdateError)
        // Don't fail the whole operation if cycle update fails
      }

      // Update local state
      setConfigData(data)
      console.log("Config data updated, on-hand will be recalculated automatically")

      // Close dialog
      setIsConfigOpen(false)

      // Show success message
      toast({
        title: "Configuration Saved",
        description: "Petty cash configuration has been updated successfully",
      })

    } catch (error) {
      console.error("Error saving petty cash configuration:", error)
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsConfigLoading(false)
    }
  }

  const handleReplenishConfirm = async () => {
    if (!userData?.company_id || !userData?.uid) {
      toast({
        title: "Error",
        description: "User authentication required",
        variant: "destructive",
      })
      return
    }

    try {
      // Get petty cash configuration
      const config = await getPettyCashConfig(userData.company_id)
      if (!config) {
        toast({
          title: "Error",
          description: "Petty cash configuration not found",
          variant: "destructive",
        })
        return
      }

      // Complete active cycle if exists
      const activeCycle = await getActivePettyCashCycle(userData.company_id)
      if (activeCycle) {
        await completePettyCashCycle(activeCycle.id!)
      }

      // Get next cycle number
      const nextCycleNo = await getNextCycleNo(userData.company_id)

      // Create new cycle
      const newCycleId = await createPettyCashCycle(
        userData.company_id,
        userData.uid,
        config.id!,
        nextCycleNo,
      )
      console.log("New cycle created with ID:", newCycleId, "cycle_no:", nextCycleNo)

      toast({
        title: "Success",
        description: "New petty cash cycle created successfully",
      })

    } catch (error) {
      console.error("Error creating new petty cash cycle:", error)
      toast({
        title: "Error",
        description: "Failed to create new petty cash cycle",
        variant: "destructive",
      })
    }
  }

  // Check if on-hand amount is at or below warning threshold
  const isBalanceLow = onHandAmount <= configData.warnAmount

  // Helper function to format Firestore Timestamp to readable date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "-"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Load expense cycles on component mount with real-time updates
  useEffect(() => {
    console.log("Setting up real-time listener for expense cycles - userData:", userData)
    console.log("Company ID:", userData?.company_id)

    if (!userData?.company_id) {
      console.log("No company_id found, skipping cycles listener")
      return
    }

    setIsExpensesLoading(true)

    const cyclesRef = collection(db, "petty_cash_cycles")
    const q = query(
      cyclesRef,
      where("company_id", "==", userData.company_id),
      orderBy("cycle_no", "desc")
    )

    console.log("Setting up onSnapshot for petty cash cycles")
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      console.log("onSnapshot triggered for cycles, docs:", querySnapshot.size)
      try {
        const cycles: PettyCashCycle[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PettyCashCycle))
        console.log("Fetched cycles:", cycles)

        // Transform cycles and fetch expenses for each
        const transformedCycles: ExpenseCycle[] = await Promise.all(
          cycles.map(async (cycle) => {
            const expenses = await getPettyCashExpenses(cycle.id!)
            const transformedExpenses = expenses.map(exp => ({
              item: exp.item,
              amount: exp.amount,
              date: formatDate(exp.created),
              requestedBy: exp.requested_by
            }))

            return {
              id: cycle.cycle_no.toString().padStart(4, '0'),
              from: formatDate(cycle.startDate),
              until: formatDate(cycle.endDate),
              amount: cycle.total,
              expenses: transformedExpenses
            }
          })
        )

        console.log("Transformed cycles:", transformedCycles)
        setExpenseCycles(transformedCycles)
        setIsExpensesLoading(false)
      } catch (error) {
        console.error("Error in onSnapshot for cycles:", error)
        setExpenseCycles([])
        setIsExpensesLoading(false)
      }
    }, (error) => {
      console.error("Error in onSnapshot for cycles:", error)
      setExpenseCycles([])
      setIsExpensesLoading(false)
    })

    return unsubscribe
  }, [userData?.company_id])

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="flex min-h-screen">
        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto">
            {/* Header with Configuration Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h1 className="text-xl md:text-2xl font-semibold text-[#000000]">Petty Cash</h1>
              <Button
                variant="outline"
                className="border-[#c4c4c4] text-[#000000] bg-transparent w-full sm:w-auto"
                onClick={() => setIsConfigOpen(true)}
              >
                Configuration
              </Button>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 lg:gap-8">
              {/* On Hand Section */}
              <div className="bg-white rounded-lg border border-[#e0e0e0] p-4 md:p-6 flex flex-col min-h-[500px] xl:min-h-[600px] max-h-[700px]">
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-[#000000] mb-4">On Hand</h2>
                  <div className={`text-2xl md:text-3xl lg:text-4xl font-bold mb-4 flex items-center justify-center gap-2 ${isBalanceLow ? 'text-red-600' : 'text-[#30c71d]'}`}>
                    {isBalanceLow && <AlertTriangle className="w-6 h-6 md:w-8 md:h-8 text-red-600" />}
                    <span>₱{onHandAmount.toLocaleString()}</span>
                  </div>
                  {isBalanceLow && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4">
                      ⚠️ Petty cash balance is low! Consider replenishing.
                    </div>
                  )}
                  <div className="text-sm text-[#a1a1a1] space-y-1">
                    <div className="text-center">{currentCycle ? `Cycle#: ${currentCycle.cycle_no.toString().padStart(4, '0')}` : 'No Cycle'}</div>
                    <div>Start: {currentCycle ? formatDate(currentCycle.startDate) : '-'}</div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button variant="outline" className="w-full border-[#c4c4c4] text-[#000000] bg-transparent">
                    Create Report
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full border-[#c4c4c4] text-[#000000] bg-transparent">
                        Replenish
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-[#000000]">Create New Cycle</AlertDialogTitle>
                        <AlertDialogDescription className="text-[#666666]">
                          Do you want to make a New Cycle? This will archive the current cycle and start fresh with the configured petty cash amount.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="border-[#c4c4c4] text-[#000000] bg-transparent hover:bg-[#fafafa] w-full sm:w-auto">
                          No
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleReplenishConfirm}
                          className="bg-[#737fff] hover:bg-[#5a5fff] text-white w-full sm:w-auto"
                        >
                          Yes
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    className="w-full bg-[#737fff] hover:bg-[#5a5fff] text-white"
                    onClick={() => setIsAddExpenseOpen(true)}
                  >
                    Add Expense
                  </Button>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="bg-white rounded-lg border border-[#e0e0e0] p-4 md:p-6 flex flex-col min-h-[500px] xl:min-h-[600px] w-full max-h-[700px]">
                <h2 className="text-lg font-medium text-[#000000] mb-4">Expenses</h2>

                {/* Search Bar */}
                <div className="relative mb-4 md:mb-6">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#a1a1a1] w-4 h-4" />
                  <Input placeholder="Search" className="pl-10 border-[#e0e0e0] bg-[#fafafa]" />
                </div>

                {/* Expense Cycles List */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full">
                  {isExpensesLoading ? (
                    <div className="text-center py-8 text-[#a1a1a1]">Loading expense cycles...</div>
                  ) : expenseCycles.length === 0 ? (
                    <div className="text-center py-8 text-[#a1a1a1]">No expense cycles found</div>
                  ) : (
                    expenseCycles.map((cycle, index) => {
                    const isExpanded = expandedCycles.includes(cycle.id)
                    return (
                      <div key={cycle.id} className={`bg-[#f6f9ff] rounded-lg border border-[#b8d9ff] w-full ${index > 0 ? 'mt-3' : ''}`}>
                        <div
                          className="flex items-center justify-between p-3 md:p-4 cursor-pointer"
                          onClick={() => toggleCycle(cycle.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[#000000] mb-1 text-sm md:text-base">Cycle#:{cycle.id}</div>
                            <div className="text-xs md:text-sm text-[#a1a1a1]">
                              <div>From: {cycle.from}</div>
                              <div>Until: {cycle.until}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 ml-2">
                            <div className="text-right">
                              <div className="font-medium text-[#000000] text-sm md:text-base">{(cycle.amount).toLocaleString() }</div>
                              <div className="text-xs md:text-sm text-[#a1a1a1]">Total Amount</div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-[#a1a1a1] flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-[#a1a1a1] flex-shrink-0" />
                            )}
                          </div>
                        </div>

                        {isExpanded && cycle.expenses.length > 0 && (
                          <div className="mt-2">
                            <div className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden max-h-64 overflow-y-auto">
                              <ResponsiveTable
                                data={cycle.expenses}
                                columns={[
                                  {
                                    header: "Item",
                                    accessorKey: "item",
                                    cell: (row) => (
                                      <a href="#" className="text-[#737fff] hover:underline text-sm">
                                        {row.item}
                                      </a>
                                    ),
                                    hideOnMobile: false,
                                  },
                                  {
                                    header: "Amount",
                                    accessorKey: "amount",
                                    cell: (row) => row.amount.toLocaleString(),
                                    hideOnMobile: false,
                                  },
                                  {
                                    header: "Date",
                                    accessorKey: "date",
                                    hideOnMobile: true,
                                  },
                                  {
                                    header: "Requested By",
                                    accessorKey: "requestedBy",
                                    hideOnMobile: true,
                                  },
                                  {
                                    header: "Actions",
                                    cell: () => (
                                      <button className="text-[#a1a1a1] hover:text-[#000000]">
                                        <MoreVertical className="w-4 h-4" />
                                      </button>
                                    ),
                                    hideOnMobile: false,
                                  },
                                ]}
                                keyField="item"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AddExpenseDialog
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSubmit={handleAddExpense}
      />

      <ConfigurationDialog
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveConfiguration}
        initialData={configData}
        isLoading={isConfigLoading}
      />
    </div>
  )
}