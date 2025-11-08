"use client"

import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import type { Proposal } from "@/lib/types/proposal"

interface ProposalViewerDialogProps {
  isOpen: boolean
  onClose: () => void
  proposal: Proposal
}

export function ProposalViewerDialog({ isOpen, onClose, proposal }: ProposalViewerDialogProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Mock proposal pages - in real implementation, this would come from the proposal data
  const totalPages = 5

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[95vh] p-0 gap-0 bg-white rounded-2xl border border-gray-200">
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-500">
              {proposal.proposalNumber || proposal.code || "SUM0075"}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{proposal.title || "Summit Media"}</h2>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-6">
          <div className="relative w-full max-w-3xl">
            {/* Main document container with multiple page preview */}
            <div className="space-y-4">
              {/* Primary document page */}
              <div className="relative bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="aspect-[8.5/11] bg-gray-50">
                  {/* Mock document content matching the image design */}
                  <div className="w-full h-full p-8 flex flex-col">
                    {/* Header section */}
                    <div className="h-6 bg-gray-200 rounded mb-6"></div>

                    {/* Content area with two-column layout */}
                    <div className="flex-1 space-y-6">
                      <div className="h-20 bg-gray-100 rounded-lg"></div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="h-4 bg-gray-300 rounded"></div>
                          <div className="h-4 bg-gray-300 rounded"></div>
                          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-300 rounded"></div>
                          <div className="h-3 bg-gray-300 rounded"></div>
                          <div className="h-3 bg-gray-300 rounded w-4/5"></div>
                          <div className="h-3 bg-gray-300 rounded w-3/5"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4 bg-gray-700 text-white px-3 py-1 rounded-md text-sm font-medium shadow-sm">
                  Page {currentPage}
                </div>

                {/* Navigation arrows */}
                {totalPages > 1 && (
                  <>
                    <Button
                      onClick={prevPage}
                      disabled={currentPage === 1}
                      variant="ghost"
                      size="sm"
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 p-0 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white disabled:opacity-50 border border-gray-200"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>

                    <Button
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                      variant="ghost"
                      size="sm"
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 p-0 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:bg-white disabled:opacity-50 border border-gray-200"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>

              <div className="bg-gray-100 border border-gray-200 rounded-lg h-16 flex items-center justify-center">
                <div className="text-gray-400 text-sm">
                  Page {currentPage + 1 <= totalPages ? currentPage + 1 : 1} Preview
                </div>
              </div>
            </div>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-all duration-200 ${
                    currentPage === page
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {page}
                </button>
              ))}
              {totalPages > 7 && (
                <>
                  <span className="text-gray-400 px-2">...</span>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-all duration-200 ${
                      currentPage === totalPages
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
