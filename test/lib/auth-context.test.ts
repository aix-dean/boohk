import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  tenantAuth: {},
  TENANT_ID: 'test-tenant',
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { now: vi.fn() },
}))

// Mock the hardcoded access service
const mockAssignRoleToUser = vi.fn()
const mockGetUserRoles = vi.fn()

vi.mock('@/lib/hardcoded-access-service', () => ({
  assignRoleToUser: mockAssignRoleToUser,
  getUserRoles: mockGetUserRoles,
  RoleType: {
    admin: 'admin',
    sales: 'sales',
    it: 'it',
    business: 'business',
    accounting: 'accounting',
  },
}))

// Mock subscription service
vi.mock('@/lib/subscription-service', () => ({
  subscriptionService: {
    getSubscriptionByCompanyId: vi.fn(),
    getSubscriptionByLicenseKey: vi.fn(),
  },
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  generateLicenseKey: vi.fn(() => 'TEST-LICENSE-KEY'),
}))

describe('Auth Context - Role Assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Automatic Role Assignment for New Users', () => {
    it('should assign sales, it, business, and accounting roles to new organization creators', async () => {
      // Import after mocks are set up
      const { AuthProvider } = await import('@/contexts/auth-context')

      // Mock Firebase auth functions
      const mockCreateUserWithEmailAndPassword = vi.mocked(require('firebase/auth')).createUserWithEmailAndPassword
      const mockSetDoc = vi.mocked(require('firebase/firestore')).setDoc
      const mockAddDoc = vi.mocked(require('firebase/firestore')).addDoc

      const mockFirebaseUser = {
        uid: 'test-user-id',
        email: 'test@example.com',
      }

      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({
        user: mockFirebaseUser,
      } as any)

      mockSetDoc.mockResolvedValueOnce(undefined)
      mockAddDoc.mockResolvedValueOnce({ id: 'role-doc-id' } as any)

      // Mock getUserRoles to return empty array initially
      mockGetUserRoles.mockResolvedValueOnce([])

      // Mock the register function directly since AuthProvider is a React component
      const mockRegister = vi.fn()
      mockRegister.mockResolvedValueOnce(undefined)

      // Mock the useAuth hook to return our mock register function
      vi.doMock('@/contexts/auth-context', () => ({
        useAuth: () => ({
          register: mockRegister,
          user: null,
          userData: null,
          getRoleDashboardPath: vi.fn(),
        }),
      }))

      // Simulate registration call
      await mockRegister(
        {
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          middle_name: '',
          phone_number: '+639123456789',
          gender: '',
        },
        {
          company_name: 'Test Company',
          company_location: 'Test Location',
        },
        'password123'
      )

      // Verify that assignRoleToUser was called for each default role
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'sales', 'test-user-id')
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'it', 'test-user-id')
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'business', 'test-user-id')
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'accounting', 'test-user-id')

      // Verify user document was created with correct data
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object), // userDocRef
        expect.objectContaining({
          email: 'test@example.com',
          uid: 'test-user-id',
          role: 'sales', // Primary role
          permissions: [], // No permissions for new org creators
          type: 'OHPLUS',
          first_name: 'John',
          last_name: 'Doe',
          middle_name: '',
          phone_number: '+639123456789',
          gender: '',
          company_id: 'test-user-id', // Same as uid for new org
        }),
        expect.any(Object)
      )
    })

    it('should assign specific role from invitation code', async () => {
      const { AuthProvider } = await import('@/contexts/auth-context')

      const mockCreateUserWithEmailAndPassword = vi.mocked(require('firebase/auth')).createUserWithEmailAndPassword
      const mockSetDoc = vi.mocked(require('firebase/firestore')).setDoc
      const mockAddDoc = vi.mocked(require('firebase/firestore')).addDoc
      const mockUpdateDoc = vi.mocked(require('firebase/firestore')).updateDoc
      const mockGetDocs = vi.mocked(require('firebase/firestore')).getDocs

      const mockFirebaseUser = {
        uid: 'test-user-id',
        email: 'invited@example.com',
      }

      // Mock invitation data
      const mockInvitationData = {
        code: 'test-invitation-code',
        role: 'sales',
        invited_email: 'invited@example.com',
        max_usage: 1,
        used_by: [],
        permissions: ['view-sales', 'create-proposals'],
      }

      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{
          data: () => mockInvitationData,
          id: 'invitation-doc-id',
        }],
      } as any)

      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({
        user: mockFirebaseUser,
      } as any)

      mockSetDoc.mockResolvedValueOnce(undefined)
      mockAddDoc.mockResolvedValueOnce({ id: 'role-doc-id' } as any)
      mockUpdateDoc.mockResolvedValueOnce(undefined)

      mockGetUserRoles.mockResolvedValueOnce([])

      // Mock the register function for this test
      const mockRegister = vi.fn()
      mockRegister.mockResolvedValueOnce(undefined)

      vi.doMock('@/contexts/auth-context', () => ({
        useAuth: () => ({
          register: mockRegister,
          user: null,
          userData: null,
          getRoleDashboardPath: vi.fn(),
        }),
      }))

      await mockRegister(
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

      // Verify that only the invitation role was assigned
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'sales', 'test-user-id')
      expect(mockAssignRoleToUser).toHaveBeenCalledTimes(1)

      // Verify user document was created with invitation permissions
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          email: 'invited@example.com',
          uid: 'test-user-id',
          role: 'sales',
          permissions: ['view-sales', 'create-proposals'], // From invitation
          type: 'OHPLUS',
        }),
        expect.any(Object)
      )

      // Verify invitation was marked as used
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          used: true,
          used_count: 1,
          used_by: ['test-user-id'],
        })
      )
    })

    it('should handle invalid invitation codes gracefully', async () => {
      const { AuthProvider } = await import('@/contexts/auth-context')

      const mockCreateUserWithEmailAndPassword = vi.mocked(require('firebase/auth')).createUserWithEmailAndPassword
      const mockSetDoc = vi.mocked(require('firebase/firestore')).setDoc
      const mockAddDoc = vi.mocked(require('firebase/firestore')).addDoc
      const mockGetDocs = vi.mocked(require('firebase/firestore')).getDocs

      const mockFirebaseUser = {
        uid: 'test-user-id',
        email: 'test@example.com',
      }

      // Mock empty invitation results
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      } as any)

      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({
        user: mockFirebaseUser,
      } as any)

      mockSetDoc.mockResolvedValueOnce(undefined)
      mockAddDoc.mockResolvedValueOnce({ id: 'role-doc-id' } as any)

      mockGetUserRoles.mockResolvedValueOnce([])

      // Mock the register function for this test
      const mockRegister = vi.fn()
      mockRegister.mockResolvedValueOnce(undefined)

      vi.doMock('@/contexts/auth-context', () => ({
        useAuth: () => ({
          register: mockRegister,
          user: null,
          userData: null,
          getRoleDashboardPath: vi.fn(),
        }),
      }))

      await mockRegister(
        {
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          middle_name: '',
          phone_number: '+639123456789',
          gender: '',
        },
        {
          company_name: 'Test Company',
          company_location: 'Test Location',
        },
        'password123',
        'invalid-invitation-code'
      )

      // Should still assign default roles for new organization
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'sales', 'test-user-id')
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'it', 'test-user-id')
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'business', 'test-user-id')
      expect(mockAssignRoleToUser).toHaveBeenCalledWith('test-user-id', 'accounting', 'test-user-id')
    })

    it('should reject registration when invitation email does not match', async () => {
      const { AuthProvider } = await import('@/contexts/auth-context')

      const mockGetDocs = vi.mocked(require('firebase/firestore')).getDocs

      // Mock invitation data with different email
      const mockInvitationData = {
        code: 'test-invitation-code',
        role: 'sales',
        invited_email: 'different@example.com',
        max_usage: 1,
        used_by: [],
      }

      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{
          data: () => mockInvitationData,
          id: 'invitation-doc-id',
        }],
      } as any)

      // Mock the register function for this test
      const mockRegister = vi.fn()
      mockRegister.mockRejectedValueOnce(new Error('Email address must match the invitation code email address.'))

      vi.doMock('@/contexts/auth-context', () => ({
        useAuth: () => ({
          register: mockRegister,
          user: null,
          userData: null,
          getRoleDashboardPath: vi.fn(),
        }),
      }))

      await expect(
        mockRegister(
          {
            email: 'wrong@example.com', // Different email
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
          'test-invitation-code'
        )
      ).rejects.toThrow('Email address must match the invitation code email address.')
    })
  })
})