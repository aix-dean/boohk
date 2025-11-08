import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadSignature } from '@/lib/signature-service'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// Mock Firebase storage
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}))

vi.mock('@/lib/firebase', () => ({
  storage: {},
}))

describe('uploadSignature', () => {
  const mockDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const mockUserId = 'test-user-id'
  const mockDownloadURL = 'https://firebasestorage.googleapis.com/v0/b/test.appspot.com/o/signatures%2Ftest-user-id%2F1234567890.png?alt=media'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('successfully uploads a signature and returns download URL', async () => {
    // Mock the Firebase functions
    const mockStorageRef = { name: 'test-ref' }
    ;(ref as any).mockReturnValue(mockStorageRef)
    ;(uploadBytes as any).mockResolvedValue({})
    ;(getDownloadURL as any).mockResolvedValue(mockDownloadURL)

    const result = await uploadSignature(mockDataURL, mockUserId)

    expect(ref).toHaveBeenCalledWith({}, expect.stringMatching(`signatures/${mockUserId}/\\d+\\.png`))
    expect(uploadBytes).toHaveBeenCalledWith(mockStorageRef, expect.any(File))
    expect(getDownloadURL).toHaveBeenCalledWith(mockStorageRef)
    expect(result).toBe(mockDownloadURL)
  })

  it('handles upload failure and throws error', async () => {
    const mockError = new Error('Upload failed')
    ;(ref as any).mockReturnValue({})
    ;(uploadBytes as any).mockRejectedValue(mockError)

    await expect(uploadSignature(mockDataURL, mockUserId)).rejects.toThrow('Failed to upload signature')
  })

  it('handles getDownloadURL failure and throws error', async () => {
    const mockError = new Error('Get download URL failed')
    ;(ref as any).mockReturnValue({})
    ;(uploadBytes as any).mockResolvedValue({})
    ;(getDownloadURL as any).mockRejectedValue(mockError)

    await expect(uploadSignature(mockDataURL, mockUserId)).rejects.toThrow('Failed to upload signature')
  })

  it('converts data URL to File object correctly', async () => {
    const mockStorageRef = { name: 'test-ref' }
    ;(ref as any).mockReturnValue(mockStorageRef)
    ;(uploadBytes as any).mockResolvedValue({})
    ;(getDownloadURL as any).mockResolvedValue(mockDownloadURL)

    await uploadSignature(mockDataURL, mockUserId)

    const uploadCall = (uploadBytes as any).mock.calls[0]
    const file = uploadCall[1]

    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/png')
    expect(file.name).toMatch(/^\d+\.png$/)
  })

  it('generates unique filename with timestamp', async () => {
    const mockStorageRef = { name: 'test-ref' }
    ;(ref as any).mockReturnValue(mockStorageRef)
    ;(uploadBytes as any).mockResolvedValue({})
    ;(getDownloadURL as any).mockResolvedValue(mockDownloadURL)

    const beforeTime = Date.now()
    await uploadSignature(mockDataURL, mockUserId)
    const afterTime = Date.now()

    const refCall = (ref as any).mock.calls[0]
    const path = refCall[1]
    const filename = path.split('/').pop()
    const timestamp = parseInt(filename.replace('.png', ''))

    expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
    expect(timestamp).toBeLessThanOrEqual(afterTime)
  })
})