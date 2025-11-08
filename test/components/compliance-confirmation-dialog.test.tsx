import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComplianceConfirmationDialog } from '@/components/compliance-confirmation-dialog'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  Upload: () => <div data-testid="upload-icon" />,
  X: () => <div data-testid="x-icon" />,
}))

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}))

describe('ComplianceConfirmationDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnSkip = vi.fn()
  const mockOnFileUpload = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dialog Rendering', () => {
    it('renders dialog when isOpen is true', () => {
      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={[]}
        />
      )

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByText('Project Compliance')).toBeInTheDocument()
      expect(screen.getByText('This client has some missing project compliance requirements:')).toBeInTheDocument()
    })

    it('does not render dialog when isOpen is false', () => {
      render(
        <ComplianceConfirmationDialog
          isOpen={false}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={[]}
        />
      )

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })
  })

  describe('Compliance Items Filtering', () => {
    it('shows only incomplete items without files', () => {
      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: false,
          type: 'upload' as const,
          key: 'signedContract',
          file: undefined,
        },
        {
          name: 'Payment as Deposit',
          completed: true,
          type: 'confirmation' as const,
          key: 'paymentAsDeposit',
          file: undefined,
        },
        {
          name: 'Final Artwork',
          completed: false,
          type: 'upload' as const,
          key: 'finalArtwork',
          file: 'artwork.pdf',
        },
        {
          name: 'Irrevocable PO',
          completed: false,
          type: 'upload' as const,
          key: 'irrevocablePo',
          file: undefined,
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      // Should show only "Signed Contract" and "Irrevocable PO" (incomplete and no file)
      expect(screen.getByText('Signed Contract')).toBeInTheDocument()
      expect(screen.getByText('Irrevocable PO')).toBeInTheDocument()

      // Should not show completed or items with files
      expect(screen.queryByText('Payment as Deposit')).not.toBeInTheDocument()
      expect(screen.queryByText('Final Artwork')).not.toBeInTheDocument()
    })

    it('shows upload button for incomplete items without files', () => {
      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: false,
          type: 'upload' as const,
          key: 'signedContract',
          file: undefined,
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      const uploadButtons = screen.getAllByTestId('button')
      const uploadButton = uploadButtons.find(button => button.textContent?.includes('Upload'))
      expect(uploadButton).toBeInTheDocument()
    })

    it('shows confirmation text for confirmation type items', () => {
      const complianceItems = [
        {
          name: 'Payment as Deposit',
          completed: false,
          type: 'confirmation' as const,
          key: 'paymentAsDeposit',
          file: undefined,
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      expect(screen.getByText('For Treasury\'s confirmation')).toBeInTheDocument()
    })
  })

  describe('File Upload Functionality', () => {
    it('calls onFileUpload when upload button is clicked', () => {
      // Mock the file input creation and click
      const mockInput = {
        type: 'file',
        accept: '.pdf',
        click: vi.fn(),
        onchange: null as any,
      }

      // Mock document.createElement
      const originalCreateElement = document.createElement
      document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'input') {
          return mockInput as any
        }
        return originalCreateElement.call(document, tagName)
      })

      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: false,
          type: 'upload' as const,
          key: 'signedContract',
          file: undefined,
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      const uploadButtons = screen.getAllByTestId('button')
      const uploadButton = uploadButtons.find(button => button.textContent?.includes('Upload'))
      fireEvent.click(uploadButton!)

      expect(mockInput.click).toHaveBeenCalled()

      // Restore original createElement
      document.createElement = originalCreateElement
    })

    it('shows uploading state when item is being uploaded', () => {
      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: false,
          type: 'upload' as const,
          key: 'signedContract',
          file: undefined,
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set(['test-quotation-id-signedContract'])}
          quotationId="test-quotation-id"
        />
      )

      expect(screen.getByText('Uploading...')).toBeInTheDocument()
    })
  })

  describe('Dialog Actions', () => {
    it('calls onClose when close button is clicked', () => {
      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={[]}
        />
      )

      const closeButton = screen.getAllByTestId('button')[0] // First button is close
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('calls onSkip when acknowledge and skip button is clicked', () => {
      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={[]}
        />
      )

      const skipButton = screen.getByText('Acknowledge and Skip')
      fireEvent.click(skipButton)

      expect(mockOnSkip).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty compliance items array', () => {
      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={[]}
        />
      )

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByText('Acknowledge and Skip')).toBeInTheDocument()
    })

    it('handles undefined uploadingFiles', () => {
      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: false,
          type: 'upload' as const,
          key: 'signedContract',
          file: undefined,
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          quotationId="test-quotation-id"
        />
      )

      expect(screen.getByText('Upload')).toBeInTheDocument()
    })
  })

  describe('Auto-Proceed Functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('automatically calls onSkip when all items become completed', () => {
      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: false,
          type: 'upload' as const,
          key: 'signedContract',
          file: undefined,
        },
        {
          name: 'Irrevocable PO',
          completed: false,
          type: 'upload' as const,
          key: 'irrevocablePo',
          file: undefined,
        },
      ]

      const { rerender } = render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      // Initially, onSkip should not be called
      expect(mockOnSkip).not.toHaveBeenCalled()

      // Update items to be completed
      const completedItems = [
        {
          name: 'Signed Contract',
          completed: true,
          type: 'upload' as const,
          key: 'signedContract',
          file: 'contract.pdf',
        },
        {
          name: 'Irrevocable PO',
          completed: true,
          type: 'upload' as const,
          key: 'irrevocablePo',
          file: 'po.pdf',
        },
      ]

      rerender(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={completedItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      // Fast-forward time by 1 second
      vi.advanceTimersByTime(1000)

      // onSkip should be called automatically
      expect(mockOnSkip).toHaveBeenCalledTimes(1)
    })

    it('does not auto-proceed when items are not all completed', () => {
      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: true,
          type: 'upload' as const,
          key: 'signedContract',
          file: 'contract.pdf',
        },
        {
          name: 'Irrevocable PO',
          completed: false,
          type: 'upload' as const,
          key: 'irrevocablePo',
          file: undefined,
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={true}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      // Fast-forward time by 1 second
      vi.advanceTimersByTime(1000)

      // onSkip should not be called since not all items are completed
      expect(mockOnSkip).not.toHaveBeenCalled()
    })

    it('does not auto-proceed when dialog is closed', () => {
      const complianceItems = [
        {
          name: 'Signed Contract',
          completed: true,
          type: 'upload' as const,
          key: 'signedContract',
          file: 'contract.pdf',
        },
      ]

      render(
        <ComplianceConfirmationDialog
          isOpen={false}
          onClose={mockOnClose}
          onSkip={mockOnSkip}
          complianceItems={complianceItems}
          onFileUpload={mockOnFileUpload}
          uploadingFiles={new Set()}
          quotationId="test-quotation-id"
        />
      )

      // Fast-forward time by 1 second
      vi.advanceTimersByTime(1000)

      // onSkip should not be called since dialog is closed
      expect(mockOnSkip).not.toHaveBeenCalled()
    })
  })
})