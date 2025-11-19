import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { PriceHistoryDialog } from "@/components/price-history-dialog"

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  X: ({ size, ...props }: any) => <svg data-testid="x-icon" width={size} {...props} />,
  Loader2: ({ size, ...props }: any) => <svg data-testid="loader-icon" width={size} {...props} />,
}))

describe("PriceHistoryDialog", () => {
  const mockProps = {
    rowDialogOpen: true,
    setRowDialogOpen: vi.fn(),
    selectedRowProduct: {
      id: "test-product-id",
      name: "Test Product",
      price: 1000,
    },
    priceHistories: {
      "test-product-id": [
        {
          id: "history-1",
          price: 900,
          created: { seconds: Date.now() / 1000 },
          name: "John Doe",
        },
      ],
    },
    loadingPriceHistories: new Set(),
    newPriceInDialog: "1,000",
    setNewPriceInDialog: vi.fn(),
    showUpdateForm: true,
    setShowUpdateForm: vi.fn(),
    isUpdatingPriceInDialog: false,
    handleUpdatePriceInDialog: vi.fn(),
    getSiteCode: vi.fn(() => "TEST-001"),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the dialog when open", () => {
    render(<PriceHistoryDialog {...mockProps} />)
    expect(screen.getByText("Price History")).toBeInTheDocument()
  })

  it("displays product information", () => {
    render(<PriceHistoryDialog {...mockProps} />)
    expect(screen.getByText("Test Product")).toBeInTheDocument()
    expect(screen.getByText("TEST-001")).toBeInTheDocument()
    expect(screen.getByText("Current Price")).toBeInTheDocument()
  })

  it("shows price history table", () => {
    render(<PriceHistoryDialog {...mockProps} />)
    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Date")).toBeInTheDocument()
    expect(screen.getByText("By")).toBeInTheDocument()
  })

  it("displays historical price data", () => {
    render(<PriceHistoryDialog {...mockProps} />)
    expect(screen.getByText("₱900")).toBeInTheDocument()
    expect(screen.getByText("John Doe")).toBeInTheDocument()
  })

  it("shows update form when showUpdateForm is true", () => {
    render(<PriceHistoryDialog {...mockProps} />)
    expect(screen.getByText("New Price")).toBeInTheDocument()
    expect(screen.getByText("Php")).toBeInTheDocument()
  })

  it("calls setRowDialogOpen when close button is clicked", () => {
    render(<PriceHistoryDialog {...mockProps} />)
    const closeButton = screen.getByTestId("x-icon")
    fireEvent.click(closeButton)
    expect(mockProps.setRowDialogOpen).toHaveBeenCalledWith(false)
  })

  it("shows loading state when price history is loading", () => {
    const loadingProps = {
      ...mockProps,
      loadingPriceHistories: new Set(["test-product-id"]),
    }
    render(<PriceHistoryDialog {...loadingProps} />)
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument()
    expect(screen.getByText("Loading price history...")).toBeInTheDocument()
  })

  it("shows empty state when no history available", () => {
    const emptyProps = {
      ...mockProps,
      priceHistories: {},
    }
    render(<PriceHistoryDialog {...emptyProps} />)
    expect(screen.getByText("No price history available")).toBeInTheDocument()
  })

  it("does not render when dialog is closed", () => {
    const closedProps = {
      ...mockProps,
      rowDialogOpen: false,
    }
    const { container } = render(<PriceHistoryDialog {...closedProps} />)
    expect(container.firstChild).toBeNull()
  })
})