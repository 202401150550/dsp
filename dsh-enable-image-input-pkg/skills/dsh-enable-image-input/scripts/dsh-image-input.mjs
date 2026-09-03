#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'

const NAMESPACE = 'llm-pi-ai'
const DEFAULT_SERVER = 'http://127.0.0.1:3080'

function usage() {
  console.log(`用法：
  node scripts/dsh-image-input.mjs [--server URL] --list
  node scripts/dsh-image-input.mjs [--server URL] --provider ID --model ID
  node scripts/dsh-image-input.mjs [--server URL] --provider ID --model ID --apply [--backup FILE]
  node scripts/dsh-image-input.mjs [--server URL] --rollback FILE

未使用 --apply/--rollback 时均为只读；请使用 --list 或同时提供 --provider/--model。`)
}

function errorMessage(error) {
  if (!(error instanceof Error)) return String(error)
  const code = error.cause && typeof error.cause === 'object' && 'code' in error.cause
    ? String(error.cause.code)
    : undefined
  if (code === 'EPERM') return `${error.message}（EPERM：当前隔离环境禁止访问本机回环端口，请用最小权限重试）`
  return code === undefined ? error.message : `${error.message}（${code}）`
}

function parseArgs(argv) {
  const options = { server: DEFAULT_SERVER, apply: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--apply') {
      options.apply = true
      continue
    }
    if (arg === '--list') {
      options.list = true
      continue
    }
    if (arg === '--server' || arg === '--provider' || arg === '--model'
      || arg === '--backup' || arg === '--rollback') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} 缺少参数值`)
      options[arg.slice(2)] = value
      index += 1
      continue
    }
    throw new Error(`未知参数：${arg}`)
  }
  if (options.apply && options.rollback !== undefined) throw new Error('--apply 和 --rollback 不能同时使用')
  if (options.list && (options.apply || options.rollback !== undefined
    || options.provider !== undefined || options.model !== undefined)) {
    throw new Error('--list 不能与模型参数、--apply 或 --rollback 同时使用')
  }
  return options
}

function normalizedServer(server) {
  let url
  try {
    url = new URL(server)
  } catch {
    throw new Error(`DSH 地址无效：${server}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('DSH 地址只能使用 http 或 https')
  return url.href.replace(/\/$/, '')
}

