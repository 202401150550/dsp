/**
 * OS command argv builders for the file-tree right-click menu
 * (reveal-in-file-manager / open-with-default). Pure functions so the
 * platform-specific argument shapes are locked without spawning processes.
 */
import { describe, expect, it } from 'vitest'
import { dirname } from 'node:path'
import { openArgv, revealArgv, spawnCwd } from '../src/host/routes.ts'

describe('revealArgv', () => {
  it('selects the entry via Explorer on Windows', () => {
    expect(revealArgv('win32', 'C:\\proj\\src\\a.ts')).toEqual(['explorer.exe', '/select,C:\\proj\\src\\a.ts'])
  })

  it('reveals in Finder on macOS', () => {
    expect(revealArgv('darwin', '/Users/x/proj/a.ts')).toEqual(['open', '-R', '/Users/x/proj/a.ts'])
  })

  it('opens the parent directory on Linux desktops', () => {
    expect(revealArgv('linux', '/home/x/proj/src/a.ts')).toEqual(['xdg-open', '/home/x/proj/src'])
  })
})

describe('openArgv', () => {
  it('starts the default app via cmd on Windows', () => {
    expect(openArgv('win32', 'C:\\proj\\notes.md')).toEqual(['cmd.exe', '/c', 'start', '', 'C:\\proj\\notes.md'])
  })

  it('opens the path with open on macOS', () => {
    expect(openArgv('darwin', '/Users/x/proj/notes.md')).toEqual(['open', '/Users/x/proj/notes.md'])
  })

  it('opens the path with xdg-open on Linux', () => {
    expect(openArgv('linux', '/home/x/proj/notes.md')).toEqual(['xdg-open', '/home/x/proj/notes.md'])
  })
})

describe('spawnCwd', () => {
  it('strips the /select, prefix from the Windows reveal argv', () => {
    expect(spawnCwd(['explorer.exe', '/select,C:\\proj\\src\\a.ts'], 'win32')).toBe('C:\\proj\\src')
  })

  it('uses the real path for macOS reveal argv', () => {
    expect(spawnCwd(['open', '-R', '/Users/x/proj/a.ts'])).toBe('/Users/x/proj')
  })

  it('uses the parent directory for Linux reveal argv', () => {
    expect(spawnCwd(['xdg-open', '/home/x/proj/src'])).toBe('/home/x/proj')
  })

  it('uses the real path for the Windows open-with-default argv', () => {
    expect(spawnCwd(['cmd.exe', '/c', 'start', '', 'C:\\proj\\notes.md'], 'win32')).toBe('C:\\proj')
  })

  it('falls back to the parent of the current working directory on an empty argv', () => {
    expect(spawnCwd([])).toBe(dirname(process.cwd()))
  })
})
