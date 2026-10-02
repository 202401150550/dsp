/**
 * Host half of dsh-550c-boot.
 *
 * Cold-boot first-frame inject is intentionally gone: entering DSH should show
 * the normal shell Loading card. The splash only plays on demand when Open
 * World calls `window.__dsh550c.play()` (enter-world gate), which lives entirely
 * in the browser half (`lib/client.js`).
 *
 * This host module still exists so the package remains a Cordis plugin with a
 * `main` entry; it registers nothing.
 *
 * @module dsh-550c-boot
 */

export const name = 'boot-550c'

export function apply(_ctx) {
  // no-op: no index-inject, no services
}
