import { describe, it, expect } from 'vitest'

describe('Simple Test Suite', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should run another basic test', () => {
    expect('hello').toBe('hello')
  })
})