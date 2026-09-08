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
  --ow-bg-deep:#05070d;--ow-bg-panel:rgba(18,26,38,.55);--ow-border:rgba(94,234,212,.18);
  --ow-border-strong:rgba(94,234,212,.35);--ow-text:#e6f1ff;--ow-text-2:#7c8ea6;
  --ow-text-muted:#4a5a70;--ow-cyan:#5eead4;--ow-gold:#f5d67a;--ow-green:#bfe38e;
  --ow-orange:#f4a261;--ow-blue:#7ab8f5;--ow-glow:0 0 12px rgba(94,234,212,.45);
  --ow-mono:Consolas,'Courier New',ui-monospace,monospace;
  --ow-display:Consolas,'Segoe UI','Microsoft YaHei UI',sans-serif;
  font-family:'Segoe UI','Microsoft YaHei UI',system-ui,sans-serif;color:var(--ow-text);
}
.ow-trigger{display:grid;place-items:center;width:28px;height:28px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,#aab);cursor:pointer;font-size:15px;transition:all .2s}
.ow-trigger:hover{background:rgba(94,234,212,.12);color:var(--ow-cyan);box-shadow:var(--ow-glow)}
.ow-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;overflow:hidden;background:var(--ow-bg-deep);color:var(--ow-text);isolation:isolate;transition:width .2s ease,height .2s ease,inset .2s ease,border-radius .2s ease,box-shadow .2s ease}
.ow-overlay.is-split{inset:0 0 0 auto;width:min(56vw,960px);border-left:1px solid var(--ow-border-strong);box-shadow:-16px 0 48px rgba(0,0,0,.5)}
.ow-overlay.is-float{inset:auto;top:7vh;left:10vw;width:min(80vw,1180px);height:86vh;border-radius:8px;border:1px solid var(--ow-border-strong);box-shadow:0 24px 64px rgba(0,0,0,.55)}
.ow-overlay.is-float.is-dragging{transition:none;user-select:none}
.ow-overlay.is-minimized{inset:auto;left:14px;bottom:14px;width:auto;height:auto;background:transparent;border:none;box-shadow:none;overflow:visible;isolation:auto}
.ow-overlay.is-split .ow-body,.ow-overlay.is-float .ow-body{grid-template-columns:240px 1fr;padding:12px 14px}
.ow-overlay.is-split .ow-side-right,.ow-overlay.is-float .ow-side-right{display:none}
.ow-wm-bar{display:flex;align-items:center;gap:6px}
.ow-wm-btn{border:1px solid var(--ow-border);background:rgba(8,14,24,.65);color:var(--ow-text-2);border-radius:4px;padding:6px 10px;cursor:pointer;font-size:11px;letter-spacing:.04em;transition:all .15s}
.ow-wm-btn:hover{color:var(--ow-cyan);border-color:var(--ow-cyan)}
.ow-wm-btn.on{color:var(--ow-cyan);border-color:var(--ow-cyan);background:rgba(94,234,212,.1);box-shadow:var(--ow-glow)}
.ow-dock{display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;background:rgba(8,14,24,.92);border:1px solid var(--ow-border-strong);box-shadow:var(--ow-glow);backdrop-filter:blur(8px)}
.ow-dock-chip{display:inline-flex;align-items:center;gap:8px;border:none;background:transparent;color:var(--ow-cyan);cursor:pointer;font-size:12px;font-family:var(--ow-mono);padding:4px 10px;letter-spacing:.08em}
.ow-dock-chip:hover{color:#fff}
.ow-dock-mark{font-size:14px}
.ow-dock-unread{min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#f472b6;color:#fff;font-size:10px;display:grid;place-items:center}
.ow-dock-close{width:24px;height:24px;border:none;border-radius:999px;background:transparent;color:#7c8ea6;cursor:pointer;font-size:14px}
.ow-dock-close:hover{color:#ffb8b8;background:rgba(80,20,20,.35)}
.ow-fleet{display:flex;flex-direction:column;gap:4px}
.ow-fleet-summary{font-size:11px;color:#5eead4;margin-bottom:6px;font-family:var(--ow-mono)}
.ow-fleet-hint{font-size:10px;color:#64748b;margin-bottom:6px;line-height:1.4}
.ow-fleet-row{display:grid;grid-template-columns:52px 1fr auto auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid rgba(94,234,212,.12);border-radius:4px;font-size:11px}
.ow-fleet-row.ow-clickable:hover{background:rgba(94,234,212,.06)}
.ow-fleet-row-static{cursor:default;opacity:.92}
.ow-fleet-row.status-running,.ow-fleet-row.status-active,.ow-fleet-row.status-busy{border-color:rgba(94,234,212,.35)}
.ow-fleet-kind{color:#7c8ea6;font-size:10px;letter-spacing:.04em}
.ow-fleet-main{min-width:0;display:flex;flex-direction:column;gap:3px}
.ow-fleet-title{color:#e6f1ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-fleet-stages{display:flex;flex-wrap:wrap;gap:3px}
.ow-fleet-stage{font-size:9px;color:#94a3b8;padding:1px 5px;border:1px solid rgba(148,163,184,.25);border-radius:3px;max-width:9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-fleet-pct{color:#f5d67a;font-family:var(--ow-mono);font-size:10px}
.ow-fleet-status{color:#5eead4;font-size:10px}
.ow-topbar.is-float-drag{cursor:grab}
.ow-topbar.is-float-drag:active{cursor:grabbing}
.ow-bg-canvas{position:absolute;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;display:block}
.ow-fx-vig{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse 84% 78% at 50% 50%,rgba(0,0,0,0) 46%,rgba(0,0,0,.34) 76%,rgba(0,0,0,.80) 100%)}
.ow-fx-scan{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.22;background:repeating-linear-gradient(180deg,rgba(255,255,255,.03) 0 1px,rgba(0,0,0,0) 1px 3px)}
.ow-fx-sweep{position:absolute;left:0;right:0;height:44vh;z-index:1;pointer-events:none;opacity:.09;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(159,228,255,.10),rgba(0,0,0,0));animation:owSweep 14s linear infinite}
@keyframes owSweep{0%{transform:translateY(-50vh)}100%{transform:translateY(120vh)}}
.ow-starfield{position:absolute;inset:0;z-index:0;pointer-events:none;background:
  radial-gradient(ellipse at 50% 50%,rgba(30,58,70,.25) 0%,transparent 55%),
  radial-gradient(ellipse at 20% 80%,rgba(15,40,60,.3) 0%,transparent 45%),
  var(--ow-bg-deep)}
.ow-starfield::before,.ow-starfield::after{content:'';position:absolute;inset:0;animation:owTwinkle 6s ease-in-out infinite alternate}
.ow-starfield::before{background-image:
  radial-gradient(1px 1px at 10% 20%,rgba(255,255,255,.6),transparent),
  radial-gradient(1.5px 1.5px at 45% 35%,rgba(255,255,255,.7),transparent),
  radial-gradient(1px 1px at 80% 15%,rgba(255,255,255,.5),transparent),
  radial-gradient(1px 1px at 65% 60%,rgba(200,230,255,.4),transparent)}
.ow-starfield::after{animation-delay:-3s;animation-duration:8s;background-image:
  radial-gradient(1px 1px at 30% 25%,rgba(200,230,255,.45),transparent),
  radial-gradient(1px 1px at 70% 25%,rgba(180,210,240,.5),transparent),
  radial-gradient(1px 1px at 50% 70%,rgba(255,255,255,.4),transparent)}
@keyframes owTwinkle{0%{opacity:.4}100%{opacity:1}}
.ow-shell{position:relative;z-index:2;display:flex;flex-direction:column;height:100%}
.ow-ver{position:absolute;top:8px;right:140px;font-size:9px;color:rgba(94,234,212,.35);letter-spacing:.15em;z-index:3;pointer-events:none;font-family:var(--ow-mono)}
.ow-stale{position:absolute;top:28px;left:50%;transform:translateX(-50%);z-index:6;max-width:min(92vw,640px);padding:8px 14px;border:1px solid rgba(245,214,122,.45);border-radius:2px;background:rgba(40,28,8,.92);color:#f5d67a;font-size:11px;font-family:var(--ow-mono);text-align:center;pointer-events:none;letter-spacing:.02em}
.ow-bridge-health{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;padding:6px 8px;border:1px solid rgba(94,234,212,.1);border-radius:4px;background:rgba(4,8,16,.45);font-size:9px}
.ow-bridge-label{color:#7c8ea6;letter-spacing:1px;margin-right:4px}
.ow-bridge-chip{padding:2px 6px;border-radius:3px;border:1px solid rgba(94,234,212,.15);color:#7c8ea6}
.ow-bridge-chip.ok{border-color:rgba(94,234,212,.35);color:#5eead4}
.ow-bridge-chip.warn{border-color:rgba(251,191,36,.4);color:#fbbf24}
.ow-bridge-chip.bad{border-color:rgba(255,120,120,.35);color:#ff9090}
.ow-bridge-refresh{margin-left:auto;padding:2px 6px;border:1px solid rgba(94,234,212,.2);background:transparent;color:#5eead4;border-radius:3px;cursor:pointer;font-size:10px}
.ow-metaphor-tag{display:inline-block;margin-left:8px;padding:1px 6px;font-size:8px;letter-spacing:.5px;border:1px solid rgba(167,139,250,.35);color:#a78bfa;border-radius:3px;vertical-align:middle}
.ow-derived-tag{display:inline-block;margin-left:6px;padding:1px 5px;font-size:8px;border:1px solid rgba(94,234,212,.2);color:#7c8ea6;border-radius:3px}
.ow-topbar{height:60px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ow-border);background:linear-gradient(to bottom,rgba(10,18,28,.8),rgba(10,18,28,.3));position:relative}
.ow-topbar::before{content:'';position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:40%;height:1px;background:linear-gradient(to right,transparent,var(--ow-cyan),transparent);box-shadow:var(--ow-glow)}
.ow-topbar-left,.ow-topbar-right{display:flex;align-items:center;gap:22px}
.ow-brand{display:flex;align-items:center;gap:10px}
.ow-brand-logo{width:28px;height:28px;border:1.5px solid var(--ow-cyan);border-radius:50%;position:relative;display:flex;align-items:center;justify-content:center}
.ow-brand-logo::before{content:'';width:14px;height:14px;border:1px solid var(--ow-cyan);border-radius:50%}
.ow-brand-name{font-family:var(--ow-display);font-size:18px;font-weight:700;letter-spacing:3px;color:var(--ow-text)}
.ow-icon-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--ow-border);border-radius:4px;color:var(--ow-text-2);cursor:default;background:transparent;transition:all .2s}
.ow-icon-btn:hover{color:var(--ow-cyan);border-color:var(--ow-cyan);box-shadow:var(--ow-glow)}
.ow-topbar-center{display:flex;flex-direction:column;align-items:center;position:absolute;left:50%;transform:translateX(-50%);top:8px}
.ow-topbar-time{font-family:var(--ow-mono);font-size:18px;font-weight:500;letter-spacing:2px;color:var(--ow-text)}
.ow-topbar-date{font-size:11px;color:var(--ow-text-2);letter-spacing:1px;font-family:var(--ow-mono)}
.ow-close{border:1px solid rgba(255,100,100,.3);background:rgba(80,20,20,.35);color:#ffb8b8;border-radius:4px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:.06em;transition:all .2s}
.ow-close:hover{background:rgba(120,30,30,.5);box-shadow:0 0 16px rgba(255,80,80,.2)}
.ow-body{flex:1;display:grid;grid-template-columns:300px 1fr 300px;gap:0;padding:16px 20px;min-height:0}
.ow-side{display:flex;flex-direction:column;overflow-y:auto;min-height:0}
.ow-side-left{padding-right:4px}
.ow-side-tabs{display:flex;gap:4px;margin-bottom:10px;padding:0 2px;position:sticky;top:0;z-index:3;background:linear-gradient(180deg,rgba(6,10,18,.98) 70%,transparent)}
.ow-side-tab{flex:1;border:1px solid var(--ow-border);background:rgba(8,14,24,.65);color:var(--ow-text-muted);font-size:11px;padding:7px 4px;cursor:pointer;border-radius:2px;letter-spacing:.4px;transition:border-color .15s,color .15s}
.ow-side-tab:hover{color:var(--ow-text-2)}
.ow-side-tab.on{border-color:var(--ow-cyan);color:var(--ow-cyan);background:rgba(94,234,212,.08)}
.ow-side-hint{font-size:10px;color:#5a6a80;line-height:1.55;margin-bottom:8px;padding:0 4px}
.ow-status-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ow-status-chip{font-size:10px;padding:3px 8px;border:1px solid rgba(94,234,212,.15);border-radius:3px;color:#9fb4cc}
.ow-status-chip.ok{border-color:rgba(94,234,212,.35);color:#5eead4}
.ow-status-chip.off{opacity:.55}
.ow-side-right{padding-left:4px}
.ow-side::-webkit-scrollbar{width:3px}
.ow-side::-webkit-scrollbar-thumb{background:var(--ow-border-strong);border-radius:2px}
.ow-panel{background:var(--ow-bg-panel);border:1px solid var(--ow-border);border-radius:2px;position:relative;backdrop-filter:blur(4px);margin-bottom:14px}
.ow-panel::before,.ow-panel::after{content:'';position:absolute;width:10px;height:10px;border-color:var(--ow-cyan);border-style:solid;border-width:0;pointer-events:none}
.ow-panel::before{top:-1px;left:-1px;border-top-width:1.5px;border-left-width:1.5px}
.ow-panel::after{bottom:-1px;right:-1px;border-bottom-width:1.5px;border-right-width:1.5px}
.ow-panel-head{padding:12px 16px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--ow-border)}
.ow-panel-title{display:flex;flex-direction:column;gap:2px}
.ow-panel-title-zh{font-size:13px;font-weight:500;color:var(--ow-text);letter-spacing:1px}
.ow-panel-title-en{font-size:10px;color:var(--ow-text-muted);letter-spacing:1.5px;font-family:var(--ow-mono);text-transform:uppercase}
.ow-panel-more{font-size:11px;color:var(--ow-text-muted);cursor:pointer}
.ow-panel-body{padding:14px 16px}
.ow-center{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0}
.ow-galaxy-wrap{position:relative;width:100%;height:100%;max-width:720px;max-height:720px;aspect-ratio:1/1}
.ow-galaxy-title{position:absolute;top:8%;left:50%;transform:translateX(-50%);font-family:var(--ow-display);font-size:13px;color:var(--ow-text-muted);letter-spacing:8px;text-transform:uppercase;opacity:.6;z-index:1}
.ow-galaxy-svg{width:100%;height:100%}
.ow-orbit-ring{fill:none;stroke:rgba(94,234,212,.08);stroke-width:1;stroke-dasharray:4 6}
.ow-orbit-ring.hl{stroke:rgba(94,234,212,.18);stroke-dasharray:none}
.ow-rotate-slow{animation:owSpin 120s linear infinite;transform-origin:350px 350px}
.ow-rotate-slow2{animation:owSpin 180s linear infinite reverse;transform-origin:350px 350px}
.ow-rotate-rev{animation:owSpin 90s linear infinite reverse;transform-origin:350px 350px}
@keyframes owSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ow-core-pulse{animation:owPulse 3s ease-in-out infinite}
@keyframes owPulse{0%,100%{opacity:.85}50%{opacity:1}}
.ow-node{cursor:pointer}
.ow-node:hover{filter:brightness(1.15)}
.ow-orbit-hint{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:2px;background:rgba(8,16,28,.85);border:1px solid var(--ow-border);font-size:12px;color:var(--ow-cyan);white-space:nowrap;backdrop-filter:blur(8px);z-index:2;font-family:var(--ow-mono)}
.ow-health-wrap{display:flex;align-items:center;justify-content:center;padding:4px 0 10px;position:relative}
.ow-health-ring{position:relative;width:110px;height:110px}
.ow-health-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.ow-health-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ow-health-val{font-family:var(--ow-display);font-size:32px;font-weight:600;color:var(--ow-cyan);line-height:1;text-shadow:var(--ow-glow)}
.ow-health-unit{font-size:11px;color:var(--ow-text-muted);font-family:var(--ow-mono);margin-top:2px}
.ow-health-label{text-align:center;margin-top:2px}
.ow-health-label-main{font-size:12px;color:var(--ow-text-2);letter-spacing:1px}
.ow-health-label-sub{font-size:10px;color:var(--ow-text-muted);letter-spacing:1.5px;font-family:var(--ow-mono);margin-top:2px}
.ow-spark{width:100%;height:36px;display:block;margin-top:8px}
.ow-load-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(94,234,212,.07)}
.ow-load-item:last-child{border-bottom:none}
.ow-load-label{font-family:var(--ow-mono);font-size:12px;color:var(--ow-text-2);letter-spacing:1px;width:44px}
.ow-load-wave{flex:1;height:24px;margin:0 8px}
.ow-load-val{font-family:var(--ow-mono);font-size:13px;color:var(--ow-text);font-weight:500;width:60px;text-align:right}
.ow-event-list{display:flex;flex-direction:column;gap:10px}
.ow-event-item{display:flex;align-items:center;gap:10px;font-size:12px}
.ow-event-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;box-shadow:0 0 6px currentColor}
.ow-event-dot.green{background:var(--ow-green);color:var(--ow-green)}
.ow-event-dot.gold{background:var(--ow-gold);color:var(--ow-gold)}
.ow-event-dot.cyan{background:var(--ow-cyan);color:var(--ow-cyan)}
.ow-event-dot.orange{background:var(--ow-orange);color:var(--ow-orange)}
.ow-event-dot.purple{background:#a78bfa;color:#a78bfa}
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
.ow-donut-label{font-size:11px;color:var(--ow-text-muted);margin-top:4px;letter-spacing:1px}
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
.ow-task-status{font-family:var(--ow-mono);font-size:10px;padding:1px 6px;border-radius:2px;margin-left:8px;letter-spacing:.5px}
.ow-task-status.running{color:var(--ow-cyan);background:rgba(94,234,212,.1);border:1px solid rgba(94,234,212,.25)}
.ow-task-status.pending{color:var(--ow-text-muted);background:rgba(74,90,112,.15);border:1px solid rgba(74,90,112,.3)}
.ow-task-pct{font-family:var(--ow-mono);font-size:11px;color:var(--ow-gold);margin-left:6px;width:32px;text-align:right}
.ow-task-bar{height:3px;background:rgba(94,234,212,.1);border-radius:2px;overflow:hidden}
.ow-task-fill{height:100%;border-radius:2px;transition:width 1s ease}
.ow-task-fill.cyan{background:linear-gradient(to right,#2dd4bf,var(--ow-cyan));box-shadow:0 0 6px rgba(94,234,212,.5)}
.ow-task-fill.gold{background:linear-gradient(to right,#d4a74b,var(--ow-gold));box-shadow:0 0 6px rgba(245,214,122,.5)}
.ow-task-fill.dim{background:var(--ow-text-muted);opacity:.4}
.ow-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ow-action-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 4px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(94,234,212,.03);cursor:pointer;transition:all .2s;color:var(--ow-text-2)}
.ow-action-btn:hover{border-color:var(--ow-cyan);color:var(--ow-cyan);background:rgba(94,234,212,.08);box-shadow:var(--ow-glow)}
.ow-action-label{font-size:11px;letter-spacing:.5px}
.ow-bottom{height:110px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding:0 28px;border-top:1px solid var(--ow-border);background:linear-gradient(to top,rgba(10,18,28,.8),rgba(10,18,28,.3));position:relative}
.ow-bottom::before{content:'';position:absolute;left:50%;top:-1px;transform:translateX(-50%);width:40%;height:1px;background:linear-gradient(to right,transparent,var(--ow-cyan),transparent);box-shadow:var(--ow-glow)}
.ow-log-wrap{display:flex;flex-direction:column;gap:6px;max-height:80px;overflow:hidden}
.ow-log-head{display:flex;align-items:center;justify-content:space-between}
.ow-log-title{font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:1.5px}
.ow-log-line{display:flex;gap:10px;align-items:center;font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-2)}
.ow-log-time{color:var(--ow-cyan);font-size:11px}
.ow-log-dot{width:5px;height:5px;border-radius:50%;background:var(--ow-green);box-shadow:0 0 4px var(--ow-green)}
.ow-view-switch{display:flex;gap:0;align-items:center;position:relative}
.ow-deep-toggle{position:absolute;top:-46px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:8px 22px;background:linear-gradient(to bottom,rgba(18,26,38,.95),rgba(10,18,28,.95));border:1px solid var(--ow-border);border-bottom:none;border-radius:2px 2px 0 0;white-space:nowrap}
.ow-deep-icon{color:var(--ow-gold)}
.ow-deep-label{display:flex;flex-direction:column;gap:2px}
.ow-deep-zh{font-size:12px;color:var(--ow-text);letter-spacing:2px}
.ow-deep-en{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:1.5px}
.ow-deep-switch{position:relative;width:36px;height:20px;background:rgba(74,90,112,.3);border:1px solid var(--ow-border);border-radius:10px;cursor:pointer;transition:all .3s}
.ow-deep-switch.on{background:rgba(191,227,142,.25);border-color:var(--ow-green);box-shadow:0 0 8px rgba(191,227,142,.3)}
.ow-deep-switch::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--ow-text-muted);transition:all .3s}
.ow-deep-switch.on::after{left:18px;background:var(--ow-green);box-shadow:0 0 6px var(--ow-green)}
.ow-view-btn{position:relative;width:140px;height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:var(--ow-text-2);transition:all .25s;background:transparent;border:none;padding:0}
.ow-view-hex{position:absolute;inset:0}
.ow-view-hex polygon{fill:rgba(12,20,32,.6);stroke:var(--ow-border);stroke-width:1;transition:all .25s}
.ow-view-btn:hover .ow-view-hex polygon{stroke:var(--ow-cyan);fill:rgba(94,234,212,.06)}
.ow-view-btn.on{color:var(--ow-cyan)}
.ow-view-btn.on .ow-view-hex polygon{fill:rgba(94,234,212,.1);stroke:var(--ow-cyan);stroke-width:1.5;filter:drop-shadow(0 0 4px rgba(94,234,212,.4))}
.ow-view-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px}
.ow-view-label{font-size:12px;letter-spacing:1px}
.ow-view-sub{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:1px}
.ow-bottom-right{display:flex;align-items:center;justify-content:flex-end;gap:30px}
.ow-metric{display:flex;flex-direction:column;gap:4px}
.ow-metric-label{display:flex;flex-direction:column;gap:2px}
.ow-metric-zh{font-size:11px;color:var(--ow-text-2);letter-spacing:1px}
.ow-metric-en{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:1px}
.ow-metric-val{font-family:var(--ow-mono);font-size:22px;font-weight:500;color:var(--ow-text);line-height:1}
.ow-metric-val .u{font-size:12px;color:var(--ow-text-2);margin-left:2px}
.ow-metric-bar{height:3px;background:rgba(94,234,212,.1);border-radius:2px;overflow:hidden;width:100px}
.ow-metric-fill{height:100%;border-radius:2px;transition:width 1s ease}
.ow-monitor{padding:24px;width:100%;max-width:860px;z-index:2}
.ow-monitor pre{background:rgba(0,0,0,.4);border:1px solid var(--ow-border);border-radius:2px;padding:16px;font-size:11px;overflow:auto;max-height:58vh;color:var(--ow-cyan);font-family:var(--ow-mono)}
.ow-error{color:#ff9090;font-size:12px;padding:8px 18px;background:rgba(80,20,20,.3);z-index:3}
.ow-integ-list{display:flex;flex-direction:column;gap:8px}
.ow-integ-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(94,234,212,.02);cursor:pointer;transition:all .2s}
.ow-integ-item:hover{border-color:var(--ow-cyan);background:rgba(94,234,212,.08);box-shadow:var(--ow-glow)}
.ow-integ-item.offline{opacity:.55;cursor:default}
.ow-integ-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ow-integ-dot.online{background:var(--ow-green);box-shadow:0 0 6px var(--ow-green)}
.ow-integ-dot.idle{background:var(--ow-gold);box-shadow:0 0 6px var(--ow-gold)}
.ow-integ-dot.missing{background:var(--ow-text-muted)}
.ow-integ-name{flex:1;font-size:12px;color:var(--ow-text)}
.ow-integ-en{font-family:var(--ow-mono);font-size:9px;color:var(--ow-text-muted);letter-spacing:.08em}
.ow-action-bar{display:flex;align-items:center;gap:10px;margin-top:8px}
.ow-action-bar button{flex:1;padding:8px 12px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(94,234,212,.06);color:var(--ow-cyan);font-size:11px;cursor:pointer;transition:all .2s}
.ow-action-bar button:hover{border-color:var(--ow-cyan);box-shadow:var(--ow-glow)}
.ow-action-bar button.sec{color:var(--ow-text-2);background:transparent}
.ow-orbit-hint{display:flex;flex-direction:column;align-items:center;gap:8px}
.ow-clickable{cursor:pointer}
.ow-clickable:hover .ow-task-name{color:var(--ow-cyan)}
.ow-toast{position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:12px 22px;border:1px solid var(--ow-border-strong);border-radius:2px;background:rgba(10,18,28,.96);color:var(--ow-cyan);font-size:13px;font-family:var(--ow-mono);box-shadow:var(--ow-glow);pointer-events:none;max-width:min(92vw,520px);text-align:center}
.ow-topo{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:24px;width:100%;max-width:920px;z-index:2}
.ow-topo-card{padding:14px;border:1px solid var(--ow-border);border-radius:2px;background:rgba(8,14,24,.8);cursor:pointer;transition:all .2s}
.ow-topo-card:hover{border-color:var(--ow-cyan);box-shadow:0 0 20px rgba(94,234,212,.08)}
.ow-neural-wrap{position:relative;width:100%;height:100%;max-width:860px;max-height:560px;aspect-ratio:860/560}
.ow-neural-title{position:absolute;top:4%;left:50%;transform:translateX(-50%);font-family:var(--ow-mono);font-size:11px;color:var(--ow-text-muted);letter-spacing:6px;z-index:1}
.ow-neural-svg{width:100%;height:100%}
.ow-nn-layer-label{font-family:var(--ow-mono);font-size:8px;fill:#4a5a70;letter-spacing:1.5px}
.ow-nn-layer-label-zh{font-size:9px;fill:#6d8eb0}
.ow-nn-edge{fill:none;stroke-width:1.5;opacity:.35;transition:opacity .3s,stroke-width .3s}
.ow-nn-edge.active{opacity:.85;stroke-width:2}
.ow-nn-edge-glow{fill:none;stroke-width:4;opacity:.12;filter:blur(2px)}
.ow-nn-node{cursor:grab;transition:filter .2s}
.ow-nn-node:hover{filter:brightness(1.2)}
.ow-nn-node.dragging{cursor:grabbing;filter:brightness(1.35)}
.ow-neural-toolbar{position:absolute;top:4%;right:8%;display:flex;gap:6px;z-index:2}
.ow-neural-btn{font-family:var(--ow-mono);font-size:9px;padding:4px 10px;border:1px solid rgba(94,234,212,.25);background:rgba(8,14,24,.75);color:var(--ow-text-muted);cursor:pointer;border-radius:3px;letter-spacing:1px}
.ow-neural-btn:hover{border-color:var(--ow-cyan);color:var(--ow-cyan)}
.ow-nn-edge-hit{fill:none;stroke:transparent;stroke-width:12;pointer-events:stroke;cursor:pointer}
.ow-nn-tooltip{position:fixed;pointer-events:none;padding:6px 10px;background:rgba(8,14,24,.92);border:1px solid rgba(94,234,212,.3);border-radius:4px;font-family:var(--ow-mono);font-size:10px;color:#e6f1ff;z-index:9999;white-space:nowrap}
.ow-nn-tooltip-w{font-size:11px;color:#f5d67a;margin-top:2px}
.ow-neural-hint{position:absolute;bottom:2%;left:50%;transform:translateX(-50%);font-size:9px;color:#4a5a70;font-family:var(--ow-mono);letter-spacing:1px;z-index:1}
.ow-nn-neuron{stroke:rgba(255,255,255,.2);stroke-width:1}
.ow-nn-neuron.sel{stroke:#fff;stroke-width:2.5}
.ow-nn-label{font-size:10px;fill:#e6f1ff;font-weight:500}
.ow-nn-metric{font-size:9px;fill:#f5d67a;font-family:var(--ow-mono)}
.ow-nn-pulse{filter:drop-shadow(0 0 4px #5eead4)}
.ow-vp-wrap{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none}
.ow-vp-inner{position:absolute;inset:0;transform-origin:50% 50%;will-change:transform}
.ow-vp-bg{position:absolute;inset:-40%;pointer-events:none}
.ow-cmd-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh}
.ow-cmd{min-width:min(520px,92vw);background:rgba(10,18,28,.96);border:1px solid var(--ow-border-strong);border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}
.ow-cmd-input{width:100%;padding:14px 16px;border:none;background:transparent;color:var(--ow-text);font-size:14px;outline:none;font-family:var(--ow-mono)}
.ow-cmd-list{max-height:320px;overflow-y:auto;border-top:1px solid var(--ow-border)}
.ow-cmd-item{padding:10px 16px;cursor:pointer;display:flex;justify-content:space-between;gap:12px;font-size:13px}
.ow-cmd-item:hover,.ow-cmd-item.sel{background:rgba(94,234,212,.08)}
.ow-cmd-item span:last-child{font-size:10px;color:var(--ow-text-muted);font-family:var(--ow-mono)}
.ow-embed{position:absolute;inset:8% 6%;z-index:5;background:rgba(8,14,24,.94);border:1px solid var(--ow-border-strong);border-radius:6px;display:flex;flex-direction:column;backdrop-filter:blur(8px)}
.ow-embed-head{padding:10px 14px;border-bottom:1px solid var(--ow-border);display:flex;justify-content:space-between;align-items:center}
.ow-embed-body{flex:1;overflow:auto;padding:12px 14px}
.ow-detail-card{position:absolute;top:12px;right:12px;width:240px;z-index:4;background:rgba(8,14,24,.92);border:1px solid var(--ow-border-strong);border-radius:6px;padding:12px 14px;backdrop-filter:blur(6px)}
.ow-detail-title{font-size:13px;font-weight:600;color:var(--ow-text);margin-bottom:4px}
.ow-detail-sub{font-size:10px;color:var(--ow-text-muted);font-family:var(--ow-mono);margin-bottom:10px}
.ow-detail-row{display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(94,234,212,.06)}
.ow-detail-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.ow-detail-actions button{font-size:10px;padding:5px 10px;border:1px solid var(--ow-border);background:rgba(94,234,212,.08);color:var(--ow-cyan);cursor:pointer;border-radius:3px}
.ow-ati-wrap{position:relative;width:100%;height:100%;max-width:920px;max-height:600px;aspect-ratio:920/600}
.ow-ati-title{position:absolute;top:2%;left:50%;transform:translateX(-50%);font-family:var(--ow-mono);font-size:12px;color:#c4b5fd;letter-spacing:10px;z-index:2;text-shadow:0 0 20px rgba(167,139,250,.6)}
.ow-ati-sub{position:absolute;top:6%;left:50%;transform:translateX(-50%);font-size:9px;color:#6d8eb0;letter-spacing:4px;z-index:2;font-family:var(--ow-mono)}
.ow-ati-svg{width:100%;height:100%}
.ow-ati-poincare{fill:rgba(8,12,24,.4);stroke:rgba(94,234,212,.12);stroke-width:1}
.ow-ati-geodesic{fill:none;stroke:rgba(94,234,212,.08);stroke-width:.8}
.ow-ati-torus{fill:none;stroke:rgba(167,139,250,.15);stroke-width:1;stroke-dasharray:6 8}
.ow-ati-dl-box{fill:rgba(12,20,36,.7);stroke:rgba(245,214,122,.35);stroke-width:1}
.ow-ati-dl-box.hl{stroke:#f5d67a;filter:drop-shadow(0 0 6px rgba(245,214,122,.4))}
.ow-ati-dl-label{font-family:var(--ow-mono);font-size:7px;fill:#f5d67a;letter-spacing:1px}
.ow-ati-dl-zh{font-size:8px;fill:#7c8ea6}
.ow-ati-hex{fill:none;stroke:rgba(52,211,153,.4);stroke-width:1.2}
.ow-ati-hex-node{fill:rgba(52,211,153,.25);stroke:#34d399;stroke-width:1}
.ow-ati-bar{fill:rgba(94,234,212,.25)}
.ow-ati-singularity{filter:url(#owAtiGlow)}
.ow-ati-metric{font-family:var(--ow-mono);font-size:8px;fill:#a78bfa}
.ow-ati-preset-bar{position:absolute;bottom:2%;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:4px;z-index:3;max-width:640px}
.ow-ati-preset{font-size:8px;padding:3px 7px;border:1px solid rgba(167,139,250,.3);background:rgba(8,14,24,.82);color:#9ca3af;cursor:pointer;border-radius:3px;font-family:var(--ow-mono);letter-spacing:.5px;transition:all .18s}
.ow-ati-preset:hover{border-color:#5eead4;color:#c4f5ef}
.ow-ati-preset.on{border-color:#a78bfa;color:#e9d5ff;box-shadow:0 0 14px rgba(167,139,250,.4),inset 0 0 8px rgba(167,139,250,.15)}
.ow-ati-preset.g-top.on{border-color:#5eead4;color:#c4f5ef;box-shadow:0 0 14px rgba(94,234,212,.4)}
.ow-ati-preset.g-ml.on{border-color:#f5d67a;color:#fdf0c2;box-shadow:0 0 14px rgba(245,214,122,.4)}
.ow-ati-preset.g-chem.on{border-color:#34d399;color:#c8f7e3;box-shadow:0 0 14px rgba(52,211,153,.4)}
.ow-ati-lab-details{position:relative}
.ow-ati-lab-details>summary{list-style:none}
.ow-ati-lab-details>summary::-webkit-details-marker{display:none}
.ow-ati-lab-presets{position:absolute;bottom:120%;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;gap:4px;width:max-content;max-width:360px;padding:6px;background:rgba(8,14,24,.94);border:1px solid rgba(167,139,250,.25);border-radius:6px}
.ow-shell-guide{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;padding:8px 10px;border:1px solid rgba(94,234,212,.25);background:rgba(94,234,212,.06);border-radius:6px}
.ow-shell-guide-text{flex:1;font-size:11px;line-height:1.45;color:#94a3b8}
.ow-shell-guide-text strong{color:#5eead4;font-weight:600}
.ow-shell-guide-x{flex-shrink:0;font-size:10px;padding:4px 8px;border:1px solid rgba(148,163,184,.35);background:transparent;color:#94a3b8;border-radius:4px;cursor:pointer}
.ow-shell-guide-x:hover{border-color:#5eead4;color:#c4f5ef}
.ow-empty-cue{margin:0 0 10px;padding:12px 12px 10px;border:1px dashed rgba(94,234,212,.28);border-radius:8px;background:linear-gradient(160deg,rgba(94,234,212,.07),rgba(8,14,24,.4))}
.ow-empty-cue-slim{padding:8px 10px;margin-bottom:8px}
.ow-empty-cue-art{position:relative;width:44px;height:44px;margin:0 0 8px}
.ow-empty-cue-ring{position:absolute;inset:4px;border:1.5px solid rgba(94,234,212,.35);border-radius:50%}
.ow-empty-cue-dot{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#5eead4;box-shadow:0 0 10px rgba(94,234,212,.45)}
.ow-empty-cue-ray{position:absolute;left:50%;top:2px;width:1.5px;height:12px;margin-left:-0.75px;background:rgba(94,234,212,.55);transform-origin:bottom center;animation:ow-empty-pulse 2.4s ease-in-out infinite}
@keyframes ow-empty-pulse{0%,100%{opacity:.35;transform:scaleY(.7)}50%{opacity:1;transform:scaleY(1)}}
.ow-empty-cue-title{font-size:12px;color:#e2e8f0;font-weight:600;margin-bottom:4px}
.ow-empty-cue-body{font-size:11px;line-height:1.5;color:#94a3b8;margin-bottom:8px}
.ow-empty-cue-actions{display:flex;flex-wrap:wrap;gap:6px}
.ow-memory-tabs{margin-bottom:8px}
.ow-adv-fold{border-top:1px solid rgba(148,163,184,.12)}
.ow-ati-hud{position:absolute;top:10%;left:2.5%;font-family:var(--ow-mono);font-size:8px;color:#6d8eb0;line-height:1.7;z-index:2;max-width:300px}
.ow-ati-hud b{color:#c4b5fd;font-weight:500}
.ow-ati-stage-tag{position:absolute;top:9%;right:2.5%;z-index:2;font-family:var(--ow-mono);font-size:8px;color:#7c8ea6;text-align:right;line-height:1.8}
.ow-ati-stage-tag b{color:#5eead4;font-weight:500;letter-spacing:1px}
.ow-lab-wire{fill:none;stroke-width:1;opacity:.85}
.ow-lab-wire.cyan{stroke:#5eead4}
.ow-lab-wire.violet{stroke:#a78bfa}
.ow-lab-wire.gold{stroke:#f5d67a}
.ow-lab-wire.green{stroke:#34d399}
.ow-lab-wire.pink{stroke:#f472b6}
.ow-lab-wire-dim{fill:none;stroke-width:.7;stroke:#5eead4;opacity:.16}
.ow-lab-loss{fill:none;stroke:#5eead4;stroke-width:2;filter:drop-shadow(0 0 5px rgba(94,234,212,.55))}
.ow-lab-loss-area{fill:rgba(94,234,212,.08)}
.ow-lab-contour{fill:rgba(167,139,250,.05);stroke:#a78bfa;stroke-width:.8;stroke-dasharray:3 5}
.ow-lab-axis{stroke:rgba(124,142,166,.25);stroke-width:.7}
.ow-lab-tick{font-family:var(--ow-mono);font-size:7px;fill:#4a5a70}
.ow-lab-title{font-family:var(--ow-mono);font-size:9px;fill:#e6f1ff;letter-spacing:2px;text-shadow:0 0 10px rgba(94,234,212,.5)}
.ow-lab-title.dim{font-size:7px;fill:#6d8eb0}
.ow-lab-elem{stroke:#34d399;stroke-width:1;transition:filter .2s}
.ow-lab-elem:hover{filter:brightness(1.25)}
.ow-lab-elem.metal{stroke:#f4a261}
.ow-lab-elem.nonmetal{stroke:#5eead4}
.ow-lab-elem.carbon{stroke:#a78bfa}
.ow-lab-elem-symbol{font-family:var(--ow-mono);font-size:15px;font-weight:700;text-anchor:middle}
.ow-lab-elem-z{font-family:var(--ow-mono);font-size:6px;fill:#7c8ea6;text-anchor:middle}
.ow-lab-elem-name{font-family:var(--ow-mono);font-size:6px;fill:#6d8eb0;text-anchor:middle}
.ow-lab-elem-metric{font-family:var(--ow-mono);font-size:6px;fill:#f5d67a;text-anchor:middle}
.ow-lab-bond{fill:none;stroke:rgba(52,211,153,.45);stroke-width:1}
.ow-lab-bond.double{stroke-width:1.6}
.ow-lab-atom{fill:rgba(8,14,24,.9);stroke:#34d399;stroke-width:1.2}
.ow-lab-electron{fill:#5eead4;opacity:.9}
.ow-lab-att-cell{stroke:rgba(8,12,24,.8);stroke-width:1}
.ow-lab-att-token{font-family:var(--ow-mono);font-size:7px;fill:#7c8ea6;text-anchor:middle}
.ow-lab-evo-ring{fill:none;stroke:rgba(124,142,166,.18);stroke-width:1}
.ow-lab-evo-ring.on{stroke:rgba(167,139,250,.7);stroke-width:1.6;filter:drop-shadow(0 0 6px rgba(167,139,250,.6))}
.ow-lab-evo-label{font-family:var(--ow-mono);font-size:7px;fill:#7c8ea6;text-anchor:middle;letter-spacing:1px}
.ow-lab-evo-label.on{fill:#e9d5ff}
.ow-lab-evo-val{font-family:var(--ow-mono);font-size:18px;fill:#e6f1ff;text-anchor:middle;font-weight:700}
.ow-lab-grad-arrow{stroke:#5eead4;stroke-width:1.4;fill:none;marker-end:url(#owLabArrow)}
.ow-lab-node{fill:rgba(8,12,24,.55);stroke:rgba(245,214,122,.5);stroke-width:1}
.ow-lab-node.on{stroke:#f5d67a;filter:drop-shadow(0 0 6px rgba(245,214,122,.5))}
.ow-social-tag{font-size:9px;color:#6d8eb0;margin-top:2px;letter-spacing:.5px;max-width:200px;line-height:1.4}
.ow-social-list{display:flex;flex-direction:column;gap:8px}
.ow-social-presence{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;border:1px solid rgba(94,234,212,.1);cursor:pointer;transition:background .2s}
.ow-social-presence:hover{background:rgba(94,234,212,.06)}
.ow-social-presence.active{border-color:rgba(167,139,250,.4);background:rgba(167,139,250,.08)}
.ow-social-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#5eead4,#a78bfa);display:grid;place-items:center;font-size:11px;font-weight:700;color:#05070d;flex-shrink:0}
.ow-social-name{font-size:12px;color:#e6f1ff}
.ow-social-sub{font-size:10px;color:#7c8ea6;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ow-social-channel{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid rgba(94,234,212,.12);border-radius:4px;cursor:pointer;font-size:12px}
.ow-social-channel:hover{border-color:var(--ow-cyan)}
.ow-social-channel.off{opacity:.45;cursor:default}
.ow-social-feed-item{font-size:11px;padding:6px 0;border-bottom:1px solid rgba(94,234,212,.06);display:flex;gap:8px}
.ow-social-kind{font-size:9px;color:#a78bfa;font-family:var(--ow-mono);min-width:42px}
.ow-msg-hub{display:flex;flex-direction:column;gap:10px}
.ow-msg-compose textarea{width:100%;min-height:64px;background:rgba(8,14,24,.8);border:1px solid var(--ow-border);border-radius:4px;color:#e6f1ff;padding:8px;font-size:12px;resize:vertical;font-family:inherit}
.ow-msg-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ow-msg-select,.ow-msg-btn{font-size:10px;padding:5px 8px;border:1px solid var(--ow-border);background:rgba(8,14,24,.75);color:var(--ow-text-muted);border-radius:3px;font-family:var(--ow-mono)}
.ow-msg-btn:disabled{opacity:.4;cursor:not-allowed}
.ow-msg-btn.primary{border-color:#a78bfa;color:#e9d5ff;cursor:pointer}
.ow-msg-btn.primary:hover{box-shadow:0 0 10px rgba(167,139,250,.3)}
.ow-msg-btn.primary:disabled:hover{box-shadow:none}
.ow-msg-item{padding:8px;border:1px solid rgba(94,234,212,.1);border-radius:4px;font-size:11px;cursor:pointer}
.ow-msg-item.unread{border-color:rgba(167,139,250,.45);background:rgba(167,139,250,.06)}
.ow-msg-meta{font-size:9px;color:#7c8ea6;margin-top:4px}
.ow-msg-attach{font-size:10px;color:#a78bfa;margin-top:4px}
.ow-hub{display:flex;flex-direction:column;gap:10px}
.ow-hub-sec{border:1px solid rgba(94,234,212,.12);border-radius:4px;padding:8px;background:rgba(8,14,24,.55)}
.ow-hub-fold>summary{list-style:none;outline:none}
.ow-hub-fold>summary::-webkit-details-marker{display:none}
.ow-hub-fold>summary::before{content:'▸ ';color:#64748b;font-size:10px}
.ow-hub-fold[open]>summary::before{content:'▾ '}
.ow-hub-title{font-size:9px;color:#4a5a70;letter-spacing:1px;margin-bottom:6px}
.ow-hub-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ow-hub-stat{font-size:11px;color:#e6f1ff}
.ow-hub-link{font-size:10px;color:#5eead4;word-break:break-all;max-height:48px;overflow:auto}
.ow-hub-item{padding:6px 8px;border:1px solid rgba(94,234,212,.1);border-radius:3px;font-size:11px;cursor:pointer;margin-top:4px}
.ow-hub-item:hover{border-color:var(--ow-cyan)}
.ow-hub-mem{font-size:10px;color:#7c8ea6;line-height:1.4;max-height:64px;overflow:auto;margin-top:4px}
.ow-archify-embed{position:absolute;inset:12px 12px 80px;z-index:4;border:1px solid rgba(167,139,250,.35);border-radius:4px;background:rgba(5,7,13,.92);display:flex;flex-direction:column;overflow:hidden}
.ow-archify-head{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(94,234,212,.15);font-size:11px;color:#e6f1ff}
.ow-archify-frame{flex:1;border:none;width:100%;background:#05070d}
.ow-rewind-tl{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto}
.ow-rewind-item{padding:8px 10px;border:1px solid rgba(94,234,212,.12);border-radius:4px;font-size:11px;cursor:pointer;background:rgba(8,14,24,.5)}
.ow-rewind-item:hover{border-color:var(--ow-cyan);background:rgba(94,234,212,.06)}
.ow-rewind-item.active{border-color:rgba(167,139,250,.5)}
.ow-rewind-meta{font-size:9px;color:#7c8ea6;margin-top:4px}
.ow-rewind-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.ow-idea-center{padding:20px 24px 32px;overflow:auto;height:100%;max-width:920px;margin:0 auto}
.ow-idea-hero{margin-bottom:20px}
.ow-idea-hero h2{margin:0;font-size:18px;letter-spacing:3px;color:#e6f1ff}
.ow-idea-tag{font-size:11px;color:#5eead4;margin:6px 0 10px}
.ow-idea-overview{font-size:12px;color:#7c8ea6;line-height:1.55;margin-bottom:8px}
.ow-idea-bullet{font-size:11px;color:#9aa8bc;line-height:1.5;margin-top:4px}
.ow-idea-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;margin-top:8px}
.ow-idea-card{padding:10px;border:1px solid rgba(94,234,212,.12);border-radius:4px;cursor:pointer;background:rgba(8,14,24,.45);transition:border-color .15s}
.ow-idea-card:hover{border-color:rgba(94,234,212,.35)}
.ow-idea-card.active{border-color:var(--ow-cyan);background:rgba(94,234,212,.08)}
.ow-idea-card.compare{box-shadow:inset 0 0 0 1px rgba(167,139,250,.45)}
.ow-idea-card strong{display:block;font-size:12px;color:#e6f1ff}
.ow-idea-sub{font-size:9px;color:#7c8ea6;margin-top:4px;letter-spacing:.5px}
.ow-idea-treat-row{display:flex;flex-wrap:wrap;gap:6px}
.ow-idea-chip{font-size:10px;padding:4px 8px;border:1px solid rgba(94,234,212,.15);border-radius:12px;background:transparent;color:#7c8ea6;cursor:pointer}
.ow-idea-chip.on{border-color:var(--ow-cyan);color:#5eead4;background:rgba(94,234,212,.08)}
.ow-idea-instruction{font-size:11px;color:#9aa8bc;line-height:1.45;margin:12px 0;padding:10px;border:1px dashed rgba(94,234,212,.15);border-radius:4px}
.ow-idea-prompt{width:100%;margin-top:10px;padding:10px;border:1px solid rgba(94,234,212,.15);border-radius:4px;background:rgba(4,8,16,.7);color:#e6f1ff;font-size:12px;line-height:1.45;resize:vertical;min-height:72px;font-family:inherit}
.ow-unread-badge{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#a78bfa;color:#05070d;font-size:9px;font-weight:700;display:grid;place-items:center}
.ow-trigger-wrap{position:relative;display:inline-grid}
    `
    module.exports = { CSS }
    return module.exports
  },
})
