#!/usr/bin/env node
/** Splice client-main: drop inlined CSS + runtime helpers (now modules) */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mainPath = join(root, 'client', 'client-main.js')
let src = readFileSync(mainPath, 'utf8')

const injectAfter = `    const Chrome = require('dsh-open-world/chrome')
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
`
const inject = `    const Chrome = require('dsh-open-world/chrome')
    const Styles = require('dsh-open-world/styles')
    const Runtime = require('dsh-open-world/runtime')
    const React = require('react')
    const { useState, useEffect, useCallback, useMemo, useRef } = React
    const { CSS } = Styles
    const {
      readWmMode, readWmLastMode, persistWmMode,
      fetchWorldState, postWorldState, applyWorldLocalCaches,
      postTaskAction, delay, notifyPulse,
      postOpenWorldAction, fetchJson, fetchMessages,
      fmtClock, taskProgress,
    } = Runtime
`
if (!src.includes(injectAfter)) {
  console.error('injectAfter marker missing')
  process.exit(1)
}
src = src.replace(injectAfter, inject)

const dropStart = src.indexOf('    function readWmMode() {')
const dropEnd = src.indexOf('    async function postTaskAction(action) {')
if (dropStart < 0 || dropEnd < 0) {
  console.error('drop markers missing', { dropStart, dropEnd })
  process.exit(1)
}
// drop from readWmMode through end of CSS (just before postTaskAction)
src = src.slice(0, dropStart) + src.slice(dropEnd)

const drop2Start = src.indexOf('    async function postTaskAction(action) {')
const drop2End = src.indexOf('    let sessionsBridge = null')
if (drop2Start < 0 || drop2End < 0) {
  console.error('drop2 markers missing', { drop2Start, drop2End })
  process.exit(1)
}
src = src.slice(0, drop2Start) + src.slice(drop2End)

const drop3Start = src.indexOf('    async function postOpenWorldAction(action) {')
const drop3End = src.indexOf('    function OpenWorldApp({ onClose, wmMode, onWmMode, unread = 0 }) {')
if (drop3Start < 0 || drop3End < 0) {
  console.error('drop3 markers missing', { drop3Start, drop3End })
  process.exit(1)
}
src = src.slice(0, drop3Start) + src.slice(drop3End)

writeFileSync(mainPath, src, 'utf8')
console.log('client-main.js lines', src.split('\n').length)
