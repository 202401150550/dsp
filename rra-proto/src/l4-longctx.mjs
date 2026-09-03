/**
 * L4：长上下文字节匹配评测 vs 固定窗口（公平对照）。
 * 不宣称神经 RRA 已赢；该差则差、该赢才赢。
 */
import {
  synthesizeSequence,
  runByteMatchedBench,
  baselineFixedWindow,
  baselinePowerLawShell,
  scoreRetention,
  tokenBytes,
} from './baselines.mjs'

function round4(n) {
  return Math.round(n * 10000) / 10000
}

/**
 * 在多个预算比例下跑长序列对照。
 */
export function runLongContextByteMatch(opts = {}) {
  const length = Math.max(512, Number(opts.length) || 2048)
  const landmarkEvery = Number(opts.landmarkEvery) || 64
  const tau = Number(opts.tau) || 96
  const alpha = Number(opts.alpha) || 1
  const fractions = Array.isArray(opts.budgetFractions) && opts.budgetFractions.length
    ? opts.budgetFractions
    : [0.15, 0.3, 0.45]

  const tokens = synthesizeSequence({ length, landmarkEvery })
  const totalBytes = tokens.reduce((s, t) => s + tokenBytes(t), 0)

  const sweeps = fractions.map((frac) => {
    const byteBudget = Math.max(1024, Math.floor(totalBytes * frac))
    const full = runByteMatchedBench({
      length,
      byteBudget,
      tau,
      alpha,
      landmarkEvery,
    })
    const window = full.rows.find((r) => r.id === 'fixed-window')
    const shell = full.rows.find((r) => r.id === 'power-law-shell')
    const stride = full.rows.find((r) => r.id === 'uniform-stride')

    const fair = [window, shell, stride].filter((r) => r && r.withinBudget)
    const spendGap = window && shell
      ? Math.abs(window.usedBytes - shell.usedBytes) / byteBudget
      : null

    const delta = window && shell
      ? {
        score: round4(shell.score - window.score),
        landmarkHit: round4(shell.landmarkHit - window.landmarkHit),
        recentHit: round4(shell.recentHit - window.recentHit),
        spendGap: spendGap == null ? null : round4(spendGap),
      }
      : null

    let verdict = 'inconclusive'
    if (window && shell && window.withinBudget && shell.withinBudget) {
      if (shell.score > window.score) verdict = 'shell-higher-score'
      else if (shell.score < window.score) verdict = 'window-higher-score'
      else verdict = 'tie'
    }

    return {
      frac,
      byteBudget,
      totalBytes,
      window: window || null,
      shell: shell || null,
      stride: stride || null,
      fairCount: fair.length,
      delta,
      verdict,
      winnerFair: full.winnerFair,
    }
  })

  const comparable = sweeps.filter((s) => s.window?.withinBudget && s.shell?.withinBudget)
  const matchedSpend = comparable.filter((s) => (s.delta?.spendGap ?? 1) <= 0.2)

  return {
    ok: true,
    stage: 'L4',
    protocol: 'rra/0.4-proto-longctx',
    implemented: false,
    fullNeuralRra: false,
    hasWeights: false,
    disclaimer: '长上下文字节匹配对照；非神经 RRA 质量声明。该差则差、该赢才赢。',
    input: {
      length,
      totalBytes,
      landmarkEvery,
      tau,
      alpha,
      budgetFractions: fractions,
    },
    sweeps,
    summary: {
      comparableSweeps: comparable.length,
      matchedSpendSweeps: matchedSpend.length,
      shellWins: comparable.filter((s) => s.verdict === 'shell-higher-score').length,
      windowWins: comparable.filter((s) => s.verdict === 'window-higher-score').length,
      ties: comparable.filter((s) => s.verdict === 'tie').length,
    },
    generatedAt: new Date().toISOString(),
  }
}

/**
 * L4 门槛：长序列可跑、预算内公平对照成立、支出大致匹配；不强制壳赢。
 */
export function runL4Gate(opts = {}) {
  const length = Number(opts.length) || 2048
  const report = runLongContextByteMatch({
    length,
    landmarkEvery: opts.landmarkEvery || 64,
    budgetFractions: opts.budgetFractions || [0.15, 0.3, 0.45],
    tau: opts.tau || 96,
    alpha: opts.alpha || 1,
  })

  const structural =
    report.input.length >= 2048
    && report.summary.comparableSweeps >= 2
    && report.summary.matchedSpendSweeps >= 1
    && report.implemented === false
    && report.fullNeuralRra === false

  // 额外抽检：同一预算下 fixed vs shell 字节差不极端（已在 matchedSpend）
  const sample = report.sweeps.find((s) => s.frac === 0.3) || report.sweeps[1] || report.sweeps[0]
  const sampleOk = !!(sample && sample.window && sample.shell && sample.window.withinBudget && sample.shell.withinBudget)

  return {
    stage: 'L4',
    implemented: false,
    fullNeuralRra: false,
    ok: structural && sampleOk,
    report,
    checks: {
      longEnough: report.input.length >= 2048,
      comparableSweeps: report.summary.comparableSweeps,
      matchedSpendSweeps: report.summary.matchedSpendSweeps,
      sampleOk,
      shellWins: report.summary.shellWins,
      windowWins: report.summary.windowWins,
    },
    note: structural && sampleOk
      ? 'L4 长上下文公平对照基础设施通过（未宣称神经胜利）'
      : 'L4 门槛未过：对照不足或支出未匹配',
    disclaimer: report.disclaimer,
  }
}

/** 单预算快速对照（测试用） */
export function compareShellVsWindow(tokens, budget, cfg = {}) {
  const window = baselineFixedWindow(tokens, budget)
  const shell = baselinePowerLawShell(tokens, budget, cfg)
  return {
    window: { ...window, ...scoreRetention(tokens, window.kept), neural: false },
    shell: { ...shell, ...scoreRetention(tokens, shell.kept), neural: false },
    budget,
  }
}
