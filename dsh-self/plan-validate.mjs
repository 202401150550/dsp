#!/usr/bin/env node
/**
 * 组合校验（Phase 2 切片 1 · 最小闭环）。
 * 单步合法 ≠ 组合合法：本模块只回答「这一串步骤能不能一起跑、哪些要确认」。
 *
 *   validatePlan([{ tool:'fs.write', args:{...} }, { tool:'shell.run', args:{...} }])
 *
 * 纯函数、无副作用（不做真实写入，只读策略与路径解析）。
 */
import { resolveAllowed, previewFsWrite, impactShell } from './host-runtime.mjs'

/** 能力元数据：读/写/副作用/可逆/冲突/污点。工具新增时必须登记。 */
export const CAPABILITIES = {
  'fs.read': { reads: ['fs'], writes: [], side_effects: [], reversible: true, risk: 'read', taint: [] },
  'fs.list': { reads: ['fs'], writes: [], side_effects: [], reversible: true, risk: 'read', taint: [] },
  'fs.write': { reads: ['fs'], writes: ['fs'], side_effects: ['disk'], reversible: true, risk: 'write-file', taint: [] },
  'shell.run': { reads: ['proc'], writes: ['unknown'], side_effects: ['exec'], reversible: false, risk: 'exec', taint: ['tool-output'] },
  'git.status': { reads: ['git'], writes: [], side_effects: [], reversible: true, risk: 'read', taint: [] },
  'git.diff': { reads: ['git'], writes: [], side_effects: [], reversible: true, risk: 'read', taint: [] },
  'git.commit': { reads: ['git'], writes: ['git'], side_effects: ['repo-history'], reversible: false, risk: 'write-git', taint: [] },
  'doctor.check': { reads: ['config'], writes: [], side_effects: [], reversible: true, risk: 'read', taint: [] },
  'doctor.fix': { reads: ['config'], writes: ['config'], side_effects: ['delete-hot-yml'], reversible: true, risk: 'write-config', taint: [] },
  'baseline.save': { reads: ['config'], writes: ['baseline'], side_effects: [], reversible: true, risk: 'write-config', taint: [] },
  'dsh.restart': { reads: [], writes: [], side_effects: ['process'], reversible: false, risk: 'exec', taint: [] },
  'vision.wizard.status': { reads: ['config'], writes: [], side_effects: [], reversible: true, risk: 'read', taint: [] },
  'vision.wizard.apply': { reads: ['config'], writes: ['config'], side_effects: [], reversible: true, risk: 'write-config', taint: [] },
}

const CONFLICT_RULES = [
  {
    id: 'write-then-exec',
    when: (a, b) => a.tool === 'fs.write' && b.tool === 'shell.run',
    reason: '先写文件再执行命令 = 让工具输出影响后续执行，属于经典注入链；需人工确认或拆成两次审批。',
  },
  {
    id: 'double-commit',
    when: (a, b) => a.tool === 'git.commit' && b.tool === 'git.commit',
    reason: '同一计划里两次提交容易产生半提交状态，建议合并为一次。',
  },
  {
    id: 'exec-after-config-write',
    when: (a, b) => (a.tool === 'doctor.fix' || a.tool === 'vision.wizard.apply') && b.tool === 'shell.run',
    reason: '改配置后立刻执行命令，需要确认改动内容与执行命令都可见。',
  },
]

const WARN_PATTERNS = [
  { id: 'secret-like-content', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*\S{8,}/i, reason: '参数里疑似明文凭证；应走凭证库并脱敏。' },
  { id: 'path-escape-attempt', re: /\.\.[\\/]|\.\.[\/]/, reason: '参数含 ../，确认不是路径逃逸。' },
]

function checkStep(step, index) {
  const reasons = []
  const tool = String(step && step.tool || '')
  const args = (step && step.args) || {}
  const cap = CAPABILITIES[tool]
  if (!cap) return { index, tool, status: 'deny', reasons: [`未登记能力的工具：${tool || '(empty)'}`] }
  if (cap.writes.includes('fs')) {
    const preview = previewFsWrite(args)
    if (preview.status === 'denied') reasons.push(`路径/内容被拒：${preview.error}`)
  }
  if (tool === 'fs.read' || tool === 'fs.write') {
    const got = resolveAllowed(args.path, { mustExist: tool === 'fs.read' })
    if (!got.ok) reasons.push(`路径越界或缺失：${got.error}`)
  }
  if (tool === 'git.commit') {
    const files = Array.isArray(args.files) ? args.files : []
    if (files.length === 0) reasons.push('git.commit 必须明示 files 清单')
  }
  for (const pat of WARN_PATTERNS) {
    const blob = JSON.stringify(args)
    if (pat.re.test(blob)) reasons.push(`${pat.id}: ${pat.reason}`)
  }
  const deny = reasons.some((r) => r.startsWith('路径') || r.startsWith('未登记') || r.includes('路径/内容被拒'))
  const warn = reasons.filter((r) => !r.startsWith('路径') && !r.startsWith('未登记') && !r.includes('路径/内容被拒'))
  return {
    index, tool, capability: cap, reasons,
    status: deny ? 'deny' : (warn.length ? 'warn' : (cap.risk === 'read' ? 'allow' : 'confirm')),
  }
}

/**
 * @param {Array<{tool:string,args?:object}>} steps
 * @returns {{ok:boolean,decisions:Array,summary:object}}
 */
export function validatePlan(steps) {
  const list = Array.isArray(steps) ? steps : []
  if (list.length === 0) return { ok: false, error: 'empty-plan', decisions: [], summary: { total: 0, deny: 0, confirm: 0, warn: 0, allow: 0 } }
  if (list.length > 20) return { ok: false, error: 'plan-too-long', decisions: [], summary: { total: list.length } }

  const decisions = list.map((s, i) => checkStep(s, i))
  const conflicts = []
  for (let i = 0; i < decisions.length; i += 1) {
    for (let j = i + 1; j < decisions.length; j += 1) {
      for (const rule of CONFLICT_RULES) {
        if (rule.when(list[i] || {}, list[j] || {})) {
          conflicts.push({ rule: rule.id, from: i, to: j, reason: rule.reason })
        }
      }
    }
  }
  const writes = decisions.filter((d) => d.capability && d.capability.writes.length).length
  const summary = {
    total: decisions.length,
    allow: decisions.filter((d) => d.status === 'allow').length,
    confirm: decisions.filter((d) => d.status === 'confirm').length,
    warn: decisions.filter((d) => d.status === 'warn').length,
    deny: decisions.filter((d) => d.status === 'deny').length,
    writes,
    conflicts,
  }
  const ok = summary.deny === 0 && conflicts.length === 0
  return {
    ok,
    decisions,
    summary,
    note: ok
      ? '计划可执行：写操作仍需逐条 confirm。'
      : '计划被拒：先拆分为单步审批，或修正越界/未登记步骤。',
  }
}

export { impactShell }
