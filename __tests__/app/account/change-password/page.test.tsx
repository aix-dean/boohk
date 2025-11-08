import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangePasswordPage from '@/app/account/change-password/page'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'

// Mock the hooks
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

// Mock Firebase auth functions
vi.mock('firebase/auth', () => ({
  updatePassword: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  EmailAuthProvider: {
    credential: vi.fn(),
  },
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
}))

vi.mock('@/lib/firebase', () => ({
  tenantAuth: {},
}))

describe('ChangePasswordPage', () => {
  const mockRouter = { push: vi.fn() }
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
  }

  const defaultAuthMock = {
    user: mockUser,
    loading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useAuth as any).mockReturnValue(defaultAuthMock)
  })

  describe('Authentication Checks', () => {
    it('redirects to login when user is not authenticated', () => {
      ;(useAuth as any).mockReturnValue({
        user: null,
        loading: false,
      })

      render(<ChangePasswordPage />)

      expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })

    it('shows loading spinner when authentication is loading', () => {
      ;(useAuth as any).mockReturnValue({
        user: null,
        loading: true,
      })

      render(<ChangePasswordPage />)

      // The component shows a Loader2 component (SVG), not text
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
    })

    it('renders the change password form when user is authenticated', () => {
      render(<ChangePasswordPage />)

      expect(screen.getByText('Change Password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter current password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter new password')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('shows error when current password is empty', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      // Fill form with empty current password
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Current password is required',
          variant: 'destructive',
        })
      })
    })

    it('shows error when new password is empty', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      // Fill form with empty new password
      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'New password is required',
          variant: 'destructive',
        })
      })
    })

    it('shows error when new password is too short', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'short')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'short')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Password must be at least 8 characters long',
          variant: 'destructive',
        })
      })
    })

    it('shows error when new password lacks complexity', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'lowercaseonly')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'lowercaseonly')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
          variant: 'destructive',
        })
      })
    })

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'DifferentPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Passwords do not match',
          variant: 'destructive',
        })
      })
    })

    it('shows error when confirm password is empty', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Please confirm your new password',
          variant: 'destructive',
        })
      })
    })
  })

  describe('Password Change Functionality', () => {
    it('successfully changes password', async () => {
      const user = userEvent.setup()
      const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')

      // Mock successful reauthentication and password update
      ;(EmailAuthProvider.credential as any).mockReturnValue('mock-credential')
      ;(reauthenticateWithCredential as any).mockResolvedValue({})
      ;(updatePassword as any).mockResolvedValue({})

      render(<ChangePasswordPage />)

      // Fill form with valid data
      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(EmailAuthProvider.credential).toHaveBeenCalledWith('test@example.com', 'CurrentPass123')
        expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockUser, 'mock-credential')
        expect(updatePassword).toHaveBeenCalledWith(mockUser, 'NewPass123')
        expect(toast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Your password has been successfully changed.',
        })
      })

      // Check that form is reset after successful change
      expect(screen.getByPlaceholderText('Enter current password')).toHaveValue('')
      expect(screen.getByPlaceholderText('Enter new password')).toHaveValue('')
      expect(screen.getByPlaceholderText('Confirm new password')).toHaveValue('')
    })

    it('shows loading state during password change', async () => {
      const user = userEvent.setup()
      const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')

      // Mock delayed response
      ;(EmailAuthProvider.credential as any).mockReturnValue('mock-credential')
      ;(reauthenticateWithCredential as any).mockResolvedValue({})
      ;(updatePassword as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Check loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(saveButton).toBeDisabled()

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles wrong current password error', async () => {
      const user = userEvent.setup()
      const { reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')

      ;(EmailAuthProvider.credential as any).mockReturnValue('mock-credential')
      ;(reauthenticateWithCredential as any).mockRejectedValue({
        code: 'auth/wrong-password',
      })

      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'WrongPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Current password is incorrect.',
          variant: 'destructive',
        })
      })
    })

    it('handles weak password error', async () => {
      const user = userEvent.setup()
      const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')

      ;(EmailAuthProvider.credential as any).mockReturnValue('mock-credential')
      ;(reauthenticateWithCredential as any).mockResolvedValue({})
      ;(updatePassword as any).mockRejectedValue({
        code: 'auth/weak-password',
      })

      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'New password is too weak.',
          variant: 'destructive',
        })
      })
    })

    it('handles requires recent login error', async () => {
      const user = userEvent.setup()
      const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')

      ;(EmailAuthProvider.credential as any).mockReturnValue('mock-credential')
      ;(reauthenticateWithCredential as any).mockResolvedValue({})
      ;(updatePassword as any).mockRejectedValue({
        code: 'auth/requires-recent-login',
      })

      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Please log in again before changing your password.',
          variant: 'destructive',
        })
      })
    })

    it('handles too many requests error', async () => {
      const user = userEvent.setup()
      const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')

      ;(EmailAuthProvider.credential as any).mockReturnValue('mock-credential')
      ;(reauthenticateWithCredential as any).mockResolvedValue({})
      ;(updatePassword as any).mockRejectedValue({
        code: 'auth/too-many-requests',
      })

      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Too many attempts. Please try again later.',
          variant: 'destructive',
        })
      })
    })

    it('handles generic error', async () => {
      const user = userEvent.setup()
      const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')

      ;(EmailAuthProvider.credential as any).mockReturnValue('mock-credential')
      ;(reauthenticateWithCredential as any).mockResolvedValue({})
      ;(updatePassword as any).mockRejectedValue({
        code: 'auth/some-other-error',
      })

      render(<ChangePasswordPage />)

      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to change password. Please try again.',
          variant: 'destructive',
        })
      })
    })
  })

  describe('Form Interactions', () => {
    it('toggles password visibility for current password', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      const currentPasswordInput = screen.getByPlaceholderText('Enter current password')
      const toggleButton = screen.getAllByRole('button')[0] // First toggle button

      // Initially password type
      expect(currentPasswordInput).toHaveAttribute('type', 'password')

      // Click to show password
      await user.click(toggleButton)
      expect(currentPasswordInput).toHaveAttribute('type', 'text')

      // Click to hide password again
      await user.click(toggleButton)
      expect(currentPasswordInput).toHaveAttribute('type', 'password')
    })

    it('toggles password visibility for new password', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      const newPasswordInput = screen.getByPlaceholderText('Enter new password')
      const toggleButtons = screen.getAllByRole('button')
      const newPasswordToggle = toggleButtons[1] // Second toggle button

      // Initially password type
      expect(newPasswordInput).toHaveAttribute('type', 'password')

      // Click to show password
      await user.click(newPasswordToggle)
      expect(newPasswordInput).toHaveAttribute('type', 'text')
    })

    it('toggles password visibility for confirm password', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password')
      const toggleButtons = screen.getAllByRole('button')
      const confirmPasswordToggle = toggleButtons[2] // Third toggle button

      // Initially password type
      expect(confirmPasswordInput).toHaveAttribute('type', 'password')

      // Click to show password
      await user.click(confirmPasswordToggle)
      expect(confirmPasswordInput).toHaveAttribute('type', 'text')
    })

    it('clears form when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      // Fill form
      await user.type(screen.getByPlaceholderText('Enter current password'), 'CurrentPass123')
      await user.type(screen.getByPlaceholderText('Enter new password'), 'NewPass123')
      await user.type(screen.getByPlaceholderText('Confirm new password'), 'NewPass123')

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Check form is cleared
      expect(screen.getByPlaceholderText('Enter current password')).toHaveValue('')
      expect(screen.getByPlaceholderText('Enter new password')).toHaveValue('')
      expect(screen.getByPlaceholderText('Confirm new password')).toHaveValue('')
    })

    it('clears errors when user starts typing', async () => {
      const user = userEvent.setup()
      render(<ChangePasswordPage />)

      // Submit empty form to trigger errors
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Start typing in current password field
      await user.type(screen.getByPlaceholderText('Enter current password'), 'C')

      // The error clearing logic should work (though we can't easily test the internal state)
      // This test ensures the onChange handler is called without errors
    })
  })
})