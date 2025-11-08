import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignaturePage from '@/app/account/signature/page'
import { useAuth } from '@/contexts/auth-context'
import { uploadSignature } from '@/lib/signature-service'
import { Timestamp } from 'firebase/firestore'

// Mock the hooks and services
vi.mock('lucide-react', () => ({
  SquarePen: vi.fn(() => <div data-testid="square-pen-icon" />),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/signature-service', () => ({
  uploadSignature: vi.fn(),
}))

vi.mock('@/components/SignatureEditDialog', () => ({
  default: ({ isOpen, onClose, onSave }: any) => {
    if (!isOpen) return null
    return (
      <div data-testid="signature-dialog">
        <button onClick={onClose} data-testid="close-dialog">Close</button>
        <button
          onClick={() => onSave({ type: 'text', data: 'Test Signature' })}
          data-testid="save-signature"
        >
          Save
        </button>
      </div>
    )
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  SquarePen: () => <div data-testid="square-pen-icon" />,
}))

vi.mock('firebase/firestore', () => ({
  Timestamp: class MockTimestamp {
    constructor() {}
    toDate() {
      return new Date()
    }
    static now() {
      return new MockTimestamp()
    }
    static fromDate(date: Date) {
      return new MockTimestamp()
    }
  },
}))

describe('SignaturePage', () => {
  const mockUserData = {
    uid: 'test-uid',
    email: 'test@example.com',
    signature: {
      url: 'https://example.com/signature.png',
      type: 'png' as const,
      updated: new Date(),
    },
  }

  const mockUpdateUserData = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as any).mockReturnValue({
      userData: mockUserData,
      updateUserData: mockUpdateUserData,
    })
  })

  describe('Page Rendering', () => {
    it('renders the signature page with title', () => {
      render(<SignaturePage />)

      expect(screen.getByText('Signature')).toBeInTheDocument()
    })

    it('displays existing signature image when user has PNG signature', () => {
      render(<SignaturePage />)

      const img = screen.getByRole('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/signature.png')
    })

    it.skip('displays text signature when user has text signature', () => {
      ;(useAuth as any).mockReturnValue({
        userData: {
          ...mockUserData,
          signature: {
            url: 'John Doe',
            type: 'text' as const,
            updated: new Date(),
          },
        },
        updateUserData: mockUpdateUserData,
      })

      render(<SignaturePage />)

      // The component now always renders an img element, even for text signatures
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'John Doe')
    })

    it('shows placeholder when no signature exists', () => {
      ;(useAuth as any).mockReturnValue({
        userData: {
          ...mockUserData,
          signature: undefined,
        },
        updateUserData: mockUpdateUserData,
      })

      render(<SignaturePage />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://placehold.co/256x256')
    })

    it('displays last updated date when signature exists', () => {
      const testDate = new Date('2023-01-01')
      ;(useAuth as any).mockReturnValue({
        userData: {
          ...mockUserData,
          signature: {
            ...mockUserData.signature,
            updated: testDate,
          },
        },
        updateUserData: mockUpdateUserData,
      })

      render(<SignaturePage />)

      expect(screen.getByText('Last Updated:')).toBeInTheDocument()
      expect(screen.getByText(testDate.toLocaleString())).toBeInTheDocument()
    })
  })

  describe('Dialog Interaction', () => {
    it('opens signature edit dialog when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<SignaturePage />)

      const editButton = screen.getByRole('button', { name: /edit signature/i })
      await user.click(editButton)

      expect(screen.getByTestId('signature-dialog')).toBeInTheDocument()
    })

    it('closes dialog when close button is clicked', async () => {
      const user = userEvent.setup()
      render(<SignaturePage />)

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit signature/i })
      await user.click(editButton)

      // Close dialog
      const closeButton = screen.getByTestId('close-dialog')
      await user.click(closeButton)

      expect(screen.queryByTestId('signature-dialog')).not.toBeInTheDocument()
    })
  })

  describe('Signature Saving', () => {
    it.skip('successfully saves text signature', async () => {
      const user = userEvent.setup()
      ;(uploadSignature as any).mockResolvedValue('uploaded-url')

      render(<SignaturePage />)

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit signature/i })
      await user.click(editButton)

      // Save signature
      const saveButton = screen.getByTestId('save-signature')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpdateUserData).toHaveBeenCalledWith({
          signature: {
            url: 'uploaded-url',
            updated: expect.any(Date),
          },
        })
      })
    })

    it('successfully saves PNG signature', async () => {
      const user = userEvent.setup()
      const mockDataURL = 'data:image/png;base64,test'
      const mockDownloadURL = 'https://firebase.com/signature.png'
      ;(uploadSignature as any).mockResolvedValue(mockDownloadURL)

      // Override the mock for this specific test
      const SignatureEditDialog = (await import('@/components/SignatureEditDialog')).default
      const originalImplementation = SignatureEditDialog

      // Temporarily replace the implementation
      ;(await import('@/components/SignatureEditDialog')).default = ({ isOpen, onClose, onSave }: any) => {
        if (!isOpen) return null
        return (
          <div data-testid="signature-dialog">
            <button onClick={onClose} data-testid="close-dialog">Close</button>
            <button
              onClick={() => onSave({ type: 'png', data: mockDataURL })}
              data-testid="save-png-signature"
            >
              Save PNG
            </button>
          </div>
        )
      }

      render(<SignaturePage />)

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit signature/i })
      await user.click(editButton)

      // Save PNG signature
      const saveButton = screen.getByTestId('save-png-signature')
      await user.click(saveButton)

      await waitFor(() => {
        expect(uploadSignature).toHaveBeenCalledWith(mockDataURL, 'test-uid')
        expect(mockUpdateUserData).toHaveBeenCalledWith({
          signature: {
            url: mockDownloadURL,
            updated: expect.any(Date),
          },
        })
      })

      // Restore original implementation
      ;(await import('@/components/SignatureEditDialog')).default = originalImplementation
    })

    it('handles signature upload errors', async () => {
      const user = userEvent.setup()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(uploadSignature as any).mockRejectedValue(new Error('Upload failed'))

      // Override the mock for this specific test
      const SignatureEditDialog = (await import('@/components/SignatureEditDialog')).default
      const originalImplementation = SignatureEditDialog

      // Temporarily replace the implementation
      ;(await import('@/components/SignatureEditDialog')).default = ({ isOpen, onClose, onSave }: any) => {
        if (!isOpen) return null
        return (
          <div data-testid="signature-dialog">
            <button onClick={onClose} data-testid="close-dialog">Close</button>
            <button
              onClick={() => onSave({ type: 'png', data: 'data:image/png;base64,test' })}
              data-testid="save-png-signature"
            >
              Save PNG
            </button>
          </div>
        )
      }

      render(<SignaturePage />)

      // Open dialog
      const editButton = screen.getByRole('button', { name: /edit signature/i })
      await user.click(editButton)

      // Save PNG signature
      const saveButton = screen.getByTestId('save-png-signature')
      await user.click(saveButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error saving signature:', expect.any(Error))
      })

      consoleSpy.mockRestore()

      // Restore original implementation
      ;(await import('@/components/SignatureEditDialog')).default = originalImplementation
    })
  })

  describe('Image Loading States', () => {
    it('shows loading spinner for PNG signatures initially', () => {
      ;(useAuth as any).mockReturnValue({
        userData: {
          ...mockUserData,
          signature: {
            ...mockUserData.signature,
            type: 'png',
          },
        },
        updateUserData: mockUpdateUserData,
      })

      render(<SignaturePage />)

      // The loader is shown when isImageLoading is true, which happens for PNG types initially
      const loader = document.querySelector('.animate-spin')
      expect(loader).toBeInTheDocument()
    })

    it('hides loading spinner after image loads', async () => {
      render(<SignaturePage />)

      const img = screen.getByRole('img')

      // Simulate image load
      fireEvent.load(img)

      await waitFor(() => {
        const loader = document.querySelector('.animate-spin')
        expect(loader).not.toBeInTheDocument()
      })
    })

    it('hides loading spinner on image error', async () => {
      render(<SignaturePage />)

      const img = screen.getByRole('img')

      // Simulate image error
      fireEvent.error(img)

      await waitFor(() => {
        const loader = document.querySelector('.animate-spin')
        expect(loader).not.toBeInTheDocument()
      })
    })
  })

  describe('Authentication Checks', () => {
    it('renders without user data', () => {
      ;(useAuth as any).mockReturnValue({
        userData: null,
        updateUserData: mockUpdateUserData,
      })

      expect(() => render(<SignaturePage />)).not.toThrow()
    })
  })
})