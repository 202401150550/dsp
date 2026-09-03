import { describe, it, expect } from 'vitest'
import { name, EXT_TO_LANG } from './index.ts'

describe('workspace-analyzer', () => {
  it('should export name', () => {
    expect(name).toBe('workspace-analyzer')
  })
  it('should have .ts mapping', () => {
    expect(EXT_TO_LANG['.ts']).toBe('TypeScript')
  })
})
