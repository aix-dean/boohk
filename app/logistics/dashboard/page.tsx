"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, List, Grid3X3, X, Loader2 } from "lucide-react"
import AllSitesTab from "./all-sites"
import { useAuth } from "@/contexts/auth-context"
import { RouteProtection } from "@/components/route-protection"

export default function LogisticsDashboardPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [contentTypeFilter, setContentTypeFilter] = useState("Static")
  const [activeTab, setActiveTab] = useState<'Static' | 'Digital'>('Static')
  const { user, userData } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const clearSearch = () => {
    setSearchQuery("")
  }

  return (
    <RouteProtection requiredRoles="logistics">
      <div className="flex-1 overflow-auto relative bg-gray-50">
        <main className="p-6">
          <div className="flex flex-col gap-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {userData?.first_name
                  ? `${userData.first_name.charAt(0).toUpperCase()}${userData.first_name.slice(1).toLowerCase()}'s Dashboard`
                  : "Dashboard"}
              </h1>
              <Button
                onClick={() => {
                  setIsLoading(true)
                  router.push("/logistics/assignments/create")
                  setTimeout(() => setIsLoading(false), 1000)
                }}
                disabled={isLoading}
                className="bg-[#737fff] hover:bg-[#9393ff] text-white px-6 py-3"
              >
                {isLoading ? (
                  <>
                    Create SA..
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  "Create SA"
                )}
              </Button>
            </div>

            {/* Controls Section */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Search and Filter */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search sites..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10 bg-white border-gray-200"
                    />
                    {searchQuery && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Content Type Filter */}
                  <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                    <SelectTrigger className="w-32 bg-white border-gray-200">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      <SelectItem value="Static">Static</SelectItem>
                      <SelectItem value="Dynamic">Dynamic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 w-8 p-0"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 p-0"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Tab Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setActiveTab('Static'); setContentTypeFilter('Static'); }}
                  className={`px-6 py-1 rounded-lg ${activeTab === 'Static' ? 'bg-green-500 text-white' : 'border-2 border-gray-200 text-black'}`}
                >
                  Static
                </button>
                <button
                  onClick={() => { setActiveTab('Digital'); setContentTypeFilter('Dynamic'); }}
                  className={`px-6 py-1 rounded-lg ${activeTab === 'Digital' ? 'bg-green-500 text-white' : 'border-2 border-gray-200 text-black'}`}
                >
                  Digital
                </button>
              </div>
            </div>

            {/* All Sites Display */}
              <AllSitesTab searchQuery={searchQuery} contentTypeFilter={contentTypeFilter} viewMode={viewMode} />
            
          </div>
        </main>

      </div>
    </RouteProtection>
  )
}
