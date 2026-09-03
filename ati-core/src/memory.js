// ati-core · 记忆系统（长短时）
// 短时 = 内存 Map（会话级）
// 长时 = 持久化 JSON 文件（跨会话）

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

export class MemorySystem {
  /**
   * @param {Object} opts
   * @param {string} opts.persistPath — 长时记忆文件路径（可选，不传则只内存）
   * @param {number} opts.maxShortTerm — 短时记忆最大条目数
   */
  constructor({ persistPath = null, maxShortTerm = 500 } = {}) {
    this.shortTerm = new Map()
    this.longTerm = new Map()
    this.persistPath = persistPath
    this.maxShortTerm = maxShortTerm
    if (persistPath) this._loadLongTerm()
  }

  _loadLongTerm() {
    try {
      if (!existsSync(this.persistPath)) return
      const raw = JSON.parse(readFileSync(this.persistPath, 'utf8'))
      for (const [k, v] of Object.entries(raw)) {
        this.longTerm.set(k, v)
      }
    } catch { /* corrupt file → start fresh */ }
  }

  _saveLongTerm() {
    if (!this.persistPath) return
    try {
      const dir = dirname(this.persistPath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const obj = Object.fromEntries(this.longTerm)
      writeFileSync(this.persistPath, JSON.stringify(obj, null, 2))
    } catch { /* disk error → silent */ }
  }

  // ── 短时记忆（会话内）──────────────────────────────────
  remember(key, value) {
    this.shortTerm.set(key, { value, ts: Date.now(), reads: 0 })
    // LRU 淘汰：超过上限删最旧且最少读的
    if (this.shortTerm.size > this.maxShortTerm) {
      let oldestKey = null
      let oldestScore = Infinity
      for (const [k, entry] of this.shortTerm) {
        const score = entry.reads * 1000 + entry.ts / 1e10
        if (score < oldestScore) { oldestScore = score; oldestKey = k }
      }
      if (oldestKey) this.shortTerm.delete(oldestKey)
    }
    return this
  }

  recall(key) {
    const entry = this.shortTerm.get(key)
    if (!entry) return undefined
    entry.reads++
    return entry.value
  }

  forgetShortTerm(key) { return this.shortTerm.delete(key) }
  clearShortTerm() { this.shortTerm.clear(); return this }

  // ── 长时记忆（持久化）──────────────────────────────────
  memorize(key, value) {
    this.longTerm.set(key, { value, ts: Date.now(), version: (this.longTerm.get(key)?.version || 0) + 1 })
    this._saveLongTerm()
    return this
  }

  recollect(key) {
    const entry = this.longTerm.get(key)
    return entry ? entry.value : undefined
  }

  forgetLongTerm(key) {
    const removed = this.longTerm.delete(key)
    if (removed) this._saveLongTerm()
    return removed
  }

  /** 模糊检索长时记忆（key 包含 pattern） */
  recallPattern(pattern) {
    const lower = pattern.toLowerCase()
    const out = []
    for (const [k, entry] of this.longTerm) {
      if (k.toLowerCase().includes(lower) ||
          (typeof entry.value === 'string' && entry.value.toLowerCase().includes(lower))) {
        out.push({ key: k, value: entry.value, ts: entry.ts })
      }
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, 20)
  }

  /** 把短时记忆提升为长时 */
  promote(key) {
    const short = this.shortTerm.get(key)
    if (!short) throw new Error(`short-term "${key}" not found`)
    this.memorize(key, short.value)
    return this
  }

  stats() {
    return {
      shortTermSize: this.shortTerm.size,
      longTermSize: this.longTerm.size,
      persistPath: this.persistPath,
      persisted: !!this.persistPath && existsSync(this.persistPath),
    }
  }

  serialize() {
    return JSON.stringify({
      longTerm: Object.fromEntries([...this.longTerm].map(([k, v]) => [k, v])),
    })
  }

  static deserialize(json) {
    const raw = typeof json === 'string' ? JSON.parse(json) : json
    const mem = new MemorySystem()
    for (const [k, v] of Object.entries(raw.longTerm || {})) {
      mem.longTerm.set(k, v)
    }
    return mem
  }
}
