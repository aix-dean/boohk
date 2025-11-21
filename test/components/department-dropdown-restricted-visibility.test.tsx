import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DepartmentDropdown } from '@/components/department-dropdown'
import { useAuth } from '@/contexts/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { onSnapshot, collection, query, where } from 'firebase/firestore'

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
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
}))

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}))

describe('Department Dropdown - Non-Admin Restricted Visibility', () => {
  let mockRouter: { push: ReturnType<typeof vi.fn> }
  let mockPathname: string
  let mockUnsubscribe: ReturnType<typeof vi.fn>
  let mockOnSnapshot: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouter = { push: vi.fn() }
    mockPathname = '/sales/dashboard'
    mockUnsubscribe = vi.fn()

    // @ts-ignore
    (useRouter).mockReturnValue(mockRouter)
    // @ts-ignore
    (usePathname).mockReturnValue(mockPathname)

    mockOnSnapshot = vi.fn()
    // @ts-ignore
    onSnapshot.mockReturnValue(mockUnsubscribe)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('shows only assigned departments for non-admin user with sales and it roles', async () => {
    const mockUserData = {
      uid: 'test-user-uid',
      email: 'test@example.com',
      roles: ['sales', 'it'],
      role: 'sales'
    }

    // Mock Firestore query to return sales and it roles
    const mockQuerySnapshot = {
      forEach: vi.fn((callback) => {
        // Simulate documents for sales and it roles
        callback({
          data: () => ({ roleId: 'sales', userId: 'test-user-uid' })
        })
        callback({
          data: () => ({ roleId: 'it', userId: 'test-user-uid' })
        })
      })
    }

    mockOnSnapshot.mockImplementation((query, callback) => {
      callback(mockQuerySnapshot)
      return mockUnsubscribe
    })

    // @ts-ignore
    (useAuth).mockReturnValue({
      userData: mockUserData
    })

    render(<DepartmentDropdown />)

    // Wait for the component to process the roles
    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled()
    })

    // Check that only Sales and IT departments are shown (filtered from allowed departments)
    await waitFor(() => {
      expect(screen.getByText('Sales')).toBeInTheDocument()
      expect(screen.getByText('IT')).toBeInTheDocument()
    })

    // Verify that other departments are not shown
    expect(screen.queryByText('Business Dev')).not.toBeInTheDocument()
    expect(screen.queryByText('Accounting')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows only assigned departments for non-admin user with single sales role', async () => {
    const mockUserData = {
      uid: 'test-user-uid',
      email: 'test@example.com',
      roles: ['sales'],
      role: 'sales'
    }

    // Mock Firestore query to return only sales role
    const mockQuerySnapshot = {
      forEach: vi.fn((callback) => {
        callback({
          data: () => ({ roleId: 'sales', userId: 'test-user-uid' })
        })
      })
    }

    mockOnSnapshot.mockImplementation((query, callback) => {
      callback(mockQuerySnapshot)
      return mockUnsubscribe
    })

    // @ts-ignore
    (useAuth).mockReturnValue({
      userData: mockUserData
    })

    render(<DepartmentDropdown />)

    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled()
    })

    // Check that only Sales department is shown
    await waitFor(() => {
      expect(screen.getByText('Sales')).toBeInTheDocument()
    })

    // Verify that other departments are not shown
    expect(screen.queryByText('IT')).not.toBeInTheDocument()
    expect(screen.queryByText('Business Dev')).not.toBeInTheDocument()
    expect(screen.queryByText('Accounting')).not.toBeInTheDocument()
  })

  it('shows no dropdown for user with no roles', async () => {
    const mockUserData = {
      uid: 'test-user-uid',
      email: 'test@example.com',
      roles: [],
      role: null
    }

    // Mock empty query snapshot
    const mockQuerySnapshot = {
      forEach: vi.fn(() => {}) // No documents
    }

    mockOnSnapshot.mockImplementation((query, callback) => {
      callback(mockQuerySnapshot)
      return mockUnsubscribe
    })

    // @ts-ignore
    (useAuth).mockReturnValue({
      userData: mockUserData
    })

    const { container } = render(<DepartmentDropdown />)

    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled()
    })

    // Component should not render anything
    expect(container.firstChild).toBeNull()
  })

  it('shows all departments for admin user', async () => {
    const mockUserData = {
      uid: 'admin-user-uid',
      email: 'admin@example.com',
      roles: ['admin', 'sales', 'it', 'business'],
      role: 'admin'
    }

    // Mock Firestore query to return admin and other roles
    const mockQuerySnapshot = {
      forEach: vi.fn((callback) => {
        callback({
          data: () => ({ roleId: 'admin', userId: 'admin-user-uid' })
        })
        callback({
          data: () => ({ roleId: 'sales', userId: 'admin-user-uid' })
        })
        callback({
          data: () => ({ roleId: 'it', userId: 'admin-user-uid' })
        })
      })
    }

    mockOnSnapshot.mockImplementation((query, callback) => {
      callback(mockQuerySnapshot)
      return mockUnsubscribe
    })

    // @ts-ignore
    (useAuth).mockReturnValue({
      userData: mockUserData
    })

    render(<DepartmentDropdown />)

    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled()
    })

    // Admin should see all departments (Sales, IT, Business Dev, Accounting)
    await waitFor(() => {
      expect(screen.getByText('Sales')).toBeInTheDocument()
      expect(screen.getByText('IT')).toBeInTheDocument()
      expect(screen.getByText('Business Dev')).toBeInTheDocument()
      expect(screen.getByText('Accounting')).toBeInTheDocument()
    })
  })
})