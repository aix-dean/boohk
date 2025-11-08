"use client"

import React from "react"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useResponsive } from "@/hooks/use-responsive"

interface Column<T> {
  header?: string
  accessorKey?: keyof T | ((row: T) => any)
  cell?: (row: T) => React.ReactNode
  className?: string
  hideOnMobile?: boolean
  // Support for the user management page column structure
  key?: string
  label?: string
  render?: (row: T) => React.ReactNode
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  keyField?: keyof T
  expandableContent?: (row: T) => React.ReactNode
  isLoading?: boolean
  emptyState?: React.ReactNode
  searchKey?: string
  searchPlaceholder?: string
}

export function ResponsiveTable<T>({
  data,
  columns,
  onRowClick,
  keyField = "id" as keyof T,
  expandableContent,
  isLoading = false,
  emptyState,
}: ResponsiveTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const { isMobile, isTablet } = useResponsive()

  const visibleColumns = isMobile ? columns.filter((column) => !column.hideOnMobile) : columns

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getValue = (row: T, column: Column<T>) => {
    if (column.render) {
      return column.render(row)
    }

    if (column.cell) {
      return column.cell(row)
    }

    if (typeof column.accessorKey === "function") {
      return column.accessorKey(row)
    }

    if (column.accessorKey) {
      return row[column.accessorKey]
    }

    return null
  }

  const getColumnHeader = (column: Column<T>) => {
    return column.header || column.label || ""
  }

  if (isLoading) {
    return (
      <div className="w-full h-40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (data.length === 0 && emptyState) {
    return emptyState
  }

  if (isMobile) {
    return (
      <div className="w-full space-y-4">
        {data.map((row, rowIndex) => {
          const rowId = row[keyField] ? String(row[keyField]) : String(rowIndex)
          const isExpanded = expandedRows[rowId]

          return (
            <div key={rowId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              {expandableContent && (
                <div className="flex justify-between items-center mb-2">
                  <button
                    onClick={() => toggleRow(rowId)}
                    className="p-1 rounded-full hover:bg-gray-200"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {columns.map((column, columnIndex) => {
                  const header = getColumnHeader(column)
                  return (
                    <div key={column.key || column.header || columnIndex} className="flex justify-between items-start">
                      {header !== "Actions" && (
                        <span className="font-medium text-gray-700 text-sm">{header}:</span>
                      )}
                      <div className={header === "Actions" ? "w-full" : "flex-1 ml-2 text-right"}>{getValue(row, column)}</div>
                    </div>
                  )
                })}
              </div>
              {expandableContent && isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {expandableContent(row)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {expandableContent && <TableHead className="w-[40px]"></TableHead>}
            {visibleColumns.map((column, index) => (
              <TableHead key={column.key || column.header || index} className={column.className}>
                {getColumnHeader(column)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => {
            const rowId = row[keyField] ? String(row[keyField]) : String(rowIndex)
            const isExpanded = expandedRows[rowId]

            return (
              <React.Fragment key={rowId}>
                <TableRow
                  className={cn(onRowClick && "cursor-pointer hover:bg-gray-50", isExpanded && "bg-gray-50")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {expandableContent && (
                    <TableCell
                      className="p-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleRow(rowId)
                      }}
                    >
                      <button className="p-1 rounded-full hover:bg-gray-200">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </TableCell>
                  )}
                  {visibleColumns.map((column, columnIndex) => (
                    <TableCell key={column.key || column.header || columnIndex} className={column.className}>
                      {getValue(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
                {expandableContent && isExpanded && (
                  <TableRow key={`${rowId}-expanded`} className="bg-gray-50">
                    <TableCell colSpan={visibleColumns.length + 1} className="p-4">
                      {expandableContent(row)}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
