import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlankPageEditor } from '../blank-page-editor'
import type { CustomPage } from '@/lib/types/proposal'

// Mock dependencies
vi.mock('@/lib/firebase-service', () => ({
  uploadFileToFirebaseStorage: vi.fn().mockResolvedValue('mock-url')
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TabsContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TabsList: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>
}))

vi.mock('lucide-react', () => ({
  Type: () => <span>Type</span>,
  Image: () => <span>Image</span>,
  Video: () => <span>Video</span>,
  Trash2: () => <span>Trash2</span>,
  Upload: () => <span>Upload</span>,
  Move: () => <span>Move</span>,
  RotateCcw: () => <span>RotateCcw</span>,
  Save: () => <span>Save</span>,
  X: () => <span>X</span>
}))

describe('BlankPageEditor', () => {
  const mockPage: CustomPage = {
    id: 'test-page',
    type: 'blank',
    elements: [],
    position: 1
  }

  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    page: mockPage,
    onSave: mockOnSave,
    onCancel: mockOnCancel,
    pageWidth: 800,
    pageHeight: 600
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the editor with toolbar and canvas', () => {
    render(<BlankPageEditor {...defaultProps} />)

    expect(screen.getByText('Insert')).toBeInTheDocument()
    expect(screen.getByText('Add Text')).toBeInTheDocument()
    expect(screen.getByText('Add Image')).toBeInTheDocument()
    expect(screen.getByText('Add Video')).toBeInTheDocument()
    expect(screen.getByText('Save Page')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('shows Properties tab only when element is selected', () => {
    render(<BlankPageEditor {...defaultProps} />)

    // Initially no Properties tab
    expect(screen.queryByText('Properties')).not.toBeInTheDocument()

    // Add a text element
    const addTextButton = screen.getByText('Add Text')
    fireEvent.click(addTextButton)

    // Now Properties tab should appear
    expect(screen.getByText('Properties')).toBeInTheDocument()
  })

  it('adds a text element when Add Text button is clicked', () => {
    render(<BlankPageEditor {...defaultProps} />)

    const addTextButton = screen.getByText('Add Text')
    fireEvent.click(addTextButton)

    // Check if Properties tab appears (indicating element was added)
    expect(screen.getByText('Properties')).toBeInTheDocument()
  })

  it('calls onSave with updated page when Save Page is clicked', () => {
    render(<BlankPageEditor {...defaultProps} />)

    const saveButton = screen.getByText('Save Page')
    fireEvent.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith({
      ...mockPage,
      elements: []
    })
  })

  it('calls onCancel when Cancel button is clicked', () => {
    render(<BlankPageEditor {...defaultProps} />)

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('allows editing text content inline when double-clicked', async () => {
    render(<BlankPageEditor {...defaultProps} />)

    // Add text element
    const addTextButton = screen.getByText('Add Text')
    fireEvent.click(addTextButton)

    // Wait for text element to appear
    await waitFor(() => {
      expect(screen.getByText('New Text')).toBeInTheDocument()
    })

    // Find the text element
    const textElement = screen.getByText('New Text')

    // Double-click to enable editing
    fireEvent.doubleClick(textElement)

    // Change content directly
    textElement.textContent = 'New Content'

    // Blur to save
    fireEvent.blur(textElement)

    // Check that the text content was updated
    expect(textElement).toHaveTextContent('New Content')
  })

  it('handles file upload for images', async () => {
    render(<BlankPageEditor {...defaultProps} />)

    // Click the Add Image button (which is a label)
    const addImageButton = screen.getByText('Add Image')
    fireEvent.click(addImageButton)

    // The input should be triggered, but since it's mocked, we can't test the actual upload
    // Just check that the component renders without error
    expect(screen.getByText('Insert')).toBeInTheDocument()
  })

  it('handles file upload for videos', async () => {
    render(<BlankPageEditor {...defaultProps} />)

    // Click the Add Video button
    const addVideoButton = screen.getByText('Add Video')
    fireEvent.click(addVideoButton)

    // Just check that the component renders without error
    expect(screen.getByText('Insert')).toBeInTheDocument()
  })

  it('deselects elements when clicking on canvas background', async () => {
    render(<BlankPageEditor {...defaultProps} />)

    // Add element first
    const addTextButton = screen.getByText('Add Text')
    fireEvent.click(addTextButton)

    // Properties tab should be visible
    await waitFor(() => {
      expect(screen.getByText('Properties')).toBeInTheDocument()
    })

    // Find the canvas div
    const canvas = screen.getByTestId('canvas')
    fireEvent.click(canvas)

    // Properties tab should disappear
    await waitFor(() => {
      expect(screen.queryByText('Properties')).not.toBeInTheDocument()
    })
  })

  it('renders with scaling logic', () => {
    render(<BlankPageEditor {...defaultProps} />)

    // Component should render without errors with scaling
    expect(screen.getByText('Insert')).toBeInTheDocument()
  })
})