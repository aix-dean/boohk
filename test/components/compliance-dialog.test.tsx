import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ComplianceDialog } from '@/components/compliance-dialog'

// Mock dependencies
const mockOnOpenChange = vi.fn()
const mockOnFileUpload = vi.fn()
const mockOnAccept = vi.fn()
const mockOnDecline = vi.fn()
const mockOnMarkAsReserved = vi.fn()

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, disabled }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/pdf-viewer', () => ({
  PDFViewer: ({ fileUrl }: any) => <div data-testid="pdf-viewer" data-file-url={fileUrl}>PDF Viewer</div>,
}))

vi.mock('@/lib/utils', () => ({
  getProjectCompliance: vi.fn(() => ({
    completed: 0,
    total: 5,
    toReserve: [],
    otherRequirements: [],
  })),
}))

vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon" />,
  Upload: () => <div data-testid="upload-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
}))

describe('ComplianceDialog', () => {
  const mockQuotation = {
    id: 'test-quotation-id',
    projectCompliance: {
      signedContract: {
        fileUrl: 'https://example.com/contract.pdf',
        fileName: 'contract.pdf',
        status: 'uploaded',
        completed: false,
      },
      paymentAsDeposit: {
        fileUrl: undefined,
        status: 'confirmation',
        completed: false,
      },
      irrevocablePo: {
        fileUrl: 'https://example.com/po.pdf',
        fileName: 'po.pdf',
        status: 'accepted',
        completed: true,
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('File Viewer Dialog', () => {
    it('shows accept and decline buttons for incomplete items', async () => {
      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={mockQuotation}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
        />
      )

      // Click on the signed contract file to open viewer
      const contractFile = screen.getByText('contract.pdf')
      fireEvent.click(contractFile)

      // Wait for the file viewer dialog to open
      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
      })

      // Should show Accept and Decline buttons for incomplete item
      expect(screen.getByText('Accept')).toBeInTheDocument()
      expect(screen.getByText('Decline')).toBeInTheDocument()
    })

    it('hides accept and decline buttons for completed/accepted items', async () => {
      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={mockQuotation}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
        />
      )

      // Click on the irrevocable PO file to open viewer (this item is accepted/completed)
      const poFile = screen.getByText('po.pdf')
      fireEvent.click(poFile)

      // Wait for the file viewer dialog to open
      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
      })

      // Should NOT show Accept and Decline buttons for completed/accepted item
      expect(screen.queryByText('Accept')).not.toBeInTheDocument()
      expect(screen.queryByText('Decline')).not.toBeInTheDocument()
    })

    it('hides accept and decline buttons when in viewOnly mode', async () => {
      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={mockQuotation}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
          viewOnly={true}
        />
      )

      // Click on the signed contract file to open viewer
      const contractFile = screen.getByText('contract.pdf')
      fireEvent.click(contractFile)

      // Wait for the file viewer dialog to open
      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
      })

      // Should NOT show Accept and Decline buttons in viewOnly mode
      expect(screen.queryByText('Accept')).not.toBeInTheDocument()
      expect(screen.queryByText('Decline')).not.toBeInTheDocument()
    })

    it('calls onAccept when accept button is clicked', async () => {
      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={mockQuotation}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
        />
      )

      // Click on the signed contract file to open viewer
      const contractFile = screen.getByText('contract.pdf')
      fireEvent.click(contractFile)

      // Wait for the file viewer dialog to open
      await waitFor(() => {
        expect(screen.getByText('Accept')).toBeInTheDocument()
      })

      // Click accept button
      const acceptButton = screen.getByText('Accept')
      fireEvent.click(acceptButton)

      expect(mockOnAccept).toHaveBeenCalledWith('test-quotation-id', 'signedContract')
    })

    it('calls onDecline when decline button is clicked', async () => {
      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={mockQuotation}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
        />
      )

      // Click on the signed contract file to open viewer
      const contractFile = screen.getByText('contract.pdf')
      fireEvent.click(contractFile)

      // Wait for the file viewer dialog to open
      await waitFor(() => {
        expect(screen.getByText('Decline')).toBeInTheDocument()
      })

      // Click decline button
      const declineButton = screen.getByText('Decline')
      fireEvent.click(declineButton)

      expect(mockOnDecline).toHaveBeenCalledWith('test-quotation-id', 'signedContract')
    })
  })

  describe('Dialog Rendering', () => {
    it('renders compliance dialog with correct title', () => {
      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={mockQuotation}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
        />
      )

      expect(screen.getByText('Compliance')).toBeInTheDocument()
      expect(screen.getByText('(0/5)')).toBeInTheDocument()
    })

    it('renders compliance items', () => {
      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={mockQuotation}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
        />
      )

      expect(screen.getByText('Signed Contract')).toBeInTheDocument()
      expect(screen.getByText('Payment as Deposit')).toBeInTheDocument()
      expect(screen.getByText('Irrevocable PO/MO')).toBeInTheDocument()
    })

    it('shows sent by information when sent_by field exists', async () => {
      const quotationWithSentBy = {
        ...mockQuotation,
        projectCompliance: {
          ...mockQuotation.projectCompliance,
          signedContract: {
            ...mockQuotation.projectCompliance.signedContract,
            sent_by: 'John Doe',
          },
        },
      }

      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={quotationWithSentBy}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
        />
      )

      // Click on the signed contract file to open viewer
      const contractFile = screen.getByText('contract.pdf')
      fireEvent.click(contractFile)

      // Wait for the file viewer dialog to open
      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
      })

      // Should show "Sent by" information since sent_by field exists
      expect(screen.getByText('Sent by:')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('hides sent by information when sent_by field is missing or empty', async () => {
      const quotationWithoutSentBy = {
        ...mockQuotation,
        projectCompliance: {
          ...mockQuotation.projectCompliance,
          signedContract: {
            ...mockQuotation.projectCompliance.signedContract,
            sent_by: undefined,
          },
        },
      }

      render(
        <ComplianceDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          quotation={quotationWithoutSentBy}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          onAccept={mockOnAccept}
          onDecline={mockOnDecline}
          onMarkAsReserved={mockOnMarkAsReserved}
          userEmail="test@example.com" // Even with userEmail, it should be hidden since sent_by is missing
        />
      )

      // Click on the signed contract file to open viewer
      const contractFile = screen.getByText('contract.pdf')
      fireEvent.click(contractFile)

      // Wait for the file viewer dialog to open
      await waitFor(() => {
        expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
      })

      // Should NOT show "Sent by" information since sent_by field is missing (no fallback to userEmail)
      expect(screen.queryByText('Sent by:')).not.toBeInTheDocument()
    })
  })
})