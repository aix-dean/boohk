import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import JobOrderDetailsPage from '@/app/logistics/bulletin-board/details/[id]/page'
import { useParams, useRouter } from 'next/navigation'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}))

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  QueryDocumentSnapshot: vi.fn(),
  DocumentData: vi.fn(),
}))

// Mock CreateReportDialog
vi.mock('@/components/create-report-dialog', () => ({
  CreateReportDialog: ({ open }: { open: boolean }) => open ? <div>Create Report Dialog</div> : null,
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronDown: () => <div>ChevronDown</div>,
}))

const mockUseParams = useParams as any
const mockUseRouter = useRouter as any

describe('JobOrderDetailsPage', () => {
  let mockRouter: any

  beforeEach(() => {
    mockRouter = {
      back: vi.fn(),
    }
    mockUseRouter.mockReturnValue(mockRouter)
    mockUseParams.mockReturnValue({ id: 'test-id' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page with title', () => {
    render(<JobOrderDetailsPage />)
    expect(screen.getByText('← View Project Bulletin')).toBeInTheDocument()
  })

  it('navigates back when title is clicked', () => {
    render(<JobOrderDetailsPage />)
    const title = screen.getByText('← View Project Bulletin')
    fireEvent.click(title)
    expect(mockRouter.back).toHaveBeenCalled()
  })

  it('renders the Actions dropdown', () => {
    render(<JobOrderDetailsPage />)
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('displays loading state initially', () => {
    render(<JobOrderDetailsPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})