#!/usr/bin/env node
/** CDP：强刷后点「注入对话」，验证不再卡在注入中 */
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

async function main() {
  const list = await getJson('http://127.0.0.1:9222/json/list')
  const page = list.find((p) => p.type === 'page' && /127\.0\.0\.1/.test(p.url))
  if (!page) throw new Error('no page')
  console.log('url', page.url)
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
  await send('Page.enable')

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result?.value
  }

  console.log('reload…')
  await send('Page.reload', { ignoreCache: true })
  await new Promise((r) => setTimeout(r, 4000))

  // 打开 OW
  await evaluate(`(() => {
    if (document.querySelector('.ow-overlay')) return true;
    document.querySelector('.ow-trigger')?.click();
    return true;
  })()`)
  await new Promise((r) => setTimeout(r, 1000))

  // IDEA 视图
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /IDEA Lab/i.test(x.textContent||''));
    b?.click();
  })()`)
  await new Promise((r) => setTimeout(r, 800))

  const result = await evaluate(`(async () => {
    const marker = ${JSON.stringify(MARKER)};
    const o = document.querySelector('.ow-overlay');
    if (!o) return { ok: false, error: 'no-overlay' };
    const card = [...o.querySelectorAll('.ow-idea-card')].find(c => /小肥鱼/.test(c.textContent||''));
    card?.click();
    const ta = [...o.querySelectorAll('textarea.ow-idea-prompt')].find(t => t.offsetWidth) || o.querySelector('textarea.ow-idea-prompt');
    if (!ta) return { ok: false, error: 'no-ta' };
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc?.set) desc.set.call(ta, marker); else ta.value = marker;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    const btn = [...o.querySelectorAll('button')].find(b => /注入对话|注入中/.test(b.textContent||''));
    if (!btn) return { ok: false, error: 'no-btn' };
    const before = (btn.textContent||'').trim();
    btn.click();
    // 最多等 6s 看 toast / 关闭 / 按钮恢复
    let toast = null, stillInjecting = true, stillOpen = true;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      toast = document.querySelector('.ow-toast')?.textContent || null;
      const b2 = [...document.querySelectorAll('button')].find(x => /注入/.test(x.textContent||''));
      stillInjecting = !!(b2 && /注入中/.test(b2.textContent||''));
      stillOpen = !!document.querySelector('.ow-overlay');
      if (toast || !stillOpen || !stillInjecting) break;
    }
    return {
      ok: true,
      before,
      toast,
      stillInjecting,
      stillOpen,
      afterBtn: [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim()).filter(t => /注入/.test(t)),
    };
  })()`)

  console.log(JSON.stringify(result, null, 2))

  const port = new URL(page.url).port
  const mb = await fetch(`http://127.0.0.1:${port}/api/open-world/messages`).then((r) => r.json())
  const hit = (mb.messages || []).find((m) => m.body?.includes(MARKER))
  console.log('mailbox', hit ? 'FOUND' : 'missing')

  // 聊天里是否有 IDEA 头
  const chat = await evaluate(`(() => {
    const t = document.body.innerText || '';
    return {
      hasIdeaHeader: t.includes('[IDEA Lab'),
      hasMarker: t.includes(${JSON.stringify(MARKER)}),
      toast: document.querySelector('.ow-toast')?.textContent || null,
      overlay: !!document.querySelector('.ow-overlay'),
    };
  })()`)
  console.log('chat', chat)
  ws.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
