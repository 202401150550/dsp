#!/usr/bin/env node
/**
 * 聊天坞存储层离线用例：不依赖 Desktop、不联网，只用临时目录。
 * 覆盖：线程/消息上限、未读、已读、附件落盘与路径校验、敏感名拒绝、大小上限。
 */
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as chat from '../bridge/chat-store.mjs'

let passed = 0
let failed = 0
function ok(cond, msg, detail = '') {
  if (cond) { passed += 1; console.log(`  ✓ ${msg}`) }
  else { failed += 1; console.error(`  ✗ ${msg}${detail ? ` — ${detail}` : ''}`) }
}

console.log('\n=== chat-store ===\n')

const home = mkdtempSync(join(tmpdir(), 'ow-chat-'))
try {
  // 线程与消息
  chat.ensureThread(home, { id: 'main', title: '总控台' })
  const t2 = chat.ensureThread(home, { id: 'front desk'.replace(' ', '-'), title: '前台' })
  ok(t2.ok === true, 'ensureThread 接受合法 id')
  ok(chat.ensureThread(home, { id: '../evil' }).ok === false, '拒绝非法线程 id（路径穿越）')

  const posted = chat.appendMessage(home, { threadId: 'main', role: 'user', text: '晚上好' })
  ok(posted.ok === true && posted.message.role === 'user', '追加用户消息')
  chat.appendMessage(home, { threadId: 'main', role: 'agent', text: '收到，正在处理' })
  const msgs = chat.listMessages(home, 'main', { limit: 10 })
  ok(msgs.ok === true && msgs.messages.length === 2, '读取消息顺序正确', `len=${msgs.messages.length}`)
  const threads = chat.listThreads(home)
  const main = threads.find((t) => t.id === 'main')
  ok(main && main.unread >= 1, 'agent 消息计入未读', JSON.stringify(main))
  chat.markRead(home, 'main')
  ok(chat.listThreads(home).find((t) => t.id === 'main').unread === 0, '已读清零')

  ok(chat.appendMessage(home, { threadId: 'main', role: 'user', text: '' }).ok === false, '拒绝空消息')
  ok(chat.appendMessage(home, { threadId: 'main', role: 'root', text: 'x' }).ok === false, '拒绝非法角色')

  // 消息上限（不写 500 条真实文件，直接构造）
  const many = chat.messagesFile(home, 'main')
  const payload = { threadId: 'main', messages: Array.from({ length: 505 }, (_, i) => ({ id: `m${i}`, ts: i, role: 'user', text: 'x' })) }
  writeFileSync(many, JSON.stringify(payload), 'utf8')
  chat.appendMessage(home, { threadId: 'main', role: 'user', text: '最后一条' })
  const after = JSON.parse(readFileSync(many, 'utf8'))
  ok(after.messages.length === chat.MAX_MESSAGES, `消息裁剪到上限 ${chat.MAX_MESSAGES}`, `len=${after.messages.length}`)

  // 附件
  const buf = Buffer.from('fixture attachment payload', 'utf8')
  const stored = chat.storeFile(home, 'main', '夜审记录 2026-10-01.txt', buf, 'text/plain')
  ok(stored.ok === true && stored.attachment.bytes === buf.length, '附件写入成功')
  const resolved = chat.resolveFile(home, 'main', stored.attachment.id)
  ok(resolved.ok === true && readFileSync(resolved.path).equals(buf), '附件按 id 读回且逐字节一致')
  ok(resolved.mime.startsWith('text/plain'), '按扩展名推断 MIME', resolved.mime)

  const bad = chat.resolveFile(home, 'main', '../../etc/passwd')
  ok(bad.ok === false, '拒绝非法附件引用')
  const deniedName = chat.storeFile(home, 'main', '.env', Buffer.from('x'), 'text/plain')
  ok(deniedName.ok === false && deniedName.error === 'file-name-denied', '拒绝敏感文件名 .env')
  const pemName = chat.storeFile(home, 'main', 'server.pem', Buffer.from('x'))
  ok(pemName.ok === false, '拒绝 *.pem')
  const tooBig = chat.storeFile(home, 'main', 'big.bin', Buffer.alloc(chat.MAX_UPLOAD_BYTES + 1))
  ok(tooBig.ok === false && tooBig.error === 'file-too-large', '拒绝超过上限的附件')

  const sanitized = chat.sanitizeName('a/../../b:c*d?.txt')
  ok(!sanitized.includes('/') && !sanitized.includes('..'), '文件名清洗（去路径与非法字符）', sanitized)

  const stats = chat.chatStats(home)
  ok(stats.files >= 1 && stats.bytes > 0, '统计包含附件体积', JSON.stringify(stats))

  // 存储位置可审计（本地文件，而不是只存在内存里）
  // Capacity must reject new threads, never evict existing metadata silently.
  const capHome = join(home, 'capacity-case')
  for (let i = 0; i < chat.MAX_THREADS; i++) chat.ensureThread(capHome, { id: `t-${i}`, title: `fixture ${i}` })
  const capFile = chat.chatPaths(capHome).meta
  const beforeCap = readFileSync(capFile, 'utf8')
  const rejected = chat.ensureThread(capHome, { id: 'overflow' })
  ok(rejected.ok === false && rejected.error === 'thread-limit-reached', '满额新建明确拒绝')
  ok(readFileSync(capFile, 'utf8') === beforeCap, '满额拒绝不改变既有线程元数据')
  const appendRejected = chat.appendMessage(capHome, { threadId: 'overflow-message', role: 'system', text: 'fixture' })
  ok(appendRejected.ok === false && appendRejected.error === 'thread-limit-reached', '满额消息不能隐式挤掉线程')
  ok(!existsSync(chat.messagesFile(capHome, 'overflow-message')), '拒绝后不产生孤立消息文件')
  ok(chat.appendMessage(capHome, { threadId: 't-0', role: 'system', text: 'existing remains writable' }).ok === true, '满额时已有线程仍可写')
  const remainingIds = new Set(chat.listThreads(capHome).map(t => t.id))
  ok(remainingIds.size === chat.MAX_THREADS && Array.from({ length: chat.MAX_THREADS }, (_, i) => `t-${i}`).every(id => remainingIds.has(id)), '所有既有线程仍可发现')
  ok(existsSync(join(home, 'open-world', 'chat', 'meta.json')), '线程表落盘')
} finally {
  rmSync(home, { recursive: true, force: true })
}

console.log(`\n=== chat-store: ${passed} passed, ${failed} failed ===`)
process.exit(failed === 0 ? 0 : 1)
