"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, X, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { searchProducts, type SearchResult } from "@/lib/algolia-service"
import { useDebounce } from "@/hooks/use-debounce"

interface ProductSearchBoxProps {
  companyId: string
  onSearchResults?: (results: SearchResult[], query: string, pagination?: { page: number; nbPages: number; nbHits: number }) => void
  onSearchError?: (error: string) => void
  onSearchLoading?: (isLoading: boolean) => void
  onSearchClear?: () => void
  placeholder?: string
  page?: number
  hitsPerPage?: number
}

export function ProductSearchBox({
  companyId,
  onSearchResults,
  onSearchError,
  onSearchLoading,
  onSearchClear,
  placeholder = "Search products...",
  page = 0,
  hitsPerPage = 20,
}: ProductSearchBoxProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 300)

  const handleClear = () => {
    setQuery("")
    setResults([])
    setError(null)

    // Notify parent components
    onSearchClear?.()
  }


  // Search when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults([])
        setError(null)

        // Notify parent components
        if (onSearchResults) onSearchResults([], "")
        if (onSearchError) onSearchError("")
        if (onSearchClear) onSearchClear()
        return
      }

      setError(null)

      try {
        console.log(`Performing product search for: "${debouncedQuery}" with company filter: ${companyId}`)
        const response = await searchProducts(debouncedQuery, companyId, page, hitsPerPage)

        // Check if we got a valid response
        if (response && Array.isArray(response.hits)) {
          setResults(response.hits)
          console.log(`Product search returned ${response.hits.length} results`)

          // Notify parent components of results
          if (onSearchResults) onSearchResults(response.hits, debouncedQuery, {
            page: response.page,
            nbPages: response.nbPages,
            nbHits: response.nbHits
          })

          // If there's an error but we still got results, show a warning
          if (response.error) {
            setError(response.error)
            if (onSearchError) onSearchError(response.error)
          } else {
            setError(null)
            if (onSearchError) onSearchError("")
          }
        } else {
          console.error("Invalid search response:", response)
          setResults([])
          setError(response.error || "Received invalid search results")

          // Notify parent components
          if (onSearchResults) onSearchResults([], debouncedQuery)
          if (onSearchError) onSearchError(response.error || "Received invalid search results")
        }
      } catch (error) {
        console.error("Product search error:", error)
        setResults([])
        setError("Failed to perform search")

        // Notify parent components
        if (onSearchResults) onSearchResults([], debouncedQuery)
        if (onSearchError) onSearchError("Failed to perform search")
      }
    }

    performSearch()
  }, [debouncedQuery, companyId, page, hitsPerPage, onSearchResults, onSearchError, onSearchClear])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }


  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b7b7b7]" />
        <Input
          type="text"
          placeholder={placeholder}
          className="h-11 pl-10 pr-10 text-sm border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all"
          value={query}
          onChange={handleInputChange}
        />
        {query && (
          <button
            type="button"
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full p-0 hover:bg-gray-100 text-gray-500 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && query && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}