import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import LoginPage from '@/app/login/page'
import { DepartmentDropdown } from '@/components/department-dropdown'
import { onSnapshot, collection, query, where } from 'firebase/firestore'

// Mock all dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  getAuth: vi.fn(() => ({})),
}))

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getFirestore: vi.fn(() => ({})),
}))

describe('Non-Admin Login with Restricted Department Visibility', () => {
  let mockRouter: { push: ReturnType<typeof vi.fn> }
  let mockLogin: ReturnType<typeof vi.fn>
  let mockToast: ReturnType<typeof vi.fn>
  let mockUnsubscribe: ReturnType<typeof vi.fn>
  let mockOnSnapshot: ReturnType<typeof vi.fn>

  const mockUser = { uid: 'test-non-admin-uid', email: 'nonadmin@example.com' }
  const mockUserData = {
    uid: 'test-non-admin-uid',
    email: 'nonadmin@example.com',
    roles: ['sales', 'it'],
    role: 'sales'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouter = { push: vi.fn() }
    mockLogin = vi.fn()
    mockToast = vi.fn()
    mockUnsubscribe = vi.fn()
    mockOnSnapshot = vi.fn()

    // @ts-ignore
    (useRouter as any).mockReturnValue(mockRouter)
    // @ts-ignore
    (useAuth as any).mockReturnValue({
      login: mockLogin,
      user: null,
      userData: null,
      getRoleDashboardPath: vi.fn(() => '/sales/dashboard'),
    })
    // @ts-ignore
    (useToast as any).mockReturnValue({ toast: mockToast })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('completes full login flow and shows restricted department visibility', async () => {
    // Step 1: Mock successful login
    mockLogin.mockResolvedValue(undefined)

    // Step 2: Render login page and perform login
    render(<LoginPage />)

    // Fill in login form
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'nonadmin@example.com' }
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' }
    })

    // Submit login
    fireEvent.click(screen.getByText('Login'))

    // Verify login was called with correct credentials
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('nonadmin@example.com', 'password123')
    })

    // Verify redirect to sales dashboard
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/sales/dashboard')
    })

    // Step 3: Test department dropdown with restricted visibility
    // Mock Firestore query for user roles (sales and it only)
    const mockQuerySnapshot = {
      forEach: vi.fn((callback) => {
        callback({
          data: () => ({ roleId: 'sales', userId: 'test-non-admin-uid' })
        })
        callback({
          data: () => ({ roleId: 'it', userId: 'test-non-admin-uid' })
        })
      })
    }

    mockOnSnapshot.mockImplementation((query, callback) => {
      callback(mockQuerySnapshot)
      return mockUnsubscribe
    })

    // Update auth context to simulate logged-in state
    // @ts-ignore
    (useAuth).mockReturnValue({
      login: mockLogin,
      user: mockUser,
      userData: mockUserData,
      getRoleDashboardPath: vi.fn(() => '/sales/dashboard'),
    })

    // Re-render with department dropdown
    const { rerender } = render(<DepartmentDropdown />)

    // Wait for Firestore query to complete
    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled()
    })

    // Verify only assigned departments are shown
    await waitFor(() => {
      expect(screen.getByText('Sales')).toBeInTheDocument()
      expect(screen.getByText('IT')).toBeInTheDocument()
    })

    // Verify restricted departments are NOT shown
    expect(screen.queryByText('Business Dev')).not.toBeInTheDocument()
    expect(screen.queryByText('Accounting')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    expect(screen.queryByText('Logistics')).not.toBeInTheDocument()
    expect(screen.queryByText('Treasury')).not.toBeInTheDocument()
    expect(screen.queryByText('Finance')).not.toBeInTheDocument()
    expect(screen.queryByText('CMS')).not.toBeInTheDocument()

    // Verify dropdown is enabled (has multiple roles)
    const dropdownButton = screen.getByRole('button')
    expect(dropdownButton).not.toBeDisabled()
  })

  it('handles login failure appropriately', async () => {
    // Mock login failure
    mockLogin.mockRejectedValue({ code: 'auth/wrong-password' })

    render(<LoginPage />)

    // Fill in login form
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'nonadmin@example.com' }
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrongpassword' }
    })

    // Submit login
    fireEvent.click(screen.getByText('Login'))

    // Verify error message is shown
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument()
    })

    // Verify no redirect occurred
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('shows single department without dropdown for user with one role', async () => {
    // Mock user with only sales role
    const singleRoleUserData = {
      uid: 'single-role-uid',
      email: 'single@example.com',
      roles: ['sales'],
      role: 'sales'
    }

    // Mock Firestore query for single role
    const mockQuerySnapshot = {
      forEach: vi.fn((callback) => {
        callback({
          data: () => ({ roleId: 'sales', userId: 'single-role-uid' })
        })
      })
    }

    mockOnSnapshot.mockImplementation((query, callback) => {
      callback(mockQuerySnapshot)
      return mockUnsubscribe
    })

    // @ts-ignore
    (useAuth).mockReturnValue({
      login: mockLogin,
      user: { uid: 'single-role-uid', email: 'single@example.com' },
      userData: singleRoleUserData,
      getRoleDashboardPath: vi.fn(() => '/sales/dashboard'),
    })

    render(<DepartmentDropdown />)

    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled()
    })

    // Verify only Sales is shown
    await waitFor(() => {
      expect(screen.getByText('Sales')).toBeInTheDocument()
    })

    // Verify dropdown is disabled (single role)
    const dropdownButton = screen.getByRole('button')
    expect(dropdownButton).toBeDisabled()

    // Verify no dropdown arrow is shown
    expect(screen.queryByTestId('chevron-down')).not.toBeInTheDocument()
  })
})