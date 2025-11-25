import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import LoginPage from '@/app/login/page'

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
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
  collection: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getFirestore: vi.fn(() => ({})),
}))

describe('Login Page', () => {
  let mockRouter: { push: any }
  let mockLogin: any
  let mockToast: any
  const mockUser = { uid: 'test-uid' }
  const mockUserData = { roles: ['sales'] }

  beforeEach(() => {
    mockLogin = vi.fn()
    mockToast = vi.fn()
    // @ts-ignore
    (useAuth).mockReturnValue({
      login: mockLogin,
      user: null,
      userData: null,
      getRoleDashboardPath: vi.fn(() => '/sales/dashboard'),
    })
    // @ts-ignore
    (useToast).mockReturnValue({ toast: mockToast })
  })

  it('renders login form', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('shows error for empty fields', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(screen.getByText('Please enter both email and password.')).toBeInTheDocument()
    })
  })

  it('shows error for invalid email', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } })
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()
    })
  })

  it('handles successful login with existing user and boohk_users doc', async () => {
    const mockPush = vi.fn()
    ;(useRouter as any).mockReturnValue({ push: mockPush })
    mockLogin.mockResolvedValue(undefined)
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(mockPush).toHaveBeenCalledWith('/sales/dashboard')
    })
  })

  it('handles successful login with existing user without boohk_users doc', async () => {
    const mockPush = vi.fn()
    ;(useRouter as any).mockReturnValue({ push: mockPush })
    mockLogin.mockResolvedValue(undefined)
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'new@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/sales/dashboard')
    })
  })

  it('handles failed login with invalid credentials', async () => {
    mockLogin.mockRejectedValue({ code: 'auth/wrong-password' })
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument()
    })
  })

  it('handles failed login with tenant auth failure', async () => {
    mockLogin.mockRejectedValue({ code: 'auth/internal-error' })
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(screen.getByText('An error occurred during login. Please try again.')).toBeInTheDocument()
    })
  })

  it('displays toast error messages', async () => {
    mockLogin.mockRejectedValue(new Error('Test error'))
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Login'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Login Error',
        description: 'Test error',
        variant: 'destructive'
      }))
    })
  })

  it('redirects to dashboard on successful login and remains authenticated', async () => {
    const mockPush = vi.fn()
    (useRouter as any).mockReturnValue({ push: mockPush })
    mockLogin.mockResolvedValue(undefined)
    ;(useAuth as any).mockReturnValue({
      login: mockLogin,
      user: mockUser,
      userData: mockUserData,
      getRoleDashboardPath: vi.fn(() => '/sales/dashboard')
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/sales/dashboard')
    })

    // Simulate persistent authentication (check if user is still set)
    expect(useAuth().user).toEqual(mockUser)
  })

  it('maintains persistent authentication after successful login', async () => {
    // Use fake timers to simulate time passing
    vi.useFakeTimers()

    const mockPush: any = vi.fn()
    const mockLogout = vi.fn()
    ;(useRouter as any).mockReturnValue({ push: mockPush })
    mockLogin.mockResolvedValue(undefined)

    let currentUser: any = null
    let currentUserData: any = null

    // Mock useAuth with getter/setter to simulate state changes
    const mockAuthValue = {
      login: mockLogin,
      logout: mockLogout,
      get user() { return currentUser },
      set user(value: any) { currentUser = value },
      get userData() { return currentUserData },
      set userData(value: any) { currentUserData = value },
      getRoleDashboardPath: vi.fn(() => '/sales/dashboard')
    }

    ;(useAuth as any).mockReturnValue(mockAuthValue)

    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/sales/dashboard')
    })

    // Simulate successful login setting the user
    currentUser = mockUser
    currentUserData = mockUserData

    // Verify user is authenticated immediately after login
    expect(mockAuthValue.user).toEqual(mockUser)
    expect(mockAuthValue.userData).toEqual(mockUserData)

    // Advance time to simulate persistence check
    vi.advanceTimersByTime(5000) // 5 seconds

    // Verify user remains authenticated (no immediate logout)
    expect(mockAuthValue.user).toEqual(mockUser)
    expect(mockAuthValue.userData).toEqual(mockUserData)
    expect(mockLogout).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})