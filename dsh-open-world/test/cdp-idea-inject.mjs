#!/usr/bin/env node
/** CDP 真机点一次 IDEA「注入对话」 */
import http from 'node:http'
import WebSocket from 'ws'

const CDP = 'http://127.0.0.1:9222'
const MARKER = `小肥鱼CDP试注入 ${new Date().toISOString()}`

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

async function connectPage() {
  const list = await getJson(`${CDP}/json/list`)
  const page = list.find((p) => p.type === 'page' && /127\.0\.0\.1/.test(p.url))
  if (!page) throw new Error('no DSH page')
  console.log('page:', page.url)
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
  const send = (method, params = {}) => {
    const mid = ++id
    return new Promise((resolve, reject) => {
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })
  }
  await send('Runtime.enable')
  await send('Page.enable')
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails))
    }
    return r.result?.value
  }
  return { ws, send, evaluate, url: page.url }
}

async function main() {
  console.log('\n=== CDP 真机注入试跑 ===\n')
  console.log('MARKER:', MARKER)
  const { ws, evaluate, url } = await connectPage()
  const port = new URL(url).port

  // 0) Host 先确认 API
  const host = await fetch(`http://127.0.0.1:${port}/api/open-world/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'idea-inject',
      presetId: 'xiaofeiyu',
      body: MARKER,
      treatAs: '主人',
      logMailbox: true,
    }),
  }).then((r) => r.json())
  console.log('Host wrap:', host.ok, host.preset?.title, 'len', host.wrapped?.length)

  // 1) 打开指挥舱
  const opened = await evaluate(`(() => {
    const overlay = document.querySelector('.ow-overlay');
    if (overlay) return { already: true };
    const btn = document.querySelector('.ow-trigger, button[aria-label*="Open World"], button[title*="开放世界"]');
    if (!btn) return { ok: false, error: 'no-trigger' };
    btn.click();
    return { ok: true, clicked: true };
  })()`)
  console.log('open:', opened)
  await new Promise((r) => setTimeout(r, 800))

  // 2) 切到 IDEA 视图
  const view = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('.ow-view-btn, button')];
    const hit = buttons.find(b => /IDEA/i.test(b.textContent||'') || /IDEA Lab/i.test(b.getAttribute('title')||''));
    if (hit) { hit.click(); return { ok: true, via: 'button', text: (hit.textContent||'').trim().slice(0,40) }; }
    // 底栏图标
    const views = [...document.querySelectorAll('[class*="ow-view"]')];
    const idea = views.find(v => /idea/i.test(v.className) || /IDEA/i.test(v.textContent||''));
    if (idea) { idea.click(); return { ok: true, via: 'view', text: idea.className }; }
    return { ok: false, views: views.slice(0,8).map(v => v.className || v.textContent?.slice(0,20)) };
  })()`)
  console.log('idea view:', view)
  await new Promise((r) => setTimeout(r, 500))

  // 3) 填入正文并点「注入对话」——优先直接走页面里与按钮相同的逻辑：填 textarea + click
  const clicked = await evaluate(`(async () => {
    const marker = ${JSON.stringify(MARKER)};
    const overlay = document.querySelector('.ow-overlay');
    if (!overlay) return { ok: false, error: 'overlay-not-open' };

    // 选中小肥鱼人格卡
    const cards = [...overlay.querySelectorAll('.ow-idea-card')];
    const fish = cards.find(c => /小肥鱼/.test(c.textContent||''));
    if (fish) fish.click();

    // 填 IDEA textarea（取可见的那个）
    const areas = [...overlay.querySelectorAll('textarea.ow-idea-prompt, textarea')];
    const ta = areas.find(a => a.offsetParent !== null) || areas[0];
    if (!ta) return { ok: false, error: 'no-idea-textarea', areas: areas.length };

    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(ta, marker); else ta.value = marker;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(r => setTimeout(r, 100));

    const btns = [...overlay.querySelectorAll('button')];
    const injectBtn = btns.find(b => (b.textContent||'').includes('注入对话'));
    if (!injectBtn) return { ok: false, error: 'no-inject-btn', btnTexts: btns.map(b => (b.textContent||'').trim()).filter(Boolean).slice(0,20) };
    if (injectBtn.disabled) return { ok: false, error: 'inject-disabled', value: ta.value };

    injectBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    const toast = document.querySelector('.ow-toast');
    const stillOpen = !!document.querySelector('.ow-overlay');
    return {
      ok: true,
      toast: toast ? toast.textContent : null,
      stillOpen,
      btnText: (injectBtn.textContent||'').trim(),
      bodyLen: ta.value.length,
    };
  })()`)
  console.log('click inject:', JSON.stringify(clicked, null, 2))

  // 4) 若按钮路径失败，直接调 Bridge 等价：Host wrapped + 尝试 conversation.send
  if (!clicked?.ok) {
    const fallback = await evaluate(`(async () => {
      const wrapped = ${JSON.stringify(host.wrapped || '')};
      if (!wrapped) return { ok: false, error: 'no-wrapped' };
      // 尽量走 session；找不到就报错
      try {
        // 无法直接拿 cordis ctx；改走页面全局如果有
        const ta = [...document.querySelectorAll('textarea')].find(el => !el.closest('.ow-overlay,.ow-root,[data-plugin=\"dsh-open-world\"]'));
        if (!ta) return { ok: false, error: 'chat-textarea-not-found' };
        const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        if (desc && desc.set) desc.set.call(ta, wrapped); else ta.value = wrapped;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        ta.dispatchEvent(new KeyboardEvent('keydown', opts));
        ta.dispatchEvent(new KeyboardEvent('keypress', opts));
        ta.dispatchEvent(new KeyboardEvent('keyup', opts));
        return { ok: true, strategy: 'cdp-dom-chat', len: wrapped.length };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    })()`)
    console.log('fallback:', fallback)
  }

  // 5) 信箱确认 Host 侧
  await new Promise((r) => setTimeout(r, 500))
  const mb = await fetch(`http://127.0.0.1:${port}/api/open-world/messages`).then((r) => r.json())
  const hit = (mb.messages || []).find((m) => m.body && m.body.includes(MARKER))
  console.log('mailbox:', hit ? `found kind=${hit.kind}` : 'NOT FOUND')

  // 6) 页面上是否出现 MARKER 文本（聊天里）
  const inDom = await evaluate(`(() => {
    const marker = ${JSON.stringify(MARKER)};
    const all = document.body.innerText || '';
    return { inPageText: all.includes(marker), overlay: !!document.querySelector('.ow-overlay'), toast: document.querySelector('.ow-toast')?.textContent || null };
  })()`)
  console.log('dom check:', inDom)

  ws.close()
  console.log('\n=== CDP 试跑结束 ===\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
