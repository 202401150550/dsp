#!/usr/bin/env node
import http from 'node:http'
import WebSocket from 'ws'

const MARKER = `CDP注入验证 ${new Date().toISOString()}`

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

async function attach() {
  const list = await getJson('http://127.0.0.1:9222/json/list')
  const page = list.find((p) => p.type === 'page' && /127\.0\.0\.1/.test(p.url))
  if (!page) throw new Error('no page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j) })
  let id = 0
  const pending = new Map()
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  await send('Runtime.enable')
  const evaluate = async (expression, timeoutMs = 12000) => {
    const r = await Promise.race([
      send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true, userGesture: true,
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate-timeout')), timeoutMs)),
    ])
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result?.value
  }
  return { ws, send, evaluate, page }
}

async function main() {
  console.log('MARKER', MARKER)
  let ctx = await attach()
  const port = new URL(ctx.page.url).port
  console.log('port', port)

  // 强制整页重进，清 ModuleLoader 缓存
  const fresh = `http://127.0.0.1:${port}/?dsh-desktop-mode=compatibility&dsh-desktop-platform=win32&_owbust=${Date.now()}`
  await ctx.send('Page.enable')
  ctx.send('Page.navigate', { url: fresh }).catch(() => {})
  ctx.ws.close()
  await new Promise((r) => setTimeout(r, 5000))
  ctx = await attach()
  console.log('fresh', ctx.page.url)

  const probe = await ctx.evaluate(`(() => {
    // 探测打包进页面的 open-world client 是否含 timeout 修复
    const styles = !!document.querySelector('style[data-plugin=\"dsh-open-world\"]');
    return { styles, readyState: document.readyState };
  })()`)
  console.log('probe', probe)

  await ctx.evaluate(`(() => { document.querySelector('.ow-trigger')?.click(); })()`)
  await new Promise((r) => setTimeout(r, 1200))
  await ctx.evaluate(`(() => {
    [...document.querySelectorAll('button')].find(b => /IDEA Lab/i.test(b.textContent||''))?.click();
  })()`)
  await new Promise((r) => setTimeout(r, 800))

  // 只做填表 + 点击，不做长等待（避免 awaitPromise 卡死）
  const step1 = await ctx.evaluate(`(() => {
    const marker = ${JSON.stringify(MARKER)};
    const o = document.querySelector('.ow-overlay');
    if (!o) return { ok:false, error:'no-overlay' };
    [...o.querySelectorAll('.ow-idea-card')].find(c => /小肥鱼/.test(c.textContent||''))?.click();
    const ta = [...o.querySelectorAll('textarea.ow-idea-prompt')].find(t => t.offsetWidth) || o.querySelector('textarea.ow-idea-prompt');
    if (!ta) return { ok:false, error:'no-ta' };
    ta.focus();
    const key = Object.keys(ta).find(k => k.startsWith('__reactProps$'));
    const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    native.set.call(ta, marker);
    if (key && ta[key]?.onChange) ta[key].onChange({ target: { value: marker }, currentTarget: { value: marker } });
    else ta.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = [...o.querySelectorAll('button')].find(b => (b.textContent||'').trim() === '注入对话');
    return {
      ok: !!btn,
      disabled: btn?.disabled ?? null,
      ta: ta.value.slice(0, 40),
      hasOnChange: !!(key && ta[key]?.onChange),
    };
  })()`)
  console.log('step1', step1)

  if (!step1?.ok) {
    ctx.ws.close()
    process.exit(1)
  }

  // 点击（短 evaluate）
  await ctx.evaluate(`(() => {
    const btn = [...document.querySelectorAll('.ow-overlay button')].find(b => (b.textContent||'').trim() === '注入对话');
    btn?.click();
    return true;
  })()`)

  // 外面轮询状态
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 400))
    const st = await ctx.evaluate(`(() => ({
      toast: document.querySelector('.ow-toast')?.textContent || null,
      injectBtns: [...document.querySelectorAll('.ow-overlay button, button')].map(b => (b.textContent||'').trim()).filter(t => /注入/.test(t)).slice(0,4),
      overlay: !!document.querySelector('.ow-overlay'),
      hasIdea: (document.body.innerText||'').includes('[IDEA Lab'),
      hasMarker: (document.body.innerText||'').includes(${JSON.stringify(MARKER)}),
    }))()`)
    console.log('t' + i, st)
    if (st.toast && !/正在注入/.test(st.toast)) break
    if (!st.overlay && st.hasIdea) break
    if (st.hasMarker) break
  }

  const mb = await fetch(`http://127.0.0.1:${port}/api/open-world/messages`).then((r) => r.json())
  console.log('mailbox', (mb.messages || []).some((m) => m.body?.includes(MARKER)) ? 'FOUND' : 'missing')
  ctx.ws.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