async function rpc(server, method, payload) {
  let response
  try {
    response = await fetch(`${server}/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: `dsh-image-input-${randomUUID()}`,
        method,
        payload,
      }),
    })
  } catch (error) {
    throw new Error(`无法连接 DSH ${server}：${errorMessage(error)}`)
  }
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`DSH 返回了无法解析的响应（HTTP ${response.status}）`)
  }
  if (!response.ok || body?.result?.ok !== true) {
    const failure = body?.result?.error
    throw new Error(failure?.message ?? `DSH 请求失败（HTTP ${response.status}）`)
  }
  return body.result.value
}

function namespaceOf(description, name) {
  const namespace = description?.namespaces?.find(item => item.ns === name)
  if (namespace === undefined) throw new Error(`当前 DSH 没有 ${name} 设置命名空间；目标模型可能不由该适配器管理`)
  return namespace
}

function currentSelection(options) {
  if (options.provider === undefined || options.model === undefined) {
    throw new Error('无法可靠判断当前会话模型，请同时提供 --provider 和 --model')
  }
  return { provider: options.provider, model: options.model }
}

function listConfiguredModels(namespace) {
  const providers = namespace.value?.providers ?? {}
  const rows = []
  for (const [provider, route] of Object.entries(providers)) {
    const models = Array.isArray(route?.models) ? route.models : []
    if (models.length === 0) {
      rows.push(`${provider}/（模型目录未写入设置，请从界面读取模型 ID）`)
      continue
    }
    for (const model of models) {
      if (typeof model?.id !== 'string') continue
      const input = Array.isArray(model.input) && model.input.length > 0 ? model.input.join(', ') : '未声明（默认仅文本）'
      rows.push(`${provider}/${model.id}  输入：${input}`)
    }
  }
  if (rows.length === 0) throw new Error('llm-pi-ai 中没有已配置的提供商')
  console.log('已配置模型：')
  for (const row of rows) console.log(`- ${row}`)
}

function routeOf(namespace, provider) {
  const userRoute = namespace.user?.providers?.[provider]
  const effectiveRoute = namespace.value?.providers?.[provider]
  if (effectiveRoute === undefined) throw new Error(`llm-pi-ai 中不存在提供商 ${provider}`)
  return { userRoute: userRoute ?? {}, effectiveRoute }
}

function uniqueModalities(input) {
  const current = Array.isArray(input) ? input.filter(value => value === 'text' || value === 'image') : []
  return [...new Set([...current, 'text', 'image'])]
}

function mutationPlan(namespace, provider, model) {
  const { userRoute, effectiveRoute } = routeOf(namespace, provider)
  const userModels = Array.isArray(userRoute.models) ? userRoute.models : undefined
  const effectiveModels = Array.isArray(effectiveRoute.models) ? effectiveRoute.models : []
  const sourceModels = userModels ?? effectiveModels
  const modelIndex = sourceModels.findIndex(entry => entry?.id === model)

  if (modelIndex >= 0) {
    const current = sourceModels[modelIndex]
    const next = sourceModels.map((entry, index) => index === modelIndex
      ? { ...entry, input: uniqueModalities(entry.input) }
      : entry)
    return {
      currentInput: Array.isArray(current.input) ? current.input : [],
      path: ['providers', provider, 'models'],
      previousValue: sourceModels,
      nextValue: next,
      source: 'models',
    }
  }

  if (effectiveModels.length > 0) {
    throw new Error(`提供商 ${provider} 的模型列表中没有 ${model}；请先确认模型 ID 和提供商`)
  }

  const overrides = userRoute.modelOverrides ?? effectiveRoute.modelOverrides ?? {}
  const currentOverride = overrides[model] ?? {}
  return {
    currentInput: Array.isArray(currentOverride.input) ? currentOverride.input : [],
    path: ['providers', provider, 'modelOverrides'],
    previousValue: overrides,
    nextValue: {
      ...overrides,
      [model]: { ...currentOverride, input: uniqueModalities(currentOverride.input) },
    },
    source: 'modelOverrides',
  }
}

function hasImage(input) {
  return Array.isArray(input) && input.includes('text') && input.includes('image')
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'model'
}

function defaultBackupName(provider, model) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return resolve(`dsh-image-input-backup-${safeName(provider)}-${safeName(model)}-${stamp}.json`)
}

async function mutate(server, namespace, path, value) {
  return rpc(server, 'settings.mutate', {
    ns: NAMESPACE,
    ops: [{ op: 'set', path, value }],
    expectedRevision: namespace.revision,
  })
}

async function rollback(server, file) {
  const filePath = resolve(file)
  const backup = JSON.parse(await readFile(filePath, 'utf8'))
  if (backup?.formatVersion !== 1 || backup.namespace !== NAMESPACE
    || !Array.isArray(backup.path) || !('previousValue' in backup)) {
    throw new Error(`回滚文件格式无效：${filePath}`)
  }
  const validPath = backup.path.length === 3
    && backup.path[0] === 'providers'
    && backup.path[1] === backup.provider
    && (backup.path[2] === 'models' || backup.path[2] === 'modelOverrides')
  if (!validPath) throw new Error(`回滚文件包含不允许的设置路径：${filePath}`)
  const description = await rpc(server, 'settings.describe', {})
  const namespace = namespaceOf(description, NAMESPACE)
  await mutate(server, namespace, backup.path, backup.previousValue)
  console.log(`已回滚：${basename(filePath)}`)
  console.log('请刷新 DSH 页面并重新运行只读诊断。')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }
  const server = normalizedServer(options.server)
  if (options.rollback !== undefined) {
    await rollback(server, options.rollback)
    return
  }

  const description = await rpc(server, 'settings.describe', {})
  const namespace = namespaceOf(description, NAMESPACE)
  if (options.list) {
    listConfiguredModels(namespace)
    return
  }
  const selection = currentSelection(options)
  const plan = mutationPlan(namespace, selection.provider, selection.model)
  const enabled = hasImage(plan.currentInput)

  console.log(`DSH 地址：${server}`)
  console.log(`目标模型：${selection.provider}/${selection.model}`)
  console.log(`配置位置：${plan.source}`)
  console.log(`当前输入：${plan.currentInput.length > 0 ? plan.currentInput.join(', ') : '未声明（默认仅文本）'}`)
  console.log(`图片输入：${enabled ? '已启用' : '未启用'}`)

  if (!options.apply) {
    if (!enabled) console.log('诊断结论：需要在确认模型支持视觉后使用 --apply 修复。')
    return
  }
  if (enabled) {
    console.log('无需修改。')
    return
  }

  const backupPath = resolve(options.backup ?? defaultBackupName(selection.provider, selection.model))
  const backup = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    server,
    namespace: NAMESPACE,
    provider: selection.provider,
    model: selection.model,
    path: plan.path,
    previousValue: plan.previousValue,
  }
  await writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx' })
  console.log(`已创建回滚文件：${backupPath}`)

  try {
    await mutate(server, namespace, plan.path, plan.nextValue)
    const verifiedDescription = await rpc(server, 'settings.describe', {})
    const verifiedNamespace = namespaceOf(verifiedDescription, NAMESPACE)
    const verifiedPlan = mutationPlan(verifiedNamespace, selection.provider, selection.model)
    if (!hasImage(verifiedPlan.currentInput)) {
      throw new Error('设置接口已返回成功，但复核时仍未看到 text/image')
    }
  } catch (error) {
    throw new Error(`修复未完成；设置未通过复核。可使用回滚文件恢复。${error instanceof Error ? error.message : String(error)}`)
  }

  console.log('修复完成：图片输入已启用。')
  console.log('请刷新 DSH 页面，再用不敏感的测试图片验证。')
}

main().catch(error => {
  console.error(`错误：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
