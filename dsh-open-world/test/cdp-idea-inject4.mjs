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
  const evaluate = async (expression, timeoutMs = 25000) => {
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
  const ctx = await attach()
  console.log('url', ctx.page.url)
  const port = new URL(ctx.page.url).port

  await ctx.evaluate(`(() => {
    if (!document.querySelector('.ow-overlay')) document.querySelector('.ow-trigger')?.click();
  })()`)
  await new Promise((r) => setTimeout(r, 1000))
  await ctx.evaluate(`(() => {
    [...document.querySelectorAll('button')].find(b => /IDEA Lab/i.test(b.textContent||''))?.click();
  })()`)
  await new Promise((r) => setTimeout(r, 700))

  const result = await ctx.evaluate(`(async () => {
    const marker = ${JSON.stringify(MARKER)};
    const o = document.querySelector('.ow-overlay');
    if (!o) return { ok:false, error:'no-overlay' };
    [...o.querySelectorAll('.ow-idea-card')].find(c => /小肥鱼/.test(c.textContent||''))?.click();

    const ta = [...o.querySelectorAll('textarea.ow-idea-prompt')].find(t => t.offsetWidth)
      || o.querySelector('textarea.ow-idea-prompt');
    if (!ta) return { ok:false, error:'no-ta' };
    ta.focus();
    ta.select();
    // React 受控：execCommand insertText 会走 onChange
    const okInsert = document.execCommand('insertText', false, marker);
    if (!okInsert) {
      const native = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      native.set.call(ta, marker);
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: marker }));
      // 最后手段：直接改 React props（fiber）
      const key = Object.keys(ta).find(k => k.startsWith('__reactProps$'));
      if (key && ta[key]?.onChange) {
        ta[key].onChange({ target: ta, currentTarget: ta });
      }
    }
    await new Promise(r => setTimeout(r, 200));

    const btn = [...o.querySelectorAll('button')].find(b => (b.textContent||'').trim() === '注入对话');
    if (!btn) {
      return {
        ok:false,
        error:'no-inject-dialog-btn',
        btns: [...o.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(t=>/注入/.test(t)),
        taValue: ta.value.slice(0,40),
        disabled: null,
      };
    }
    const disabledBefore = btn.disabled;
    btn.click();

    let toast=null, stillInjecting=false, stillOpen=true, btnText='';
    for (let i=0;i<35;i++){
      await new Promise(r => setTimeout(r, 200));
      toast = document.querySelector('.ow-toast')?.textContent || null;
      const b = [...document.querySelectorAll('button')].find(x => /注入/.test(x.textContent||''));
      btnText = b ? (b.textContent||'').trim() : '';
      stillInjecting = /注入中/.test(btnText);
      stillOpen = !!document.querySelector('.ow-overlay');
      if (toast && !/正在注入/.test(toast)) break;
      if (!stillOpen) break;
      if (i>10 && !stillInjecting && toast) break;
    }
    return { ok:true, okInsert, disabledBefore, toast, stillInjecting, stillOpen, btnText, taValue: ta.value.slice(0,60) };
  })()`)

  console.log('ui', JSON.stringify(result, null, 2))

  const mb = await fetch(`http://127.0.0.1:${port}/api/open-world/messages`).then((r) => r.json())
  const hit = (mb.messages || []).find((m) => m.body?.includes(MARKER))
  console.log('mailbox', hit ? `FOUND kind=${hit.kind}` : 'missing')

  const chat = await ctx.evaluate(`(() => {
    const t = document.body.innerText || '';
    return {
      hasIdeaHeader: t.includes('[IDEA Lab'),
      hasMarker: t.includes(${JSON.stringify(MARKER)}),
      toast: document.querySelector('.ow-toast')?.textContent || null,
      overlay: !!document.querySelector('.ow-overlay'),
    };
  })()`)
  console.log('chat', chat)
  ctx.ws.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
