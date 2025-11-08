"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, Search } from "lucide-react"

interface ProductInspectorProps {
  product: any
  title?: string
}

export function ProductInspector({ product, title = "Product Data Inspector" }: ProductInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Function to search for a key in an object (recursive)
  const searchForKey = (obj: any, term: string): string[] => {
    if (!obj || typeof obj !== "object") return []

    const results: string[] = []
    const queue = [{ path: "", object: obj }]

    while (queue.length > 0) {
      const { path, object } = queue.shift()!

      for (const key in object) {
        const currentPath = path ? `${path}.${key}` : key

        // Check if the key contains the search term
        if (key.toLowerCase().includes(term.toLowerCase())) {
          results.push(`${currentPath}: ${JSON.stringify(object[key])}`)
        }

        // Add nested objects to the queue
        if (object[key] && typeof object[key] === "object" && !Array.isArray(object[key])) {
          queue.push({ path: currentPath, object: object[key] })
        }
      }
    }

    return results
  }

  const searchResults = searchTerm ? searchForKey(product, searchTerm) : []

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 p-0">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for keys (e.g. 'site', 'code')"
              className="pl-8 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {searchTerm && searchResults.length > 0 && (
            <div className="mb-4 p-3 bg-muted rounded-md">
              <h3 className="text-sm font-medium mb-2">Search Results for "{searchTerm}":</h3>
              <ul className="space-y-1 text-xs">
                {searchResults.map((result, index) => (
                  <li key={index} className="font-mono">
                    {result}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-auto max-h-96">
            <pre className="text-xs">{JSON.stringify(product, null, 2)}</pre>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
