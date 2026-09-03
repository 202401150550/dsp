#!/usr/bin/env node
import { buildFleetView } from '../bridge/fleet.mjs'

let passed = 0
let failed = 0
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  ✓', msg) }
  else { failed += 1; console.error('  ✗', msg) }
}

console.log('\n=== fleet ===\n')
const fleet = buildFleetView({
  sessions: {
    activeId: 's1',
    items: [
      { id: 's1', cwd: 'D:/dsp', createdAt: 2 },
      { id: 's2', cwd: 'D:/other', createdAt: 1 },
    ],
  },
  taskBoard: {
    available: true,
    tasks: [
      { id: 't1', title: '跑测试', status: 'running', running: true, updatedAt: 9 },
      { id: 't2', title: '排队', status: 'queued', running: false, updatedAt: 3 },
    ],
  },
  ventus: {
    available: true,
    entries: [
      {
        subagentId: 'a1',
        taskName: '写文档',
        percent: 40,
        currentText: '起草中',
        finished: false,
        updatedAt: 8,
        stages: [{ name: '起草' }, { label: '润色' }, '交付'],
      },
    ],
  },
})

ok(fleet.counts.sessions === 2, 'sessions count')
ok(fleet.counts.tasks === 2, 'tasks count')
ok(fleet.counts.subagents === 1, 'subagents count')
ok(fleet.counts.running >= 2, 'running includes active/session+task/subagent')
ok(fleet.processes[0].status === 'running' || fleet.processes[0].status === 'active', 'hot processes first')
ok(fleet.processes.some((p) => p.kind === 'session' && p.status === 'active'), 'active session')
ok(fleet.processes.some((p) => p.kind === 'task' && p.taskId === 't1'), 'task row')
ok(fleet.processes.some((p) => p.kind === 'subagent' && p.percent === 40), 'subagent row')
ok(fleet.ventusAvailable === true, 'ventus flag')
ok(fleet.taskBoardAvailable === true, 'taskBoardAvailable flag')
const sub = fleet.processes.find((p) => p.kind === 'subagent')
ok(Array.isArray(sub.stages) && sub.stages.length === 3, 'subagent stages passthrough')

const offline = buildFleetView({
  sessions: { items: [] },
  taskBoard: { available: false, tasks: [] },
  ventus: { available: false, entries: [] },
})
ok(offline.taskBoardAvailable === false, 'task-board offline flag')
ok(offline.ventusAvailable === false, 'ventus offline flag')

console.log(`\n=== fleet: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
