/**
 * Whale-musume mascot stylesheet, ported verbatim from dsh-whale-musume
 * `assets/dsh-whale-moe.css` (MIT). Selectors are namespaced to
 * `data-dsh-whale-pet-*` / `.dsh-whale-pet-*` / `wmp-*` so a legacy
 * install-script mascot can coexist without fighting over the same DOM
 * nodes. The mascot layer only reads DSH palette tokens with safe fallbacks
 * and never touches business selectors.
 */
export const WHALE_MOE_CSS = `
/* ===== whale-musume mascot overlay ===== */
[data-dsh-whale-pet-root] {
  position: fixed;
  z-index: 60;
  pointer-events: none;
  user-select: none;
}

[data-dsh-whale-pet-frame] {
  display: block;
  object-fit: contain;
  pointer-events: auto;
  cursor: pointer;
  filter: drop-shadow(0 6px 8px rgb(0 0 0 / 22%));
  transition: transform 160ms ease-out, filter 160ms ease-out;
}
[data-dsh-whale-pet-frame]:hover {
  transform: translateY(-2px);
  filter: drop-shadow(0 8px 10px rgb(0 0 0 / 26%));
}
/* 工作中：淡蓝光晕让“在跑”一眼可辨 */
[data-dsh-whale-pet-root][data-dsh-whale-pet-busy="true"] [data-dsh-whale-pet-frame] {
  filter: drop-shadow(0 6px 8px rgb(0 0 0 / 22%)) drop-shadow(0 0 9px rgb(70 180 255 / 70%));
}
[data-dsh-whale-pet-root][data-dsh-whale-pet-busy="true"] [data-dsh-whale-pet-frame]:hover {
  filter: drop-shadow(0 8px 10px rgb(0 0 0 / 26%)) drop-shadow(0 0 11px rgb(70 180 255 / 80%));
}

/* 呼吸感：悬浮态与侧栏探头 */
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="float"] [data-dsh-whale-pet-frame],
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="side"] [data-dsh-whale-pet-frame] {
  animation: wmp-breathe 3.4s ease-in-out infinite;
}
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="float"] [data-dsh-whale-pet-frame] {
  cursor: grab;
}
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="float"] [data-dsh-whale-pet-frame]:active {
  cursor: grabbing;
}
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="mini"] [data-dsh-whale-pet-gear-mini] {
  display: none;
}
@keyframes wmp-breathe {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* 气泡：跟随 DSH 自身明暗 */
[data-dsh-whale-pet-bubble] {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  width: max-content;
  max-width: 250px;
  padding: 8px 12px;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  background: var(--dsw-alias-bg-overlay, #ffffff);
  border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%));
  border-radius: 12px;
  box-shadow: 0 8px 20px rgb(0 0 0 / 18%);
  font-size: 13px;
  line-height: 1.5;
  transform: translateX(-50%);
  pointer-events: auto;
}
[data-dsh-whale-pet-bubble]::after {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 10px;
  height: 10px;
  content: "";
  background: var(--dsw-alias-bg-overlay, #ffffff);
  border-right: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%));
  border-bottom: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%));
  transform: translate(-50%, -6px) rotate(45deg);
}
[data-dsh-whale-pet-bubble][hidden] { display: none; }
[data-dsh-whale-pet-bubble].dsh-whale-pet-out {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
  transition: opacity 180ms ease, transform 180ms ease;
}
[data-dsh-whale-pet-bubble].dsh-whale-pet-pop {
  animation: wmp-pop 220ms cubic-bezier(0.34, 1.4, 0.64, 1);
}

@keyframes wmp-pop {
  from { opacity: 0; transform: translateX(-50%) scale(0.92); }
  70% { opacity: 1; transform: translateX(-50%) scale(1.03); }
  to { opacity: 1; transform: translateX(-50%) scale(1); }
}

/* 气泡内齿轮 */
[data-dsh-whale-pet-bubble] button {
  margin-left: 6px;
  padding: 0 6px;
  color: var(--dsw-alias-label-tertiary, #666);
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 12px;
}

/* 悬停齿轮：气泡静默时也能打开偏好 */
[data-dsh-whale-pet-gear-mini] {
  position: absolute;
  top: 0;
  right: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  color: var(--dsw-alias-label-secondary, #444);
  background: var(--dsw-alias-bg-overlay, #ffffff);
  border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%));
  border-radius: 999px;
  font-size: 13px;
  line-height: 1;
  opacity: 0;
  pointer-events: auto;
  transition: opacity 140ms ease, transform 140ms ease;
}
[data-dsh-whale-pet-root]:hover [data-dsh-whale-pet-gear-mini],
[data-dsh-whale-pet-gear-mini]:focus-visible {
  opacity: 1;
}

[data-dsh-whale-pet-particle] {
  position: fixed;
  z-index: 61;
  pointer-events: none;
  animation: wmp-particle-rise 900ms ease-out forwards;
}
@keyframes wmp-particle-rise {
  0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  20% { opacity: 0.9; }
  100% { opacity: 0; transform: translate(var(--wmp-drift, 0px), -30px) scale(1); }
}
[data-dsh-whale-pet-particle].dsh-particle-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff, rgb(242 139 171 / 90%));
  box-shadow: 0 0 6px rgb(242 139 171 / 55%);
}
[data-dsh-whale-pet-particle].dsh-particle-spark {
  width: 7px;
  height: 7px;
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
  background: #ffd98a;
  box-shadow: 0 0 6px rgb(255 217 138 / 70%);
}
[data-dsh-whale-pet-particle].dsh-particle-heart {
  width: 9px;
  height: 9px;
  background: #f28bab;
  clip-path: path("M5 9 C2 6 0 4.2 0 2.5 C0 1 1 0 2.4 0 C3.6 0 4.6 0.8 5 1.9 C5.4 0.8 6.4 0 7.6 0 C9 0 10 1 10 2.5 C10 4.2 8 6 5 9 Z");
  opacity: 0.85;
}

[data-dsh-whale-pet-root].dsh-whale-pet-shake {
  animation: wmp-shake 260ms ease-in-out 2;
}
@keyframes wmp-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

/* 代码密集时迷你化（仅手动 mini 形态使用 dense 标记） */
[data-dsh-whale-pet-root][data-dsh-whale-pet-dense] [data-dsh-whale-pet-frame] {
  width: 64px !important;
  height: 64px !important;
}
[data-dsh-whale-pet-root][data-dsh-whale-pet-dense] :is([data-dsh-whale-pet-bubble], [data-dsh-whale-pet-panel]) {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  [data-dsh-whale-pet-root] * {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}

@media (forced-colors: active) {
  [data-dsh-whale-pet-root] { display: none; }
}

/* ===== ADV motion: frame + dual crossfade layers ===== */
[data-dsh-whale-pet-frame] {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: 50% 90%;
  animation: wmp-breathe 3.4s ease-in-out infinite;
}
[data-dsh-whale-pet-motion] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
@keyframes wmp-breathe {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
[data-dsh-whale-pet-layer] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transform-origin: 50% 92%;
  animation: wmp-sway 6s ease-in-out infinite;
}
[data-dsh-whale-pet-layer].dsh-whale-pet-active {
  opacity: 1;
}
[data-dsh-whale-pet-layer].dsh-whale-pet-pose-in {
  animation: wmp-sway 6s ease-in-out infinite, wmp-pose-in 320ms ease-out 1;
}
@keyframes wmp-pose-in {
  from { opacity: 0.2; transform: translateY(4px) scale(1.04); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes wmp-sway {
  0%, 100% { transform: rotate(0deg) translateX(0); }
  25% { transform: rotate(1.2deg) translateX(1px); }
  75% { transform: rotate(-1.2deg) translateX(-1px); }
}
/* 注视跟随：由 JS 更新 --wmp-gaze-x / --wmp-gaze-y */
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode=float] [data-dsh-whale-pet-layer].dsh-whale-pet-active,
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode=side] [data-dsh-whale-pet-layer].dsh-whale-pet-active {
  transform: translate(var(--wmp-gaze-x, 0px), var(--wmp-gaze-y, 0px)) rotate(var(--wmp-gaze-r, 0deg));
}
/* 待机微动作：幅度放大，糯叽叽的挤压回弹 */
[data-dsh-whale-pet-root].dsh-whale-pet-squint [data-dsh-whale-pet-motion] {
  animation: wmp-breathe 3.4s ease-in-out infinite, wmp-squint 560ms ease-in-out 1;
}
@keyframes wmp-squint {
  0%, 100% { transform: translateY(0) scale(1); }
  40% { transform: translateY(-6px) scale(1.04, 0.94); }
}
[data-dsh-whale-pet-root].dsh-whale-pet-hop [data-dsh-whale-pet-motion] {
  animation: wmp-breathe 3.4s ease-in-out infinite, wmp-hop 720ms cubic-bezier(0.34, 1.4, 0.64, 1) 1;
}
@keyframes wmp-hop {
  0% { transform: translateY(0) scale(1) rotate(0deg); }
  45% { transform: translateY(-14px) scale(1.04, 0.96) rotate(-3deg); }
  100% { transform: translateY(0) scale(1) rotate(0deg); }
}
/* 注意力爆点 */
[data-dsh-whale-pet-burst] {
  position: absolute;
  bottom: calc(100% - 8px);
  left: 50%;
  z-index: 2;
  font-size: 22px;
  font-weight: 700;
  pointer-events: none;
  animation: wmp-burst 900ms cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
}
@keyframes wmp-burst {
  0% { opacity: 0; transform: translate(-50%, 6px) scale(0.4); }
  20% { opacity: 1; transform: translate(-50%, 0) scale(1.25); }
  70% { opacity: 1; transform: translate(-50%, -4px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -12px) scale(0.9); }
}
/* 点击飞出的 emoji/星星 */
[data-dsh-whale-pet-burst].dsh-emoji-fly {
  left: 50%;
  top: 34%;
  bottom: auto;
  font-size: 20px;
  animation-name: wmp-emoji-fly;
  animation-duration: 850ms;
  animation-timing-function: cubic-bezier(0.22, 1.2, 0.36, 1);
  animation-fill-mode: both;
}
@keyframes wmp-emoji-fly {
  0% { opacity: 0; transform: translate(-50%, 0) scale(0.3) rotate(0deg); }
  18% { opacity: 1; transform: translate(calc(-50% + var(--wmp-dx, 0px)), -18px) scale(1.25) rotate(var(--wmp-rot, 8deg)); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--wmp-dx, 0px) * 1.9), var(--wmp-dy, -40px)) scale(0.9) rotate(calc(var(--wmp-rot, 8deg) * 1.5)); }
}
/* 打字机光标 */
[data-dsh-whale-pet-caret] { opacity: 1; animation: wmp-caret 800ms steps(1) infinite; }@keyframes wmp-caret { 50% { opacity: 0; } }

/* 状态签：让状态过渡可读 */
[data-dsh-whale-pet-chip] {
  position: absolute;
  top: -14px;
  left: 50%;
  z-index: 3;
  padding: 2px 8px;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  background: var(--dsw-alias-bg-overlay, #fff);
  border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%));
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: wmp-chip 2.2s ease-out forwards;
  pointer-events: none;
}
@keyframes wmp-chip {
  0% { opacity: 0; transform: translate(-50%, 4px); }
  15% { opacity: 1; transform: translate(-50%, 0); }
  75% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -6px); }
}

/* ===== 克制 ADV 动作（不形变、只位移） ===== */
[data-dsh-whale-pet-frame] { animation: wmp-breathe-soft 3.4s ease-in-out infinite; }
@keyframes wmp-breathe-soft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="float"] [data-dsh-whale-pet-layer],
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="side"] [data-dsh-whale-pet-layer] {
  animation: wmp-sway-soft 6s ease-in-out infinite;
}
@keyframes wmp-sway-soft {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(1.2deg); }
}
[data-dsh-whale-pet-root].dsh-whale-pet-hop [data-dsh-whale-pet-motion] {
  animation: wmp-breathe-soft 3.4s ease-in-out infinite, wmp-hop-soft 0.6s ease-out 1;
}
@keyframes wmp-hop-soft {
  0% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
  100% { transform: translateY(0); }
}
[data-dsh-whale-pet-root].dsh-whale-pet-react [data-dsh-whale-pet-motion] {
  animation: wmp-react-soft 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
}
@keyframes wmp-react-soft {
  0% { transform: translateY(0) scale(1) rotate(0deg); }
  35% { transform: translateY(-12px) scale(1.1, 0.9) rotate(-4deg); }
  100% { transform: translateY(0) scale(1) rotate(0deg); }
}
[data-dsh-whale-pet-root].dsh-whale-pet-spin [data-dsh-whale-pet-motion] {
  animation: wmp-spin-soft 0.85s cubic-bezier(0.34, 1.4, 0.64, 1) 1;
}
@keyframes wmp-spin-soft {
  0% { transform: translateY(0) rotate(0deg) scale(1); }
  50% { transform: translateY(-12px) rotate(180deg) scale(1.04, 0.96); }
  100% { transform: translateY(0) rotate(360deg) scale(1); }
}
[data-dsh-whale-pet-root][data-dsh-whale-pet-mode="bar"] [data-dsh-whale-pet-frame] {
  animation: wmp-breathe-soft 3.4s ease-in-out infinite, wmp-slide-in 0.3s ease-out 1;
}
@keyframes wmp-slide-in {
  from { transform: translateX(36px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
[data-dsh-whale-pet-root].dsh-whale-pet-dragging [data-dsh-whale-pet-frame]:hover {
  transform: none;
}
[data-dsh-whale-pet-root].dsh-whale-pet-dragging [data-dsh-whale-pet-frame] {
  cursor: grabbing;
}

/* 被拎起来：以顶部为支点，摇摆角度跟随光标水平速度 */
[data-dsh-whale-pet-root].dsh-whale-pet-dragging [data-dsh-whale-pet-motion] {
  transform-origin: 50% 14%;
  transform: translateY(3px) rotate(var(--wmp-drag-angle, 0deg));
  transition: transform 120ms ease-out;
}

/* ===== 12 种特效 ===== */
[data-dsh-whale-pet-fx] { position: fixed; z-index: 61; pointer-events: none; }
[data-dsh-whale-pet-fx].fx-ripple { border: 2px solid rgb(232 111 150 / 70%); border-radius: 50%; transform: translate(-50%, -50%); animation: wmp-fx-ripple 0.7s ease-out forwards; }
@keyframes wmp-fx-ripple { from { width: 8px; height: 8px; opacity: 0.9; transform: translate(-50%, -50%) scale(0.4); } to { width: 90px; height: 90px; opacity: 0; transform: translate(-50%, -50%) scale(1); } }
[data-dsh-whale-pet-fx].fx-heart { width: 8px; height: 8px; background: #f28bab; clip-path: path("M4 8 C1.6 5.4 0 3.8 0 2.3 C0 0.9 0.9 0 2.1 0 C3.2 0 4 0.7 4.3 1.6 C4.6 0.7 5.5 0 6.6 0 C7.8 0 8.7 0.9 8.7 2.3 C8.7 3.8 7.1 5.4 4 8 Z"); animation: wmp-fx-rise 0.9s ease-out forwards; }
[data-dsh-whale-pet-fx].fx-spark { width: 7px; height: 7px; clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); background: #ffd98a; animation: wmp-fx-rise 1s ease-out forwards; }
@keyframes wmp-fx-rise { 0% { opacity: 0; transform: translateY(0); } 20% { opacity: 0.95; } 100% { opacity: 0; transform: translateY(-28px); } }
[data-dsh-whale-pet-fx].fx-sugar { width: 6px; height: 6px; border-radius: 50%; background: #f9e3ee; box-shadow: 0 0 6px #f28bab; animation: wmp-fx-sugar 1.1s linear forwards; }
@keyframes wmp-fx-sugar { from { transform: translateY(-10px) rotate(0deg); opacity: 1; } to { transform: translateY(70px) rotate(360deg); opacity: 0; } }
[data-dsh-whale-pet-fx].fx-ribbon { color: #f28bab; font-size: 22px; animation: wmp-fx-ribbon 1.2s ease-out forwards; }
@keyframes wmp-fx-ribbon { 0% { transform: translateY(0) scale(0.3); opacity: 0; } 30% { opacity: 1; transform: translateY(-30px) scale(1.3); } 100% { transform: translateY(-80px) scale(1); opacity: 0; } }
[data-dsh-whale-pet-fx].fx-flash { width: 54px; height: 54px; border-radius: 50%; background: radial-gradient(circle, #ffe9a8, transparent 70%); animation: wmp-fx-flash 0.7s ease-out forwards; }
@keyframes wmp-fx-flash { from { transform: scale(0.2); opacity: 1; } to { transform: scale(2); opacity: 0; } }
[data-dsh-whale-pet-fx].fx-dust { width: 4px; height: 4px; border-radius: 50%; background: #d8c9ff; animation: wmp-fx-dust 0.8s ease-out forwards; }
@keyframes wmp-fx-dust { from { transform: translate(0, 0); opacity: 0.9; } to { transform: translate(14px, -18px); opacity: 0; } }
[data-dsh-whale-pet-fx].fx-shard { color: #ffd166; font-size: 12px; animation: wmp-fx-shard 0.8s ease-out forwards; }
@keyframes wmp-fx-shard { from { transform: translate(0, 0) rotate(0); opacity: 1; } to { transform: translate(-16px, 22px) rotate(90deg); opacity: 0; } }
[data-dsh-whale-pet-fx].fx-trail { width: 5px; height: 5px; border-radius: 50%; background: rgb(242 139 171 / 70%); animation: wmp-fx-trail 0.6s ease-out forwards; }
@keyframes wmp-fx-trail { from { transform: scale(1); opacity: 0.9; } to { transform: scale(0.2); opacity: 0; } }
[data-dsh-whale-pet-fx].fx-star { color: #ffe9a8; font-size: 12px; animation: wmp-fx-star 1.4s ease-in-out infinite; }
@keyframes wmp-fx-star { 50% { opacity: 0.2; transform: translateY(3px); } }
[data-dsh-whale-pet-fx].fx-steam { color: rgb(200 190 220 / 80%); font-size: 14px; animation: wmp-fx-steam 1.2s ease-out forwards; }
@keyframes wmp-fx-steam { from { transform: translateY(0); opacity: 0.8; } to { transform: translateY(-26px); opacity: 0; } }
[data-dsh-whale-pet-fx].fx-smoke { width: 10px; height: 10px; border-radius: 50%; background: rgb(80 80 100 / 55%); animation: wmp-fx-smoke 0.9s ease-out forwards; }
@keyframes wmp-fx-smoke { from { transform: scale(0.4); opacity: 0.8; } to { transform: scale(1.4) translateY(-10px); opacity: 0; } }

/* 深夜模式 */
body[data-dsh-whale-pet-night] [data-dsh-whale-pet-root] { filter: brightness(0.82); }
body[data-dsh-whale-pet-night]::after {
  position: fixed;
  inset: 0;
  z-index: 0;
  content: "";
  pointer-events: none;
  background: radial-gradient(rgb(255 233 168 / 5%) 1px, transparent 1.6px);
  background-size: 34px 34px;
}

/* 右键菜单 */
[data-dsh-whale-pet-context] {
  position: fixed;
  z-index: 70;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 180px;
  padding: 6px;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  background: var(--dsw-alias-bg-overlay, #fff);
  border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%));
  border-radius: 10px;
  box-shadow: 0 10px 26px rgb(0 0 0 / 22%);
}
[data-dsh-whale-pet-context] button {
  padding: 7px 10px;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
}
[data-dsh-whale-pet-context] button:hover { background: var(--dsw-alias-bg-layer-2, #f3f3f3); }

/* ===== 设置面板（Cordis 移植新增，自包含） ===== */
[data-dsh-whale-pet-panel] {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 320px;
  max-height: min(72vh, 640px);
  overflow-y: auto;
  padding: 12px;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  background: var(--dsw-alias-bg-overlay, #ffffff);
  border: 1px solid var(--dsw-alias-border-l3, rgb(0 0 0 / 18%));
  border-radius: 14px;
  box-shadow: 0 14px 34px rgb(0 0 0 / 26%);
  font-size: 13px;
  pointer-events: auto;
}
[data-dsh-whale-pet-panel][hidden] { display: none; }
[data-dsh-whale-pet-panel] header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  padding: 0 0 4px;
}
[data-dsh-whale-pet-panel] header button {
  padding: 2px 8px;
  color: var(--dsw-alias-label-secondary, #666);
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
[data-dsh-whale-pet-panel] .wmp-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  background: var(--dsw-alias-bg-module-platform, transparent);
  border: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%));
  border-radius: 12px;
}
[data-dsh-whale-pet-panel] .wmp-card-title {
  padding: 6px 0 2px;
  color: var(--dsw-alias-label-secondary, #666);
  font-size: 12px;
  font-weight: 600;
}
[data-dsh-whale-pet-panel] .wmp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%));
}
[data-dsh-whale-pet-panel] .wmp-row:last-child { border-bottom: 0; }
[data-dsh-whale-pet-panel] .wmp-row input[type="text"],
[data-dsh-whale-pet-panel] .wmp-row input[type="password"],
[data-dsh-whale-pet-panel] .wmp-row select {
  min-width: 0;
  max-width: 170px;
  padding: 4px 8px;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  background: var(--dsw-alias-bg-layer-2, #f3f3f3);
  border: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%));
  border-radius: 8px;
  font-size: 12px;
}
[data-dsh-whale-pet-panel] .wmp-row button.wmp-btn {
  padding: 4px 10px;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  background: var(--dsw-alias-bg-layer-2, #f3f3f3);
  border: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%));
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}
[data-dsh-whale-pet-panel] button.wmp-switch {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 44px;
  height: 24px;
  flex: none;
  padding: 3px;
  background: var(--dsw-alias-border-l3, #c9cdd6);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: background 160ms ease;
}
[data-dsh-whale-pet-panel] button.wmp-switch[aria-pressed="true"] {
  justify-content: flex-end;
  background: var(--dsw-static-accent, #4da3ff);
}
[data-dsh-whale-pet-panel] button.wmp-switch span {
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
}
[data-dsh-whale-pet-panel] .wmp-status {
  color: var(--dsw-alias-label-secondary, #666);
  font-size: 12px;
  line-height: 16px;
  word-break: break-all;
}
[data-dsh-whale-pet-panel] .wmp-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 4px 0 10px;
  width: 100%;
}
[data-dsh-whale-pet-panel] .wmp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 8px 4px;
  background: var(--dsw-alias-interactive-bg-hover, transparent);
  border: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%));
  border-radius: 12px;
}
[data-dsh-whale-pet-panel] .wmp-stat span:first-child { font-size: 16px; }
[data-dsh-whale-pet-panel] .wmp-stat .wmp-stat-label {
  color: var(--dsw-alias-label-secondary, #666);
  font-size: 11px;
  line-height: 14px;
}
[data-dsh-whale-pet-panel] .wmp-stat .wmp-stat-value {
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}
[data-dsh-whale-pet-panel] .wmp-achieve {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 6px;
  padding: 4px 0 10px;
  width: 100%;
}
[data-dsh-whale-pet-panel] .wmp-achieve .wmp-ach {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  text-align: center;
  border: 1px solid var(--dsw-alias-border-l2, rgb(0 0 0 / 12%));
  border-radius: 10px;
}
[data-dsh-whale-pet-panel] .wmp-achieve .wmp-ach.wmp-locked { opacity: 0.38; }
[data-dsh-whale-pet-panel] .wmp-achieve .wmp-ach.wmp-unlocked { background: var(--dsw-alias-interactive-bg-hover); }
[data-dsh-whale-pet-panel] .wmp-achieve .wmp-ach span:first-child { font-size: 16px; }
[data-dsh-whale-pet-panel] .wmp-achieve .wmp-ach span:last-child { font-size: 11px; line-height: 14px; }
`
