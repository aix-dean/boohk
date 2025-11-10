import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountCreationPage from '@/app/register/page'

// Mock the auth context
const mockRegister = vi.fn()
const mockUser = null
const mockUserData = null
const mockGetRoleDashboardPath = vi.fn()

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: mockUser,
    userData: mockUserData,
    getRoleDashboardPath: mockGetRoleDashboardPath,
  }),
}))

// Mock Next.js router
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  query: vi.fn(),
  collection: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
}))

describe('AccountCreationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete('orgCode')
  })

  describe('User Registration Flow', () => {
    it('should render the registration form correctly', () => {
      render(<AccountCreationPage />)

      expect(screen.getByText("Let's create your account")).toBeInTheDocument()
      expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument()
      expect(screen.getByText('Confirm')).toBeInTheDocument()
    })

    it('should validate required fields', async () => {
      const user = userEvent.setup()
      render(<AccountCreationPage />)

      const submitButton = screen.getByText('Confirm')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Please fill in all required fields.')).toBeInTheDocument()
      })
    })

    it('should validate terms and conditions agreement', async () => {
      const user = userEvent.setup()
      render(<AccountCreationPage />)

      // Fill in required fields
      await user.type(screen.getByLabelText(/First Name/i), 'John')
      await user.type(screen.getByLabelText(/Last Name/i), 'Doe')
      await user.type(screen.getByLabelText(/Cellphone Number/i), '9123456789')
      await user.type(screen.getByLabelText(/Email Address/i), 'john.doe@example.com')
      await user.type(screen.getByLabelText(/Password/i), 'password123')
      await user.type(screen.getByLabelText(/Confirm Password/i), 'password123')

      const submitButton = screen.getByText('Confirm')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Please agree to the terms and conditions.')).toBeInTheDocument()
      })
    })

    it('should validate password confirmation', async () => {
      const user = userEvent.setup()
      render(<AccountCreationPage />)

      // Fill in required fields with mismatched passwords
      await user.type(screen.getByLabelText(/First Name/i), 'John')
      await user.type(screen.getByLabelText(/Last Name/i), 'Doe')
      await user.type(screen.getByLabelText(/Cellphone Number/i), '9123456789')
      await user.type(screen.getByLabelText(/Email Address/i), 'john.doe@example.com')
      await user.type(screen.getByLabelText(/Password/i), 'password123')
      await user.type(screen.getByLabelText(/Confirm Password/i), 'differentpassword')

      // Check terms checkbox
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      const submitButton = screen.getByText('Confirm')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
      })
    })

    it('should successfully register a new user', async () => {
      const user = userEvent.setup()
      mockRegister.mockResolvedValueOnce(undefined)

      render(<AccountCreationPage />)

      // Fill in all required fields
      await user.type(screen.getByLabelText(/First Name/i), 'John')
      await user.type(screen.getByLabelText(/Last Name/i), 'Doe')
      await user.type(screen.getByLabelText(/Cellphone Number/i), '9123456789')
      await user.type(screen.getByLabelText(/Email Address/i), 'john.doe@example.com')
      await user.type(screen.getByLabelText(/Password/i), 'password123')
      await user.type(screen.getByLabelText(/Confirm Password/i), 'password123')

      // Check terms checkbox
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      const submitButton = screen.getByText('Confirm')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(
          {
            email: 'john.doe@example.com',
            first_name: 'John',
            last_name: 'Doe',
            middle_name: '',
            phone_number: '+639123456789',
            gender: '',
          },
          {
            company_name: '',
            company_location: '',
          },
          'password123',
          undefined
        )
      })
    })

    it('should show welcome screen after successful registration', async () => {
      const user = userEvent.setup()
      mockRegister.mockResolvedValueOnce(undefined)

      render(<AccountCreationPage />)

      // Fill in all required fields
      await user.type(screen.getByLabelText(/First Name/i), 'John')
      await user.type(screen.getByLabelText(/Last Name/i), 'Doe')
      await user.type(screen.getByLabelText(/Cellphone Number/i), '9123456789')
      await user.type(screen.getByLabelText(/Email Address/i), 'john.doe@example.com')
      await user.type(screen.getByLabelText(/Password/i), 'password123')
      await user.type(screen.getByLabelText(/Confirm Password/i), 'password123')

      // Check terms checkbox
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      const submitButton = screen.getByText('Confirm')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Welcome aboard, John!')).toBeInTheDocument()
        expect(screen.getByText('Start Tour')).toBeInTheDocument()
      })
    })

    it('should handle invitation code registration', async () => {
      const user = userEvent.setup()
      mockSearchParams.set('orgCode', 'test-invitation-code')

      // Mock invitation data
      const mockInvitationData = {
        code: 'test-invitation-code',
        role: 'sales',
        invited_email: 'invited@example.com',
        max_usage: 1,
        used_by: [],
      }

      vi.mocked(require('firebase/firestore')).getDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{
          data: () => mockInvitationData,
        }],
      } as any)

      render(<AccountCreationPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('invited@example.com')).toBeInTheDocument()
      })

      // Fill in other required fields
      await user.type(screen.getByLabelText(/First Name/i), 'Jane')
      await user.type(screen.getByLabelText(/Last Name/i), 'Smith')
      await user.type(screen.getByLabelText(/Cellphone Number/i), '9876543210')
      await user.type(screen.getByLabelText(/Password/i), 'password123')
      await user.type(screen.getByLabelText(/Confirm Password/i), 'password123')

      // Check terms checkbox
      const termsCheckbox = screen.getByRole('checkbox')
      await user.click(termsCheckbox)

      mockRegister.mockResolvedValueOnce(undefined)

      const submitButton = screen.getByText('Confirm')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(
          {
            email: 'invited@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
            middle_name: '',
            phone_number: '+639876543210',
            gender: '',
          },
          {
            company_name: '',
            company_location: '',
          },
          'password123',
          'test-invitation-code'
        )
      })
    })
  })
})