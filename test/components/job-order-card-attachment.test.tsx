import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobOrderCard } from '@/components/logistics/assignments/create/JobOrderCard'

// Mock dependencies
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, ...props }: any) => (
    <button onClick={onClick} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => <div className={className} data-testid="scroll-area">{children}</div>,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div onClick={onClick} data-testid="dropdown-menu-item">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-menu-trigger">{children}</div>,
}))

vi.mock('lucide-react', () => ({
  MoreVertical: () => <div data-testid="more-vertical-icon" />,
}))

vi.mock('./JobOrderSelectionDialog', () => ({
  JobOrderSelectionDialog: () => <div data-testid="job-order-selection-dialog" />,
}))

describe('JobOrderCard - Attachment Display', () => {
  const mockOnHideJobOrderCard = vi.fn()

  const defaultProps = {
    company_id: 'test-company-id',
    product_id: 'test-product-id',
    onHideJobOrderCard: mockOnHideJobOrderCard,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays attachment image from job_orders.attachments.url when job order has attachments', () => {
    // Mock fetch to return a job order with attachments
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 'test-job-order-id',
            joNumber: 'JO-001',
            siteName: 'Test Site',
            jobDescription: 'Test Job',
            campaignName: 'Test Campaign',
            attachments: {
              url: 'https://example.com/attachment-image.jpg',
              name: 'attachment-image.jpg',
              type: 'image/jpeg',
            },
          },
        ]),
      })
    )

    render(<JobOrderCard {...defaultProps} />)

    // Click the "Identify JO" button to load job orders
    const identifyButton = screen.getByText('Identify JO')
    identifyButton.click()

    // Wait for the job orders to load and select one
    setTimeout(() => {
      const jobOrderButton = screen.getByText('JO#: JO-001 - Test Site - Test Job')
      jobOrderButton.click()

      // Check that the attachment image is displayed with the correct src
      const attachmentImage = screen.getByAltText('Attachment')
      expect(attachmentImage).toHaveAttribute('src', 'https://example.com/attachment-image.jpg')
    }, 0)
  })

  it('displays fallback image when job order has no attachments', () => {
    // Mock fetch to return a job order without attachments
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 'test-job-order-id',
            joNumber: 'JO-001',
            siteName: 'Test Site',
            jobDescription: 'Test Job',
            campaignName: 'Test Campaign',
            attachments: null,
          },
        ]),
      })
    )

    render(<JobOrderCard {...defaultProps} />)

    // Click the "Identify JO" button to load job orders
    const identifyButton = screen.getByText('Identify JO')
    identifyButton.click()

    // Wait for the job orders to load and select one
    setTimeout(() => {
      const jobOrderButton = screen.getByText('JO#: JO-001 - Test Site - Test Job')
      jobOrderButton.click()

      // Check that the fallback image is displayed
      const attachmentImage = screen.getByAltText('Attachment')
      expect(attachmentImage).toHaveAttribute('src', '/logistics-sa-create-dl.png')
    }, 0)
  })
})