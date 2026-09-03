#!/usr/bin/env node
import http from 'node:http'
import WebSocket from 'ws'

const MARKER = `CDP注入验证 ${new Date().toISOString()}`

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
      })
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
  const evaluate = async (expression, timeoutMs = 15000) => {
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
  console.log('\n=== CDP inject v3 ===')
  console.log('MARKER', MARKER)

  let ctx = await attach()
  console.log('url', ctx.page.url)

  // hard reload via navigate (more reliable than Page.reload over same WS)
  const u = new URL(ctx.page.url)
  u.searchParams.set('_owbust', String(Date.now()))
  console.log('navigate', u.href)
  await ctx.send('Page.enable')
  try {
    await Promise.race([
      ctx.send('Page.navigate', { url: u.href }),
      new Promise((r) => setTimeout(r, 2000)),
    ])
  } catch { /* ignore */ }
  ctx.ws.close()
  await new Promise((r) => setTimeout(r, 4500))

  ctx = await attach()
  console.log('reattached', ctx.page.url)

  // ensure client has new bridge (session-api-started string)
  const hasFix = await ctx.evaluate(`(() => {
    const scripts = [...document.querySelectorAll('script')].map(s => s.src).join(' ');
    return { href: location.href, hasOverlayCss: !!document.querySelector('style[data-plugin=\"dsh-open-world\"]') };
  })()`)
  console.log('page', hasFix)

  await ctx.evaluate(`(() => {
    if (!document.querySelector('.ow-overlay')) document.querySelector('.ow-trigger')?.click();
  })()`)
  await new Promise((r) => setTimeout(r, 1200))

  await ctx.evaluate(`(() => {
    [...document.querySelectorAll('button')].find(b => /IDEA Lab/i.test(b.textContent||''))?.click();
  })()`)
  await new Promise((r) => setTimeout(r, 800))

  const click = await ctx.evaluate(`(async () => {
    const marker = ${JSON.stringify(MARKER)};
    const o = document.querySelector('.ow-overlay');
    if (!o) return { ok: false, error: 'no-overlay' };
    [...o.querySelectorAll('.ow-idea-card')].find(c => /小肥鱼/.test(c.textContent||''))?.click();
    const ta = [...o.querySelectorAll('textarea.ow-idea-prompt')].find(t => t.offsetWidth) || o.querySelector('textarea');
    if (!ta) return { ok: false, error: 'no-ta' };
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc?.set) desc.set.call(ta, marker); else ta.value = marker;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const btn = [...o.querySelectorAll('button')].find(b => /注入对话|注入中/.test((b.textContent||'').trim()));
    if (!btn) return { ok: false, error: 'no-btn', sample: [...o.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(Boolean).slice(0,15) };
    btn.disabled = false;
    btn.click();
    let toast=null, stillInjecting=true, stillOpen=true;
    for (let i=0;i<40;i++){
      await new Promise(r => setTimeout(r, 200));
      toast = document.querySelector('.ow-toast')?.textContent || null;
      const b = [...document.querySelectorAll('button')].find(x => /注入/.test(x.textContent||''));
      stillInjecting = !!(b && /注入中/.test(b.textContent||''));
      stillOpen = !!document.querySelector('.ow-overlay');
      if ((toast && !/正在注入/.test(toast)) || !stillOpen) break;
      if (!stillInjecting && toast) break;
    }
    return { ok:true, toast, stillInjecting, stillOpen };
  })()`, 20000)

  console.log('click', JSON.stringify(click, null, 2))

  const port = new URL(ctx.page.url).port
  const mb = await fetch(`http://127.0.0.1:${port}/api/open-world/messages`).then((r) => r.json())
  console.log('mailbox', (mb.messages || []).some((m) => m.body?.includes(MARKER)) ? 'FOUND' : 'missing')

  const chat = await ctx.evaluate(`(() => ({
    hasIdeaHeader: (document.body.innerText||'').includes('[IDEA Lab'),
    hasMarker: (document.body.innerText||'').includes(${JSON.stringify(MARKER)}),
    toast: document.querySelector('.ow-toast')?.textContent || null,
    overlay: !!document.querySelector('.ow-overlay'),
  }))()`)
  console.log('chat', chat)
  ctx.ws.close()
  console.log('=== done ===\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
