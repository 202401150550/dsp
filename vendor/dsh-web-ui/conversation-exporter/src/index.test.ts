import { describe, it, expect } from 'vitest'
import { name } from './index.ts'

describe('conversation-exporter', () => {
  it('should export name', () => {
    expect(name).toBe('conversation-exporter')
  })
})
