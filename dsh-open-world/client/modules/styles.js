// Open World · styles（从 client-main 抽出）
window.__ModuleLoader__.load({
  id: 'dsh-open-world/styles',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const CSS = `
.ow-root,.ow-root *{box-sizing:border-box}
.ow-root{
  /* Apple-like 深色体系：中性近黑 + 单一金点缀 + 系统字体（数字用等宽） */
  --ow-bg-deep:#0A0A0C;--ow-bg-panel:rgba(255,255,255,.035);--ow-bg-elev:rgba(255,255,255,.06);
  --ow-border:rgba(255,255,255,.08);--ow-border-strong:rgba(255,255,255,.16);
  --ow-text:#F2F2F4;--ow-text-2:#A3A3A8;--ow-text-muted:#7A7A7A;
  --ow-accent:#E7B24B;--ow-accent-soft:rgba(231,178,75,.14);
  --ow-green:#30D158;--ow-orange:#FF9F0A;--ow-red:#FF453A;--ow-blue:#64D2FF;
  /* 兼容旧变量名（旧代码仍在使用） */
  --ow-cyan:var(--ow-accent);--ow-gold:#F0C674;--ow-glow:none;
  --ow-radius:12px;--ow-radius-sm:8px;--ow-shadow:0 10px 30px rgba(0,0,0,.5);
  --ow-mono:'SF Mono',ui-monospace,'Cascadia Mono',Consolas,monospace;
  --ow-display:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI Variable Display','Segoe UI','Microsoft YaHei UI',system-ui,sans-serif;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI Variable Text','Segoe UI','Microsoft YaHei UI',system-ui,sans-serif;
  color:var(--ow-text);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
.ow-trigger{display:grid;place-items:center;width:28px;height:28px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#aab);cursor:pointer;font-size:15px;transition:all .2s}
.ow-trigger:hover{background:rgba(231,178,75,.12);color:var(--ow-cyan);}
.ow-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;overflow:hidden;background:var(--ow-bg-deep);color:var(--ow-text);isolation:isolate;transition:width .2s ease,height .2s ease,inset .2s ease,border-radius .2s ease,box-shadow .2s ease}
.ow-overlay.is-split{inset:0 0 0 auto;width:min(56vw,960px);border-left:1px solid var(--ow-border-strong);box-shadow:-16px 0 48px rgba(0,0,0,.5)}
.ow-overlay.is-float{inset:auto;top:7vh;left:10vw;width:min(80vw,1180px);height:86vh;border-radius:8px;border:1px solid var(--ow-border-strong);box-shadow:0 24px 64px rgba(0,0,0,.55)}
.ow-overlay.is-float.is-dragging{transition:none;user-select:none}
.ow-overlay.is-minimized{inset:auto;left:14px;bottom:14px;width:auto;height:auto;background:transparent;border:none;box-shadow:none;overflow:visible;isolation:auto}
.ow-overlay.is-split .ow-body,.ow-overlay.is-float .ow-body{grid-template-columns:240px 1fr;padding:12px 14px}
.ow-overlay.is-split .ow-side-right,.ow-overlay.is-float .ow-side-right{display:none}
.ow-wm-bar{display:flex;align-items:center;gap:6px}
.ow-wm-btn{border:1px solid var(--ow-border);background:rgba(255,255,255,.04);color:var(--ow-text-2);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:11px;letter-spacing:0;transition:background .15s,color .15s,border-color .15s}
.ow-wm-btn:hover{color:var(--ow-text);background:rgba(255,255,255,.08)}
.ow-wm-btn.on{color:var(--ow-accent);border-color:rgba(231,178,75,.4);background:rgba(231,178,75,.08)}
.ow-dock{display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;background:rgba(20,20,22,.92);border:1px solid var(--ow-border-strong);backdrop-filter:blur(8px)}
.ow-dock-chip{display:inline-flex;align-items:center;gap:8px;border:none;background:transparent;color:var(--ow-cyan);cursor:pointer;font-size:12px;font-family:var(--ow-mono);padding:4px 10px;letter-spacing:.08em}
.ow-dock-chip:hover{color:#fff}
.ow-dock-mark{font-size:14px}
.ow-dock-unread{min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#FF453A;color:#fff;font-size:11px;display:grid;place-items:center}
.ow-dock-close{width:24px;height:24px;border:none;border-radius:999px;background:transparent;color:#A3A3A8;cursor:pointer;font-size:14px}
.ow-dock-close:hover{color:#ffb8b8;background:rgba(80,20,20,.35)}
.ow-fleet{display:flex;flex-direction:column;gap:4px}
.ow-fleet-summary{font-size:11px;color:#E7B24B;margin-bottom:6px;font-family:var(--ow-mono)}
.ow-fleet-hint{font-size:11px;color:#6B6B72;margin-bottom:6px;line-height:1.4}
.ow-fleet-row{display:grid;grid-template-columns:52px 1fr auto auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid rgba(231,178,75,.12);border-radius:8px;font-size:11px}
.ow-fleet-row.ow-clickable:hover{background:rgba(231,178,75,.06)}
.ow-fleet-row-static{cursor:default;opacity:.92}
.ow-fleet-row.status-running,.ow-fleet-row.status-active,.ow-fleet-row.status-busy{border-color:rgba(231,178,75,.35)}
.ow-fleet-kind{color:#A3A3A8;font-size:11px;letter-spacing:.04em}
.ow-fleet-main{min-width:0;display:flex;flex-direction:column;gap:3px}
.ow-fleet-title{color:#F2F2F4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-fleet-stages{display:flex;flex-wrap:wrap;gap:3px}
.ow-fleet-stage{font-size:11px;color:#A3A3A8;padding:1px 5px;border:1px solid rgba(148,163,184,.25);border-radius:8px;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-fleet-pct{color:#F0C674;font-family:var(--ow-mono);font-size:11px}
.ow-fleet-status{color:#E7B24B;font-size:11px}
.ow-topbar.is-float-drag{cursor:grab}
.ow-topbar.is-float-drag:active{cursor:grabbing}
.ow-overlay.is-arriving::after{content:'';position:absolute;inset:0;z-index:8;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(231,178,75,.22) 0%,transparent 55%),#0A0A0C;}
@keyframes owArrive{0%{opacity:1}100%{opacity:0}}
.ow-shell{position:relative;z-index:2;display:flex;flex-direction:column;height:100%}
.ow-ver{position:absolute;top:8px;right:140px;font-size:11px;color:rgba(231,178,75,.35);letter-spacing:.15em;z-index:3;pointer-events:none;font-family:var(--ow-mono)}
.ow-stale{position:absolute;top:28px;left:50%;transform:translateX(-50%);z-index:6;max-width:min(92vw,640px);padding:8px 14px;border:1px solid rgba(240,198,116,.45);border-radius:8px;background:rgba(40,28,8,.92);color:#F0C674;font-size:11px;font-family:var(--ow-mono);text-align:center;pointer-events:none;letter-spacing:.02em}
.ow-bridge-health{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;padding:6px 8px;border:1px solid rgba(231,178,75,.1);border-radius:8px;background:rgba(5,4,3,.45);font-size:11px}
.ow-bridge-label{color:#A3A3A8;letter-spacing:.02em;margin-right:4px}
.ow-bridge-chip{padding:2px 6px;border-radius:8px;border:1px solid rgba(231,178,75,.15);color:#A3A3A8}
.ow-bridge-chip.ok{border-color:rgba(231,178,75,.35);color:#E7B24B}
.ow-bridge-chip.warn{border-color:rgba(251,191,36,.4);color:#fbbf24}
.ow-bridge-chip.bad{border-color:rgba(255,120,120,.35);color:#ff9090}
.ow-bridge-refresh{margin-left:auto;padding:2px 6px;border:1px solid rgba(231,178,75,.2);background:transparent;color:#E7B24B;border-radius:8px;cursor:pointer;font-size:11px}
.ow-metaphor-tag{display:inline-block;margin-left:8px;padding:1px 6px;font-size:10.5px;letter-spacing:.5px;border:1px solid rgba(100,210,255,.35);color:#64D2FF;border-radius:8px;vertical-align:middle}
.ow-derived-tag{display:inline-block;margin-left:6px;padding:1px 5px;font-size:10.5px;border:1px solid rgba(231,178,75,.2);color:#A3A3A8;border-radius:8px}
.ow-topbar{height:48px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ow-border);background:rgba(10,10,12,.65);backdrop-filter:blur(20px) saturate(140%);position:relative}
.ow-topbar-left,.ow-topbar-right{display:flex;align-items:center;gap:22px}
.ow-brand{display:flex;align-items:center;gap:10px}
.ow-brand-logo{width:18px;height:18px;position:relative;border-radius:50%;background:radial-gradient(circle at 35% 32%,#F6DFA6 0%,var(--ow-accent) 46%,rgba(231,178,75,.12) 78%,transparent 100%);box-shadow:0 0 8px rgba(231,178,75,.35),inset -1px -2px 3px rgba(10,10,12,.55)}
.ow-brand-logo::before{content:'';position:absolute;left:50%;top:50%;width:26px;height:9px;margin:-4.5px 0 0 -13px;border:1px solid rgba(231,178,75,.45);border-top-color:rgba(231,178,75,.15);border-radius:50%;transform:rotate(-22deg);pointer-events:none}
.ow-brand-logo::after{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 68% 70%,rgba(10,10,12,.5) 0%,transparent 52%)}
.ow-brand-name{font-size:13px;font-weight:590;letter-spacing:0;color:var(--ow-text)}
.ow-icon-btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;color:var(--ow-text-2);cursor:default;background:transparent;transition:background .18s,color .18s}
.ow-icon-btn:hover{color:var(--ow-text);background:rgba(255,255,255,.08)}
.ow-topbar-clock{font-family:var(--ow-mono);font-size:11.5px;color:var(--ow-text-muted);margin-right:10px;font-variant-numeric:tabular-nums}
.ow-close{border:1px solid var(--ow-border);background:rgba(255,255,255,.04);color:var(--ow-text-2);border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:500;letter-spacing:0;transition:background .18s,color .18s}
.ow-close:hover{background:rgba(255,255,255,.09);color:var(--ow-text)}
.ow-body{flex:1;display:grid;grid-template-columns:300px 1fr 300px;gap:0;padding:16px 20px;min-height:0}
.ow-side{display:flex;flex-direction:column;overflow-y:auto;min-height:0}
.ow-side-left{padding-right:4px}
.ow-side-tabs{display:flex;gap:4px;margin-bottom:10px;padding:0 2px;position:sticky;top:0;z-index:3;background:rgba(10,10,12,.85);backdrop-filter:blur(12px)}
.ow-side-tab{flex:1;border:1px solid var(--ow-border);background:rgba(255,255,255,.03);color:var(--ow-text-muted);font-size:11px;padding:7px 4px;cursor:pointer;border-radius:8px;letter-spacing:0;transition:border-color .15s,color .15s,background .15s}
.ow-side-tab:hover{color:var(--ow-text-2)}
.ow-side-tab.on{border-color:var(--ow-cyan);color:var(--ow-cyan);background:rgba(231,178,75,.08)}
.ow-side-hint{font-size:11px;color:#6B6B72;line-height:1.55;margin-bottom:8px;padding:0 4px}
.ow-status-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ow-status-chip{font-size:11px;padding:3px 8px;border:1px solid rgba(231,178,75,.15);border-radius:8px;color:#A3A3A8}
.ow-status-chip.ok{border-color:rgba(231,178,75,.35);color:#E7B24B}
.ow-status-chip.off{opacity:.55}
.ow-side-right{padding-left:4px}
.ow-side::-webkit-scrollbar{width:3px}
.ow-side::-webkit-scrollbar-thumb{background:var(--ow-border-strong);border-radius:8px}
.ow-panel{background:var(--ow-bg-panel);border:1px solid var(--ow-border);border-radius:8px;position:relative;backdrop-filter:blur(4px);margin-bottom:14px}
.ow-panel::before,.ow-panel::after{content:'';position:absolute;width:10px;height:10px;border-color:var(--ow-cyan);border-style:solid;border-width:0;pointer-events:none}
.ow-panel::before{top:-1px;left:-1px;border-top-width:1.5px;border-left-width:1.5px}
.ow-panel::after{bottom:-1px;right:-1px;border-bottom-width:1.5px;border-right-width:1.5px}
.ow-panel-head{padding:12px 16px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ow-border)}
.ow-panel-title{display:flex;flex-direction:column;gap:2px}
.ow-panel-title-zh{font-size:13px;font-weight:500;color:var(--ow-text);letter-spacing:.02em}
.ow-panel-title-en{font-size:11px;color:var(--ow-text-muted);letter-spacing:.02em;font-family:var(--ow-mono);text-transform:uppercase}
.ow-panel-more{font-size:11px;color:var(--ow-text-muted);cursor:pointer}
.ow-panel-body{padding:14px 16px}
.ow-center{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0}
.ow-galaxy-wrap{position:relative;width:100%;height:100%;max-width:720px;max-height:720px;aspect-ratio:1/1}
.ow-galaxy-title{position:absolute;top:8%;left:50%;transform:translateX(-50%);font-family:var(--ow-display);font-size:13px;color:var(--ow-text-muted);letter-spacing:8px;text-transform:uppercase;opacity:.6;z-index:1}
.ow-galaxy-svg{width:100%;height:100%}
.ow-orbit-ring{fill:none;stroke:rgba(231,178,75,.08);stroke-width:1;stroke-dasharray:4 6}
.ow-orbit-ring.hl{stroke:rgba(231,178,75,.18);stroke-dasharray:none}
.ow-rotate-slow{transform-origin:350px 350px}
.ow-rotate-slow2{transform-origin:350px 350px}
.ow-rotate-rev{transform-origin:350px 350px}
@keyframes owSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ow-core-pulse{}
@keyframes owPulse{0%,100%{opacity:.85}50%{opacity:1}}
.ow-node{cursor:pointer}
.ow-node:hover{filter:brightness(1.15)}
.ow-orbit-hint{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:8px;background:rgba(20,20,22,.88);border:1px solid var(--ow-border);font-size:12px;color:var(--ow-cyan);white-space:nowrap;backdrop-filter:blur(8px);z-index:2;font-family:var(--ow-mono)}
.ow-health-wrap{display:flex;align-items:center;justify-content:center;padding:4px 0 10px;position:relative}
.ow-health-ring{position:relative;width:110px;height:110px}
.ow-health-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.ow-health-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ow-health-val{font-family:var(--ow-display);font-size:32px;font-weight:600;color:var(--ow-cyan);line-height:1;}
.ow-health-unit{font-size:11px;color:var(--ow-text-muted);font-family:var(--ow-mono);margin-top:2px}
.ow-health-label{text-align:center;margin-top:2px}
.ow-health-label-main{font-size:12px;color:var(--ow-text-2);letter-spacing:.02em}
.ow-health-label-sub{font-size:11px;color:var(--ow-text-muted);letter-spacing:.02em;font-family:var(--ow-mono);margin-top:2px}
.ow-spark{width:100%;height:36px;display:block;margin-top:8px}
.ow-load-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(231,178,75,.07)}
.ow-load-item:last-child{border-bottom:none}
.ow-load-label{font-family:var(--ow-mono);font-size:12px;color:var(--ow-text-2);letter-spacing:.02em;width:44px}
.ow-load-wave{flex:1;height:24px;margin:0 8px}
.ow-load-val{font-family:var(--ow-mono);font-size:13px;color:var(--ow-text);font-weight:500;width:60px;text-align:right}
.ow-event-list{display:flex;flex-direction:column;gap:10px}
.ow-event-item{display:flex;align-items:center;gap:10px;font-size:12px}
.ow-event-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;box-shadow:0 0 6px currentColor}
.ow-event-dot.green{background:var(--ow-green);color:var(--ow-green)}
.ow-event-dot.gold{background:var(--ow-gold);color:var(--ow-gold)}
.ow-event-dot.cyan{background:var(--ow-cyan);color:var(--ow-cyan)}
.ow-event-dot.orange{background:var(--ow-orange);color:var(--ow-orange)}
.ow-event-dot.purple{background:#64D2FF;color:#64D2FF}
.ow-event-text{flex:1;color:var(--ow-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-event-time{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);flex-shrink:0}
.ow-radar{width:100%;height:120px}
.ow-sector-foot{display:flex;align-items:center;justify-content:space-between;padding:6px 4px 2px;font-size:12px;color:var(--ow-text-2)}
.ow-sector-arrow{color:var(--ow-cyan);font-size:14px}
.ow-donut-wrap{display:flex;flex-direction:column;align-items:center;padding:4px 0 10px}
.ow-donut{position:relative;width:120px;height:120px}
.ow-donut svg{width:100%;height:100%;transform:rotate(-90deg)}
.ow-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.ow-donut-total{font-family:var(--ow-display);font-size:26px;font-weight:600;color:var(--ow-text);line-height:1}
.ow-donut-label{font-size:11px;color:var(--ow-text-muted);margin-top:4px;letter-spacing:.02em}
.ow-res-list{display:flex;flex-direction:column;gap:8px;margin-top:8px;width:100%}
.ow-res-item{display:flex;align-items:center;gap:8px;font-size:12px}
.ow-res-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.ow-res-name{flex:1;color:var(--ow-text-2)}
.ow-res-val{font-family:var(--ow-mono);color:var(--ow-text);font-weight:500}
.ow-res-pct{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);width:38px;text-align:right}
.ow-task-list{display:flex;flex-direction:column;gap:12px}
.ow-task-item{display:flex;flex-direction:column;gap:6px}
.ow-task-head{display:flex;align-items:center;justify-content:space-between;font-size:12px}
.ow-task-name{color:var(--ow-text-2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-task-status{font-family:var(--ow-mono);font-size:11px;padding:1px 6px;border-radius:8px;margin-left:8px;letter-spacing:.5px}
.ow-task-status.running{color:var(--ow-cyan);background:rgba(231,178,75,.1);border:1px solid rgba(231,178,75,.25)}
.ow-task-status.pending{color:var(--ow-text-muted);background:rgba(74,90,112,.15);border:1px solid rgba(74,90,112,.3)}
.ow-task-pct{font-family:var(--ow-mono);font-size:11px;color:var(--ow-gold);margin-left:6px;width:32px;text-align:right}
.ow-task-bar{height:3px;background:rgba(231,178,75,.1);border-radius:8px;overflow:hidden}
.ow-task-fill{height:100%;border-radius:8px;transition:width 1s ease}
.ow-task-fill.cyan{background:linear-gradient(to right,#8a5e10,var(--ow-cyan));box-shadow:0 0 6px rgba(231,178,75,.5)}
.ow-task-fill.gold{background:linear-gradient(to right,#d4a74b,var(--ow-gold));box-shadow:0 0 6px rgba(240,198,116,.5)}
.ow-task-fill.dim{background:var(--ow-text-muted);opacity:.4}
.ow-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ow-action-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 4px;border:1px solid var(--ow-border);border-radius:8px;background:rgba(231,178,75,.03);cursor:pointer;transition:all .2s;color:var(--ow-text-2)}
.ow-action-btn:hover{border-color:var(--ow-cyan);color:var(--ow-cyan);background:rgba(231,178,75,.08);}
.ow-action-label{font-size:11px;letter-spacing:.5px}
.ow-bottom{height:110px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding:0 20px;border-top:1px solid var(--ow-border);background:rgba(10,10,12,.65);backdrop-filter:blur(20px) saturate(140%);position:relative}
.ow-log-wrap{display:flex;flex-direction:column;gap:6px;max-height:80px;overflow:hidden}
.ow-log-head{display:flex;align-items:center;justify-content:space-between}
.ow-log-title{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:.02em}
.ow-log-line{display:flex;gap:10px;align-items:center;font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-2)}
.ow-log-time{color:var(--ow-text-muted);font-size:11px}
.ow-log-dot{width:5px;height:5px;border-radius:50%;background:var(--ow-green)}
.ow-view-switch{display:flex;gap:0;align-items:center;position:relative}
.ow-view-btn{position:relative;width:140px;height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:var(--ow-text-2);transition:background .18s,color .18s,border-color .18s;background:transparent;border:1px solid transparent;border-radius:12px;padding:0}
.ow-view-btn:hover{color:var(--ow-text);background:rgba(255,255,255,.05)}
.ow-view-btn.on{color:var(--ow-text);background:rgba(255,255,255,.07);border-color:var(--ow-border-strong)}
.ow-view-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px}
.ow-view-label{font-size:12px;letter-spacing:.02em}
.ow-view-sub{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:.02em}
.ow-bottom-right{display:flex;align-items:center;justify-content:flex-end;gap:30px}
.ow-metric{display:flex;flex-direction:column;gap:4px}
.ow-metric-label{display:flex;flex-direction:column;gap:2px}
.ow-metric-zh{font-size:11px;color:var(--ow-text-2);letter-spacing:.02em}
.ow-metric-en{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:.02em}
.ow-metric-val{font-family:var(--ow-mono);font-size:15px;font-weight:500;color:var(--ow-text);line-height:1}
.ow-metric-val .u{font-size:12px;color:var(--ow-text-2);margin-left:2px}
.ow-metric-bar{height:3px;background:rgba(231,178,75,.1);border-radius:8px;overflow:hidden;width:100px}
.ow-metric-fill{height:100%;border-radius:8px;transition:width 1s ease}
.ow-monitor{padding:24px;width:100%;max-width:860px;z-index:2}
.ow-monitor pre{background:rgba(0,0,0,.4);border:1px solid var(--ow-border);border-radius:8px;padding:16px;font-size:11px;overflow:auto;max-height:58vh;color:var(--ow-cyan);font-family:var(--ow-mono)}
.ow-error{color:#ff9090;font-size:12px;padding:8px 18px;background:rgba(80,20,20,.3);z-index:3}
.ow-integ-list{display:flex;flex-direction:column;gap:8px}
.ow-integ-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--ow-border);border-radius:8px;background:rgba(231,178,75,.02);cursor:pointer;transition:all .2s}
.ow-integ-item:hover{border-color:var(--ow-cyan);background:rgba(231,178,75,.08);}
.ow-integ-item.offline{opacity:.55;cursor:default}
.ow-integ-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ow-integ-dot.online{background:var(--ow-green);box-shadow:0 0 6px var(--ow-green)}
.ow-integ-dot.idle{background:var(--ow-gold);box-shadow:0 0 6px var(--ow-gold)}
.ow-integ-dot.missing{background:var(--ow-text-muted)}
.ow-integ-name{flex:1;font-size:12px;color:var(--ow-text)}
.ow-integ-en{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:.08em}
.ow-action-bar{display:flex;align-items:center;gap:10px;margin-top:8px}
.ow-action-bar button{flex:1;padding:8px 12px;border:1px solid var(--ow-border);border-radius:8px;background:rgba(231,178,75,.06);color:var(--ow-cyan);font-size:11px;cursor:pointer;transition:all .2s}
.ow-action-bar button:hover{border-color:var(--ow-cyan);}
.ow-action-bar button.sec{color:var(--ow-text-2);background:transparent}
.ow-orbit-hint{display:flex;flex-direction:column;align-items:center;gap:8px}
.ow-clickable{cursor:pointer}
.ow-clickable:hover .ow-task-name{color:var(--ow-cyan)}
.ow-toast{position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;border:1px solid var(--ow-border-strong);border-radius:10px;background:rgba(20,20,22,.96);color:var(--ow-text);font-size:12.5px;pointer-events:none;max-width:min(92vw,520px);text-align:center;backdrop-filter:blur(12px)}
.ow-topo{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:24px;width:100%;max-width:920px;z-index:2}
.ow-topo-card{padding:14px;border:1px solid var(--ow-border);border-radius:8px;background:rgba(20,20,22,.8);cursor:pointer;transition:all .2s}
.ow-topo-card:hover{border-color:var(--ow-cyan);box-shadow:0 0 20px rgba(231,178,75,.08)}
.ow-neural-wrap{position:relative;width:100%;height:100%;max-width:860px;max-height:560px;aspect-ratio:860/560}
.ow-neural-title{position:absolute;top:4%;left:50%;transform:translateX(-50%);font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:6px;z-index:1}
.ow-neural-svg{width:100%;height:100%}
.ow-nn-layer-label{font-family:var(--ow-mono);font-size:10.5px;fill:#6B6B72;letter-spacing:.02em}
.ow-nn-layer-label-zh{font-size:11px;fill:#A3A3A8}
.ow-nn-edge{fill:none;stroke-width:1.5;opacity:.35;transition:opacity .3s,stroke-width .3s}
.ow-nn-edge.active{opacity:.85;stroke-width:2}
.ow-nn-edge-glow{fill:none;stroke-width:4;opacity:.12;filter:blur(2px)}
.ow-nn-node{cursor:grab;transition:filter .2s}
.ow-nn-node:hover{filter:brightness(1.2)}
.ow-nn-node.dragging{cursor:grabbing;filter:brightness(1.35)}
.ow-neural-toolbar{position:absolute;top:4%;right:8%;display:flex;gap:6px;z-index:2}
.ow-neural-btn{font-family:var(--ow-mono);font-size:11px;padding:4px 10px;border:1px solid rgba(231,178,75,.25);background:rgba(20,20,22,.75);color:var(--ow-text-muted);cursor:pointer;border-radius:8px;letter-spacing:.02em}
.ow-neural-btn:hover{border-color:var(--ow-cyan);color:var(--ow-cyan)}
.ow-nn-edge-hit{fill:none;stroke:transparent;stroke-width:12;pointer-events:stroke;cursor:pointer}
.ow-nn-tooltip{position:fixed;pointer-events:none;padding:6px 10px;background:rgba(20,20,22,.92);border:1px solid rgba(231,178,75,.3);border-radius:8px;font-family:var(--ow-mono);font-size:11px;color:#F2F2F4;z-index:9999;white-space:nowrap}
.ow-nn-tooltip-w{font-size:11px;color:#F0C674;margin-top:2px}
.ow-neural-hint{position:absolute;bottom:2%;left:50%;transform:translateX(-50%);font-size:11px;color:#6B6B72;font-family:var(--ow-mono);letter-spacing:.02em;z-index:1}
.ow-nn-neuron{stroke:rgba(255,255,255,.2);stroke-width:1}
.ow-nn-neuron.sel{stroke:#fff;stroke-width:2.5}
.ow-nn-label{font-size:11px;fill:#F2F2F4;font-weight:500}
.ow-nn-metric{font-size:11px;fill:#F0C674;font-family:var(--ow-mono)}
.ow-nn-pulse{}
.ow-vp-wrap{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none}
.ow-vp-inner{position:absolute;inset:0;transform-origin:50% 50%;will-change:transform}
.ow-vp-bg{position:absolute;inset:-40%;pointer-events:none}
.ow-cmd-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh}
.ow-cmd{min-width:min(520px,92vw);background:rgba(20,20,22,.97);border:1px solid var(--ow-border-strong);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}
.ow-cmd-input{width:100%;padding:14px 16px;border:none;background:transparent;color:var(--ow-text);font-size:14px;outline:none;font-family:var(--ow-mono)}
.ow-cmd-list{max-height:320px;overflow-y:auto;border-top:1px solid var(--ow-border)}
.ow-cmd-item{padding:10px 16px;cursor:pointer;display:flex;justify-content:space-between;gap:12px;font-size:13px}
.ow-cmd-item:hover,.ow-cmd-item.sel{background:rgba(231,178,75,.08)}
.ow-cmd-item span:last-child{font-size:11px;color:var(--ow-text-muted);font-family:var(--ow-mono)}
.ow-embed{position:absolute;inset:8% 6%;z-index:5;background:rgba(20,20,22,.94);border:1px solid var(--ow-border-strong);border-radius:6px;display:flex;flex-direction:column;backdrop-filter:blur(8px)}
.ow-embed-head{padding:10px 14px;border-bottom:1px solid var(--ow-border);display:flex;justify-content:space-between;align-items:center}
.ow-embed-body{flex:1;overflow:auto;padding:12px 14px}
.ow-detail-card{position:absolute;top:12px;right:12px;width:240px;z-index:4;background:rgba(20,20,22,.92);border:1px solid var(--ow-border-strong);border-radius:6px;padding:12px 14px;backdrop-filter:blur(6px)}
.ow-detail-title{font-size:13px;font-weight:600;color:var(--ow-text);margin-bottom:4px}
.ow-detail-sub{font-size:11px;color:var(--ow-text-muted);font-family:var(--ow-mono);margin-bottom:10px}
.ow-detail-row{display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(231,178,75,.06)}
.ow-detail-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.ow-detail-actions button{font-size:11px;padding:5px 10px;border:1px solid var(--ow-border);background:rgba(231,178,75,.08);color:var(--ow-cyan);cursor:pointer;border-radius:8px}
.ow-ati-wrap{position:relative;width:100%;height:100%;max-width:920px;max-height:600px;aspect-ratio:920/600}
.ow-ati-title{position:absolute;top:2%;left:50%;transform:translateX(-50%);z-index:2}
.ow-ati-sub{position:absolute;top:6%;left:50%;transform:translateX(-50%);font-size:11px;color:#A3A3A8;letter-spacing:4px;z-index:2;font-family:var(--ow-mono)}
.ow-ati-svg{width:100%;height:100%}
.ow-ati-poincare{fill:rgba(20,20,22,.4);stroke:rgba(231,178,75,.12);stroke-width:1}
.ow-ati-geodesic{fill:none;stroke:rgba(231,178,75,.08);stroke-width:.8}
.ow-ati-torus{fill:none;stroke:rgba(255,255,255,.1);stroke-width:1}
.ow-ati-dl-box{fill:rgba(12,20,36,.7);stroke:rgba(240,198,116,.35);stroke-width:1}
.ow-ati-dl-box.hl{stroke:#F0C674;)}
.ow-ati-dl-label{font-family:var(--ow-mono);font-size:11px;fill:#F0C674;letter-spacing:.5px}
.ow-ati-dl-zh{font-size:11px;fill:#A3A3A8}
.ow-ati-hex{fill:none;stroke:rgba(48,209,88,.4);stroke-width:1.2}
.ow-ati-hex-node{fill:rgba(48,209,88,.25);stroke:#30D158;stroke-width:1}
.ow-ati-bar{fill:rgba(231,178,75,.25)}
.ow-ati-singularity{filter:none}
.ow-ati-metric{font-family:var(--ow-mono);font-size:11px;fill:#64D2FF}
.ow-ati-preset-bar{position:absolute;bottom:2%;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:4px;z-index:3;max-width:640px}
.ow-ati-preset{font-size:11.5px;padding:4px 11px;border:1px solid var(--ow-border);background:rgba(255,255,255,.03);color:var(--ow-text-2);cursor:pointer;border-radius:999px;letter-spacing:0;transition:all .18s}
.ow-ati-preset:hover{border-color:var(--ow-border-strong);color:var(--ow-text)}
.ow-ati-preset.on{border-color:rgba(231,178,75,.55);color:var(--ow-accent);background:rgba(231,178,75,.07)}
.ow-ati-preset.g-top.on{border-color:rgba(231,178,75,.55);color:var(--ow-accent);background:rgba(231,178,75,.07)}
.ow-ati-preset.g-ml.on{border-color:rgba(231,178,75,.55);color:var(--ow-accent);background:rgba(231,178,75,.07)}
.ow-ati-preset.g-chem.on{border-color:rgba(231,178,75,.55);color:var(--ow-accent);background:rgba(231,178,75,.07)}
.ow-ati-lab-details{position:relative}
.ow-ati-lab-details>summary{list-style:none}
.ow-ati-lab-details>summary::-webkit-details-marker{display:none}
.ow-ati-lab-presets{position:absolute;bottom:120%;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:4px;width:max-content;max-width:360px;padding:6px;background:rgba(20,20,22,.96);border:1px solid var(--ow-border);border-radius:10px}
.ow-shell-guide{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;padding:8px 10px;border:1px solid rgba(231,178,75,.25);background:rgba(231,178,75,.06);border-radius:6px}
.ow-shell-guide-text{flex:1;font-size:11px;line-height:1.45;color:#A3A3A8}
.ow-shell-guide-text strong{color:#E7B24B;font-weight:600}
.ow-shell-guide-x{flex-shrink:0;font-size:11px;padding:4px 8px;border:1px solid rgba(148,163,184,.35);background:transparent;color:#A3A3A8;border-radius:8px;cursor:pointer}
.ow-shell-guide-x:hover{border-color:#E7B24B;color:var(--ow-accent)}
.ow-empty-cue{margin:0 0 10px;padding:12px 12px 10px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:linear-gradient(160deg,rgba(231,178,75,.07),rgba(20,20,22,.4))}
.ow-empty-cue-slim{padding:8px 10px;margin-bottom:8px}
.ow-empty-cue-art{position:relative;width:44px;height:44px;margin:0 0 8px}
.ow-empty-cue-ring{position:absolute;inset:4px;border:1.5px solid rgba(231,178,75,.35);border-radius:50%}
.ow-empty-cue-dot{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#E7B24B;box-shadow:0 0 10px rgba(231,178,75,.45)}
.ow-empty-cue-ray{position:absolute;left:50%;top:2px;width:1.5px;height:12px;margin-left:-0.75px;background:rgba(231,178,75,.55);transform-origin:bottom center;}
@keyframes ow-empty-pulse{0%,100%{opacity:.35;transform:scaleY(.7)}50%{opacity:1;transform:scaleY(1)}}
.ow-empty-cue-title{font-size:12px;color:#e2e8f0;font-weight:600;margin-bottom:4px}
.ow-empty-cue-body{font-size:11px;line-height:1.5;color:#A3A3A8;margin-bottom:8px}
.ow-empty-cue-actions{display:flex;flex-wrap:wrap;gap:6px}
.ow-memory-tabs{margin-bottom:8px}
.ow-adv-fold{border-top:1px solid rgba(148,163,184,.12)}
.ow-ati-hud{position:absolute;top:10%;left:2.5%;font-family:var(--ow-mono);font-size:10.5px;color:#A3A3A8;line-height:1.7;z-index:2;max-width:300px}
.ow-ati-hud b{color:var(--ow-text);font-weight:500}
.ow-ati-stage-tag{position:absolute;top:9%;right:2.5%;z-index:2;font-family:var(--ow-mono);font-size:11px;color:#A3A3A8;text-align:right;line-height:1.9}
.ow-ati-stage-tag b{color:#E7B24B;font-weight:500;letter-spacing:.02em}
.ow-lab-wire{fill:none;stroke-width:1;opacity:.85}
.ow-lab-wire.cyan{stroke:#E7B24B}
.ow-lab-wire.violet{stroke:#64D2FF}
.ow-lab-wire.gold{stroke:#F0C674}
.ow-lab-wire.green{stroke:#30D158}
.ow-lab-wire.pink{stroke:#FF9F0A}
.ow-lab-wire-dim{fill:none;stroke-width:.7;stroke:#E7B24B;opacity:.16}
.ow-lab-loss{fill:none;stroke:#E7B24B;stroke-width:2}
.ow-lab-loss-area{fill:rgba(231,178,75,.08)}
.ow-lab-contour{fill:rgba(100,210,255,.05);stroke:#64D2FF;stroke-width:.8;stroke-dasharray:3 5}
.ow-lab-axis{stroke:rgba(124,142,166,.25);stroke-width:.7}
.ow-lab-tick{font-family:var(--ow-mono);font-size:10.5px;fill:#A3A3A8}
.ow-lab-title{font-family:var(--ow-mono);font-size:12px;fill:#e6d2a6;letter-spacing:1.4px;}
.ow-lab-title.dim{font-size:10.5px;fill:#A3A3A8}
.ow-lab-elem{stroke:#30D158;stroke-width:1;transition:filter .2s}
.ow-lab-elem:hover{filter:brightness(1.25)}
.ow-lab-elem.metal{stroke:#FF9F0A}
.ow-lab-elem.nonmetal{stroke:#E7B24B}
.ow-lab-elem.carbon{stroke:#64D2FF}
.ow-lab-elem-symbol{font-family:var(--ow-mono);font-size:15px;font-weight:700;text-anchor:middle}
.ow-lab-elem-z{font-family:var(--ow-mono);font-size:11px;fill:#A3A3A8;text-anchor:middle}
.ow-lab-elem-name{font-family:var(--ow-mono);font-size:11px;fill:#A3A3A8;text-anchor:middle}
.ow-lab-elem-metric{font-family:var(--ow-mono);font-size:11px;fill:#F0C674;text-anchor:middle}
.ow-lab-bond{fill:none;stroke:rgba(48,209,88,.45);stroke-width:1}
.ow-lab-bond.double{stroke-width:1.6}
.ow-lab-atom{fill:rgba(20,20,22,.9);stroke:#30D158;stroke-width:1.2}
.ow-lab-electron{fill:#E7B24B;opacity:.9}
.ow-lab-att-cell{stroke:rgba(20,20,22,.8);stroke-width:1}
.ow-lab-sub{font-family:var(--ow-mono);font-size:10.5px;fill:#A3A3A8;letter-spacing:.2px}
.ow-lab-att-value{font-family:var(--ow-mono);font-size:11px;pointer-events:none}
.ow-lab-att-token{font-family:var(--ow-mono);font-size:11px;fill:#b39a63;text-anchor:middle}
.ow-lab-evo-ring{fill:none;stroke:rgba(124,142,166,.18);stroke-width:1}
.ow-lab-evo-ring.on{stroke:rgba(100,210,255,.7);stroke-width:1.6;)}
.ow-lab-evo-label{font-family:var(--ow-mono);font-size:10.5px;fill:#A3A3A8;text-anchor:middle;letter-spacing:.02em}
.ow-lab-evo-label.on{fill:#EAF4FF}
.ow-lab-evo-val{font-family:var(--ow-mono);font-size:18px;fill:#F2F2F4;text-anchor:middle;font-weight:700}
.ow-lab-grad-arrow{stroke:#E7B24B;stroke-width:1.4;fill:none;marker-end:url(#owLabArrow)}
.ow-lab-node{fill:rgba(20,20,22,.55);stroke:rgba(240,198,116,.5);stroke-width:1}
.ow-lab-node.on{stroke:#F0C674;)}
.ow-social-tag{font-size:11px;color:#A3A3A8;margin-top:2px;letter-spacing:.5px;max-width:200px;line-height:1.4}
.ow-social-list{display:flex;flex-direction:column;gap:8px}
.ow-social-presence{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;border:1px solid rgba(231,178,75,.1);cursor:pointer;transition:background .2s}
.ow-social-presence:hover{background:rgba(231,178,75,.06)}
.ow-social-presence.active{border-color:rgba(100,210,255,.4);background:rgba(100,210,255,.08)}
.ow-social-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#E7B24B,#64D2FF);display:grid;place-items:center;font-size:11px;font-weight:700;color:#0A0A0C;flex-shrink:0}
.ow-social-name{font-size:12px;color:#F2F2F4}
.ow-social-sub{font-size:11px;color:#A3A3A8;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-social-channel{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid rgba(231,178,75,.12);border-radius:8px;cursor:pointer;font-size:12px}
.ow-social-channel:hover{border-color:var(--ow-cyan)}
.ow-social-channel.off{opacity:.45;cursor:default}
.ow-social-feed-item{font-size:11px;padding:6px 0;border-bottom:1px solid rgba(231,178,75,.06);display:flex;gap:8px}
.ow-social-kind{font-size:11px;color:#64D2FF;font-family:var(--ow-mono);min-width:42px}
.ow-msg-hub{display:flex;flex-direction:column;gap:10px}
.ow-msg-compose textarea{width:100%;min-height:64px;background:rgba(20,20,22,.8);border:1px solid var(--ow-border);border-radius:8px;color:#F2F2F4;padding:8px;font-size:12px;resize:vertical;font-family:inherit}
.ow-msg-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ow-msg-select,.ow-msg-btn{font-size:11px;padding:5px 8px;border:1px solid var(--ow-border);background:rgba(20,20,22,.75);color:var(--ow-text-muted);border-radius:8px;font-family:var(--ow-mono)}
.ow-msg-btn:disabled{opacity:.4;cursor:not-allowed}
.ow-msg-btn.primary{border-color:#64D2FF;color:#EAF4FF;cursor:pointer}
.ow-msg-btn.primary:hover{box-shadow:0 0 10px rgba(100,210,255,.3)}
.ow-msg-btn.primary:disabled:hover{box-shadow:none}
.ow-msg-item{padding:8px;border:1px solid rgba(231,178,75,.1);border-radius:8px;font-size:11px;cursor:pointer}
.ow-msg-item.unread{border-color:rgba(100,210,255,.45);background:rgba(100,210,255,.06)}
.ow-msg-meta{font-size:11px;color:#A3A3A8;margin-top:4px}
.ow-msg-attach{font-size:11px;color:#64D2FF;margin-top:4px}
.ow-hub{display:flex;flex-direction:column;gap:10px}
.ow-hub-sec{border:1px solid rgba(231,178,75,.12);border-radius:8px;padding:8px;background:rgba(20,20,22,.55)}
.ow-hub-fold>summary{list-style:none;outline:none}
.ow-hub-fold>summary::-webkit-details-marker{display:none}
.ow-hub-fold>summary::before{content:'▸ ';color:#6B6B72;font-size:11px}
.ow-hub-fold[open]>summary::before{content:'▾ '}
.ow-hub-title{font-size:11px;color:#6B6B72;letter-spacing:.02em;margin-bottom:6px}
.ow-hub-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ow-hub-stat{font-size:11px;color:#F2F2F4}
.ow-hub-link{font-size:11px;color:#E7B24B;word-break:break-all;max-height:48px;overflow:auto}
.ow-hub-item{padding:6px 8px;border:1px solid rgba(231,178,75,.1);border-radius:8px;font-size:11px;cursor:pointer;margin-top:4px}
.ow-hub-item:hover{border-color:var(--ow-cyan)}
.ow-hub-mem{font-size:11px;color:#A3A3A8;line-height:1.4;max-height:64px;overflow:auto;margin-top:4px}
.ow-archify-embed{position:absolute;inset:12px 12px 80px;z-index:4;border:1px solid rgba(100,210,255,.35);border-radius:8px;background:rgba(5,7,13,.92);display:flex;flex-direction:column;overflow:hidden}
.ow-archify-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(231,178,75,.15);font-size:11px;color:#F2F2F4}
.ow-archify-frame{flex:1;border:none;width:100%;background:#0A0A0C}
.ow-rewind-tl{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto}
.ow-rewind-item{padding:8px 10px;border:1px solid rgba(231,178,75,.12);border-radius:8px;font-size:11px;cursor:pointer;background:rgba(20,20,22,.5)}
.ow-rewind-item:hover{border-color:var(--ow-cyan);background:rgba(231,178,75,.06)}
.ow-rewind-item.active{border-color:rgba(100,210,255,.5)}
.ow-rewind-meta{font-size:11px;color:#A3A3A8;margin-top:4px}
.ow-rewind-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.ow-idea-center{padding:20px 24px 32px;overflow:auto;height:100%;max-width:920px;margin:0 auto}
.ow-idea-hero{margin-bottom:20px}
.ow-idea-hero h2{margin:0;font-size:18px;letter-spacing:.02em;color:#F2F2F4}
.ow-idea-tag{font-size:11px;color:#E7B24B;margin:6px 0 10px}
.ow-idea-overview{font-size:12px;color:#A3A3A8;line-height:1.55;margin-bottom:8px}
.ow-idea-bullet{font-size:11px;color:#A3A3A8;line-height:1.5;margin-top:4px}
.ow-idea-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;margin-top:8px}
.ow-idea-card{padding:10px;border:1px solid rgba(231,178,75,.12);border-radius:8px;cursor:pointer;background:rgba(20,20,22,.45);transition:border-color .15s}
.ow-idea-card:hover{border-color:rgba(231,178,75,.35)}
.ow-idea-card.active{border-color:var(--ow-cyan);background:rgba(231,178,75,.08)}
.ow-idea-card.compare{box-shadow:inset 0 0 0 1px rgba(100,210,255,.45)}
.ow-idea-card strong{display:block;font-size:12px;color:#F2F2F4}
.ow-idea-sub{font-size:11px;color:#A3A3A8;margin-top:4px;letter-spacing:.5px}
.ow-idea-treat-row{display:flex;flex-wrap:wrap;gap:6px}
.ow-idea-chip{font-size:11px;padding:4px 8px;border:1px solid rgba(231,178,75,.15);border-radius:12px;background:transparent;color:#A3A3A8;cursor:pointer}
.ow-idea-chip.on{border-color:var(--ow-cyan);color:#E7B24B;background:rgba(231,178,75,.08)}
.ow-idea-instruction{font-size:11px;color:#A3A3A8;line-height:1.45;margin:12px 0;padding:10px;border:1px dashed rgba(231,178,75,.15);border-radius:8px}
.ow-idea-prompt{width:100%;margin-top:10px;padding:10px;border:1px solid rgba(231,178,75,.15);border-radius:8px;background:rgba(5,4,3,.7);color:#F2F2F4;font-size:12px;line-height:1.45;resize:vertical;min-height:72px;font-family:inherit}
.ow-unread-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#64D2FF;color:#0A0A0C;font-size:11px;font-weight:700;display:grid;place-items:center}
.ow-trigger-wrap{position:relative;display:inline-grid}

/* 550C scheme sync (data-ow-scheme from dsh-550c-boot:scheme) */
.ow-root[data-ow-scheme="green"]{
  --ow-cyan:#4ad46a;--ow-gold:#a6ffbb;--ow-border:rgba(74,212,106,.18);--ow-border-strong:rgba(74,212,106,.38);
  --ow-glow:0 0 12px rgba(74,212,106,.45);--ow-text:#c8e8d0;--ow-text-2:#5a8a64;--ow-text-muted:#2a4a32;
}
.ow-root[data-ow-scheme="cyan"]{
  --ow-cyan:#3fc8dc;--ow-gold:#a6f0ff;--ow-border:rgba(63,200,220,.18);--ow-border-strong:rgba(63,200,220,.38);
  --ow-glow:0 0 12px rgba(63,200,220,.45);--ow-text:#c8e4ea;--ow-text-2:#5a8890;--ow-text-muted:#2a4850;
}
.ow-root[data-ow-scheme="white"]{
  --ow-cyan:#c9c9c9;--ow-gold:#ffffff;--ow-border:rgba(255,255,255,.18);--ow-border-strong:rgba(255,255,255,.38);
  --ow-glow:0 0 12px rgba(255,255,255,.35);--ow-text:#e8e8e8;--ow-text-2:#9a9a9a;--ow-text-muted:#5a5a5a;
}

/* ────────────────────────────────────────────────────────────────
   设计系统 v2（Apple-like 精修层）：克制、留白、发丝线、无发光。
   放在最后——同名规则后写生效，类名与 DOM 结构均不变。
   ──────────────────────────────────────────────────────────────── */
.ow-root{background:var(--ow-bg-deep)}
.ow-overlay{background:var(--ow-bg-deep)}
.ow-panel{border-radius:14px;border:1px solid var(--ow-border);background:var(--ow-bg-panel);backdrop-filter:blur(24px) saturate(140%);box-shadow:0 1px 0 rgba(255,255,255,.04) inset;transition:border-color .2s ease,background .2s ease}
.ow-panel:hover{border-color:var(--ow-border-strong)}
.ow-panel-title{font-size:13px;font-weight:590;letter-spacing:-.01em;color:var(--ow-text)}
.ow-panel-title-en{font-size:10px;letter-spacing:.14em;color:var(--ow-text-muted);font-weight:500;text-transform:uppercase;margin-top:2px}
.ow-panel-sub,.ow-detail-sub,.ow-side-hint{font-size:12px;line-height:1.6;color:var(--ow-text-2)}
.ow-event-item,.ow-cmd-item span:last-child{font-size:12.5px}
.ow-event-time{font-variant-numeric:tabular-nums;color:var(--ow-text-muted);font-size:11.5px}
.ow-neural-btn,.ow-msg-btn,.ow-bridge-refresh,.ow-detail-actions button{
  font-family:inherit;font-size:12px;font-weight:500;letter-spacing:0;text-transform:none;
  padding:6px 12px;border-radius:9px;border:1px solid var(--ow-border);
  background:var(--ow-bg-elev);color:var(--ow-text);cursor:pointer;
  transition:background .18s ease,border-color .18s ease,transform .18s ease}
.ow-neural-btn:hover,.ow-msg-btn:hover,.ow-bridge-refresh:hover,.ow-detail-actions button:hover{
  background:rgba(255,255,255,.1);border-color:var(--ow-border-strong)}
.ow-neural-btn:active,.ow-msg-btn:active{transform:scale(.98)}
.ow-msg-btn.primary{border-color:transparent;background:var(--ow-accent);color:#161006;font-weight:600}
.ow-msg-btn.primary:hover{background:#F0C674}
.ow-msg-select,.ow-cmd-input,.ow-msg-hub textarea{
  font-family:inherit;font-size:12.5px;padding:8px 11px;border-radius:10px;
  border:1px solid var(--ow-border);background:rgba(0,0,0,.35);color:var(--ow-text)}
.ow-msg-select:focus,.ow-cmd-input:focus,.ow-msg-hub textarea:focus{outline:none;border-color:var(--ow-border-strong);box-shadow:0 0 0 3px rgba(231,178,75,.14)}
.ow-dock{border-radius:999px;background:rgba(20,20,22,.82);border:1px solid var(--ow-border);box-shadow:0 12px 32px rgba(0,0,0,.55);backdrop-filter:blur(24px) saturate(150%)}
.ow-dock-chip{font-size:12px;padding:5px 11px;border-radius:999px;color:var(--ow-text-2)}
.ow-dock-unread{background:var(--ow-red);color:#fff;font-size:10.5px;min-width:18px;height:18px}
.ow-action-btn{border-radius:10px;border:1px solid var(--ow-border);background:var(--ow-bg-elev);font-size:12px;color:var(--ow-text);transition:background .18s ease}
.ow-action-btn:hover{background:rgba(255,255,255,.1)}
.ow-detail-card,.ow-detail-row{border-radius:12px;border-color:var(--ow-border)}
.ow-detail-row{font-size:12.5px;padding:7px 0}
.ow-embed-head{font-size:12.5px;border-bottom:1px solid var(--ow-border)}
.ow-embed{border-radius:14px;border:1px solid var(--ow-border);overflow:hidden}
.ow-ati-title,.ow-ati-hud,.ow-lab-title{font-family:var(--ow-display);letter-spacing:-.01em;text-transform:none}
.ow-ati-title{font-size:15px;font-weight:590;color:var(--ow-text)}
.ow-ati-hud{font-family:var(--ow-mono);font-size:11.5px;color:var(--ow-text-2);letter-spacing:.02em}
.ow-ati-sub,.ow-lab-tick{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:.01em}
.ow-lab-title{font-family:var(--ow-display);font-size:12.5px;font-weight:560;color:var(--ow-text);letter-spacing:0}
.ow-lab-sub{font-family:var(--ow-display);font-size:11.5px;color:var(--ow-text-2);letter-spacing:0}
.ow-lab-att-token{font-family:var(--ow-mono);font-size:11px;fill:var(--ow-text-2)}
.ow-lab-att-value{font-family:var(--ow-mono);font-size:10.5px;font-weight:500}
.ow-lab-att-cell{stroke:transparent}
.ow-ati-dl-box{fill:rgba(255,255,255,.045);stroke:var(--ow-border);stroke-width:1}
.ow-ati-dl-box.hl{stroke:var(--ow-accent);stroke-width:1.2}
.ow-ati-dl-label{font-family:var(--ow-display);font-size:12px;font-weight:560;fill:var(--ow-text);letter-spacing:0}
.ow-ati-dl-zh{font-family:var(--ow-display);font-size:11.5px;fill:var(--ow-text-2)}
.ow-ati-metric{font-family:var(--ow-mono);font-size:11.5px;fill:var(--ow-accent)}
.ow-ati-stage-tag{font-family:var(--ow-mono);font-size:11.5px;color:var(--ow-text-2);line-height:1.9}
.ow-ati-stage-tag b{color:var(--ow-accent);font-weight:600}
.ow-metric-en,.ow-view-sub,.ow-deep-en,.ow-integ-en,.ow-health-label-sub{font-family:var(--ow-mono);font-size:10.5px;letter-spacing:.1em;color:var(--ow-text-muted)}
.ow-status-chip{font-size:11.5px;padding:4px 10px;border-radius:999px;border:1px solid var(--ow-border);color:var(--ow-text-2);background:var(--ow-bg-elev)}
.ow-task-status{font-size:11px;border-radius:999px;padding:2px 8px}
.ow-fleet-hint{font-size:11.5px;color:var(--ow-text-2);line-height:1.6}
.ow-fleet-kind,.ow-fleet-pct,.ow-fleet-status,.ow-fleet-stage{font-size:11.5px}
.ow-fleet-stage{border-radius:999px;border-color:var(--ow-border);color:var(--ow-text-2)}
.ow-bridge-health{font-size:11.5px;border-radius:10px;border-color:var(--ow-border)}
.ow-metaphor-tag,.ow-derived-tag{font-size:10px;border-radius:999px;padding:2px 8px;letter-spacing:.04em}
.ow-metaphor-tag{border-color:rgba(100,210,255,.35);color:var(--ow-blue)}
.ow-derived-tag{border-color:var(--ow-border);color:var(--ow-text-muted)}
.ow-nn-label{font-size:12px;fill:var(--ow-text)}
.ow-nn-metric{font-size:11.5px;fill:var(--ow-accent);font-family:var(--ow-mono)}
.ow-nn-layer-label{font-size:11px;fill:var(--ow-text-muted);letter-spacing:.02em}
.ow-nn-layer-label-zh{font-size:11.5px;fill:var(--ow-text-2)}
.ow-nn-tooltip{border-radius:10px;background:rgba(20,20,22,.94);border:1px solid var(--ow-border);font-size:12px;box-shadow:0 12px 32px rgba(0,0,0,.6)}
.ow-empty-cue{color:var(--ow-text-2)}
.ow-empty-cue-dot{background:var(--ow-accent)}
.ow-ver{font-size:10.5px;color:var(--ow-text-muted);letter-spacing:.1em}
.ow-cmd-item{border-radius:10px}
.ow-cmd-item:hover{background:var(--ow-bg-elev)}
.ow-cmd-overlay{background:rgba(0,0,0,.55);backdrop-filter:blur(10px)}
/* Garden · 园（第四视图） */
.ow-garden{position:relative;width:100%;height:100%;min-height:420px;overflow:hidden;border-radius:12px;background:#0D1013}
.ow-garden-cvs{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:pointer}
.ow-garden-vtitle{position:absolute;left:18px;top:14px;pointer-events:none;writing-mode:vertical-rl;letter-spacing:.4em;font-size:13px;color:rgba(233,228,216,.45);font-family:'Kaiti SC','STKaiti','KaiTi',serif}
.ow-garden-corner{position:absolute;right:14px;bottom:66px;display:flex;align-items:center;gap:6px;pointer-events:none}
.ow-garden-yu{font-size:10px;color:var(--ow-accent);border:1px solid var(--ow-border);border-radius:2px;padding:1px 5px}
.ow-garden-note{font-size:10.5px;color:var(--ow-text-muted)}
.ow-garden-card{position:absolute;width:240px;z-index:6;background:rgba(16,20,24,.96);border:1px solid var(--ow-border);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.5);padding:12px 14px}
.ow-gc-head{display:flex;align-items:baseline;gap:8px}
.ow-gc-zi{font-size:22px;font-family:'Kaiti SC','STKaiti','KaiTi',serif;color:var(--ow-text)}
.ow-gc-en{font-size:10.5px;color:var(--ow-text-muted);font-family:var(--ow-mono)}
.ow-gc-seal{margin-left:auto;width:16px;height:16px;background:#C8402F;border-radius:2px;color:#F6EFE2;font-size:10px;display:flex;align-items:center;justify-content:center}
.ow-gc-who{margin-top:6px;font-size:12px;line-height:1.65;color:var(--ow-text-2)}
.ow-gc-now{margin-top:5px;font-size:12px;color:var(--ow-text-muted)}
.ow-gc-rel{margin-top:6px;font-size:11px;line-height:1.6;color:var(--ow-text-muted);border-left:2px solid var(--ow-border);padding-left:8px}
.ow-gc-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.ow-gc-acts button{background:rgba(255,255,255,.04);border:1px solid var(--ow-border);border-radius:999px;color:var(--ow-text);font-size:12px;padding:4px 12px;cursor:pointer;transition:background .18s ease,border-color .18s ease}
.ow-gc-acts button:hover{background:rgba(255,255,255,.08);border-color:var(--ow-border-strong)}
.ow-gc-x{margin-left:auto}
.ow-garden-path{position:absolute;right:12px;top:12px;bottom:110px;width:240px;z-index:6;display:flex;flex-direction:column;background:rgba(14,18,22,.96);border:1px solid var(--ow-border);border-radius:10px;padding:10px 0 6px}
.ow-gp-head{display:flex;align-items:baseline;gap:8px;padding:0 12px 8px;border-bottom:1px solid var(--ow-border)}
.ow-gp-head b{font-weight:590;font-size:13px}
.ow-gp-head span{font-size:10.5px;color:var(--ow-text-muted)}
.ow-gp-head button{margin-left:auto;background:none;border:none;color:var(--ow-text-muted);cursor:pointer}
.ow-gp-list{overflow-y:auto;padding:6px 12px}
.ow-gp-ev{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--ow-border);font-size:12px;color:var(--ow-text-2);line-height:1.5}
.ow-gp-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--ow-accent);margin-top:6px}
.ow-garden-letter{position:absolute;left:50%;transform:translateX(-50%);bottom:14px;z-index:6;width:min(420px,70%)}
.ow-garden-personas{display:flex;gap:6px;justify-content:center;margin-bottom:6px;flex-wrap:wrap}
/* v5/v6 · 无障碍与降级（优化版次 2026-10-01） */
@media (prefers-reduced-motion: reduce){.ow-overlay.is-arriving::after{animation:none;transition:none}.ow-garden-pn,.ow-garden-paper input,.ow-garden-paper button,.ow-gc-zi{animation:none!important;transition:none!important}}
.ow-garden-pn:focus-visible,.ow-garden-paper input:focus-visible,.ow-garden-paper button:focus-visible{outline:2px solid var(--ow-accent);outline-offset:2px}
/* v63 · 信纸字数余量 */
.ow-garden-count{font-size:10px;color:var(--ow-text-muted);font-family:var(--ow-mono);min-width:24px;text-align:right}
.ow-garden-pn{background:rgba(13,16,19,.72);border:1px dashed var(--ow-border-strong);border-radius:999px;color:var(--ow-text-muted);font-size:11px;padding:3px 11px;cursor:pointer;transition:all .18s ease}
.ow-garden-pn:hover{color:var(--ow-text)}
.ow-garden-pn.on{color:#F6EFE2;border-style:solid;background:#C8402F;border-color:#C8402F}
.ow-garden-paper{display:flex;gap:8px;align-items:center;background:#F4EFE6;border-radius:10px;padding:8px 10px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.ow-garden-paper input{flex:1;background:transparent;border:none;outline:none;font-size:13px;color:#2A2620;font-family:inherit}
.ow-garden-paper input::placeholder{color:#A89F8D}
.ow-garden-paper button{flex:none;width:30px;height:30px;border-radius:50%;border:none;background:#C8402F;color:#F6EFE2;font-size:13px;cursor:pointer;font-family:'Kaiti SC','STKaiti','KaiTi',serif;transition:transform .18s ease}
.ow-garden-paper button:hover{transform:scale(1.06)}
.ow-garden-ask{position:absolute;left:50%;transform:translateX(-50%);top:14px;z-index:7;width:min(360px,80%)}
.ow-garden-ask input{width:100%;background:rgba(16,20,24,.96);border:1px solid var(--ow-border-strong);border-radius:999px;padding:8px 16px;font-size:12.5px;color:var(--ow-text);outline:none;font-family:inherit}
/* Narrow screens: preserve navigation, give the opened app the full content area. */
@media (max-width:1100px){
 .ow-overlay .ow-bottom{display:flex;height:76px;flex-shrink:0;padding:8px}
 .ow-overlay .ow-bottom .ow-log-wrap,.ow-overlay .ow-bottom-right{display:none}
 .ow-overlay .ow-view-switch{width:100%;justify-content:center}
 .ow-overlay .ow-view-btn{flex:1;min-width:0;width:auto;max-width:140px;height:52px}
 .ow-overlay .ow-body{grid-template-columns:220px minmax(0,1fr)}
 .ow-overlay .ow-side-right{display:none}
 .ow-overlay .ow-body:has(.ow-embed){grid-template-columns:minmax(0,1fr)}
 .ow-overlay .ow-body:has(.ow-embed)>.ow-side{display:none}
}
@media (max-width:700px){
 .ow-overlay .ow-view-sub{display:none}
 .ow-overlay:not(.is-minimized){inset:0!important;left:0!important;top:0!important;width:100%!important;height:100%!important;border-radius:0}
 .ow-overlay .ow-topbar{height:auto;min-height:48px;flex-shrink:0;padding:8px;gap:8px;flex-wrap:wrap}
 .ow-overlay .ow-topbar-left,.ow-overlay .ow-topbar-right{gap:8px;flex-wrap:wrap;min-width:0}
 .ow-overlay .ow-topbar-clock,.ow-overlay .ow-ver{display:none}
 .ow-overlay .ow-body{display:flex;flex-direction:column;min-width:0;padding:8px;gap:8px;overflow:auto}
 .ow-overlay .ow-side-left{max-height:160px;flex-shrink:0;padding:0}
 .ow-overlay .ow-center{flex:1 0 380px;min-width:0;min-height:380px}
 .ow-overlay .ow-body:has(.ow-embed){overflow:hidden}
 .ow-overlay .ow-body:has(.ow-embed)>.ow-side{display:none}
 .ow-overlay .ow-body:has(.ow-embed)>.ow-center{flex:1;min-height:0}
 .ow-overlay .ow-embed{inset:0}
 .ow-overlay .ow-embed-head{padding:8px;gap:8px;flex-shrink:0}
 .ow-overlay .ow-embed-head>div{min-width:0;overflow-wrap:anywhere}
 .ow-overlay .ow-embed-head>div>span{display:none}
 .ow-overlay .ow-embed-head>button{flex-shrink:0}
 .ow-overlay .ow-embed-body{padding:8px;min-width:0;min-height:0}
 .ow-overlay .ow-history:has(.ow-native-conversation) .ow-history-nav{display:none}
 .ow-overlay .ow-native-conversation{overflow:auto}
 .ow-overlay .ow-native-conversation header strong{min-width:0;overflow-wrap:anywhere}
 .ow-overlay .ow-native-messages{min-height:120px}
}
`
    module.exports = { CSS }
    return module.exports
  },
})
