"use client"

import { useState } from "react"
import { ArrowLeft, Search, X, Plus } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AdminDocumentsPage() {
  const [searchValue, setSearchValue] = useState("")

  const clearSearch = () => {
    setSearchValue("")
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Link href="/sales/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl md:text-2xl font-bold">Documents</h1>
        </div>

        {/* Tabs and Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Tabs defaultValue="contracts" className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger
                value="contracts"
                className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600"
              >
                Contracts
              </TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Create Contract
            </Button>
            <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50 bg-transparent">
              Templates
            </Button>
            <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50 bg-transparent">
              Drafts
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search documents..."
            className="pl-10 pr-10"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
              onClick={clearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Content Area */}
        <Tabs defaultValue="contracts" className="flex-1">
          <TabsContent value="contracts" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-600 mb-2">No contracts yet.</p>
              <Link href="#" className="text-blue-600 hover:text-blue-800 underline">
                Add Template?
              </Link>
            </div>
          </TabsContent>
          <TabsContent value="invoices" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-600 mb-2">No invoices yet.</p>
              <Link href="#" className="text-blue-600 hover:text-blue-800 underline">
                Add Template?
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
