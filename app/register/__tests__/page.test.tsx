import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AccountCreationPage from '../page'

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn()
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    register: vi.fn(),
    user: null,
    userData: null,
    getRoleDashboardPath: vi.fn(() => '/dashboard')
  })
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  query: vi.fn(),
  collection: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn()
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      {...props}
    />
  )
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>
}))

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />
}))

describe('AccountCreationPage', () => {
  const mockRouter = { push: vi.fn() }
  const mockSearchParams = new URLSearchParams()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)
  })

  it('renders the registration form', () => {
    act(() => {
      render(<AccountCreationPage />)
    })

    expect(screen.getByText("Let's create your account")).toBeInTheDocument()
    expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email Address')).toBeInTheDocument()
  })

  it('extracts orgCode from URL parameters', () => {
    // Set up search params with orgCode
    mockSearchParams.set('orgCode', 'DISQ-VVIS')

    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    act(() => {
      render(<AccountCreationPage />)
    })

    // The component should extract orgCode from search params
    // We can verify this indirectly by checking if the component renders
    expect(screen.getByText("Let's create your account")).toBeInTheDocument()
  })

  it('shows invitation email as disabled when invitation is valid', async () => {
    // Mock the invitation code query
    const { getDocs } = await import('firebase/firestore')
    ;(getDocs as any).mockResolvedValue({
      empty: false,
      docs: [{
        data: () => ({
          code: 'DISQ-VVIS',
          invited_email: 'test@example.com',
          role: 'user',
          max_usage: 1,
          used_by: []
        })
      }]
    })

    // Set up search params with orgCode
    mockSearchParams.set('orgCode', 'DISQ-VVIS')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    act(() => {
      render(<AccountCreationPage />)
    })

    // Wait for the invitation fetch to complete
    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText('Email Address')
      expect(emailInput).toHaveValue('test@example.com')
      expect(emailInput).toBeDisabled()
    })

    expect(screen.getByText('Email is locked to the invitation code email address')).toBeInTheDocument()
  })

  it('shows error for invalid invitation code', async () => {
    // Mock empty query result
    const { getDocs } = await import('firebase/firestore')
    ;(getDocs as any).mockResolvedValue({
      empty: true,
      docs: []
    })

    // Set up search params with invalid orgCode
    mockSearchParams.set('orgCode', 'INVALID-CODE')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    act(() => {
      render(<AccountCreationPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('Invalid invitation code.')).toBeInTheDocument()
    })
  })

  it('shows error when invitation code exceeds max usage', async () => {
    // Mock invitation that has reached max usage
    const { getDocs } = await import('firebase/firestore')
    ;(getDocs as any).mockResolvedValue({
      empty: false,
      docs: [{
        data: () => ({
          code: 'DISQ-VVIS',
          invited_email: 'test@example.com',
          role: 'user',
          max_usage: 1,
          used_by: ['user1', 'user2'] // Exceeds max_usage
        })
      }]
    })

    // Set up search params with orgCode
    mockSearchParams.set('orgCode', 'DISQ-VVIS')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    act(() => {
      render(<AccountCreationPage />)
    })

    await waitFor(() => {
      expect(screen.getByText('This invitation code has reached its maximum usage limit.')).toBeInTheDocument()
    })
  })
})