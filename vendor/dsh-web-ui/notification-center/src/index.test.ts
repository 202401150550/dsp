import { describe, it, expect } from 'vitest'
import { name } from './index.ts'

describe('notification-center', () => {
  it('should export name', () => {
    expect(name).toBe('notification-center')
  })
})
