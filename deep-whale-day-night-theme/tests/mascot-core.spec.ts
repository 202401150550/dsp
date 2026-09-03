/**
 * Whale-musume mascot core state machine spec.
 *
 * Ported from dsh-whale-musume `test/whale-moe-core.test.mjs` and
 * `test/whale-moe-growth.test.mjs` (MIT) against the TypeScript port in
 * `src/client/mascot/core.ts`. All 27 upstream assertions are preserved
 * unchanged.
 */
import { describe, expect, it } from 'vitest'
import * as core from '../src/client/mascot/core.ts'

const T0 = Date.UTC(2026, 7, 15, 10, 0, 0)
const freshSignals = (over: Record<string, unknown> = {}) => ({
  view: 'workbench', waiting: false, thinking: false, tool: false,
  successAt: -Infinity, error: false, curiousAt: -Infinity,
  lastInteraction: T0, denseCode: false, ...over,
})

describe('whale-moe core state machine', () => {
  it('priority: error beats tool and thinking', () => {
    const out = core.computeState(null, freshSignals({ error: true, tool: true, thinking: true }), T0, () => 0)
    expect(out.state).toBe('failure')
    expect(out.speak).toBe(true)
    expect(out.line.length).toBeGreaterThan(0)
  })

  it('priority: tool beats thinking', () => {
    const out = core.computeState(null, freshSignals({ tool: true, thinking: true }), T0, () => 0)
    expect(out.state).toBe('tool')
    expect(out.pose).toBe('running')
  })

  it('success only wins inside its 2s window', () => {
    const inWindow = core.computeState(null, freshSignals({ successAt: T0 - 1500 }), T0, () => 0)
    expect(inWindow.state).toBe('success')
    const expired = core.computeState(null, freshSignals({ successAt: T0 - 3000 }), T0, () => 1)
    expect(expired.state).toBe('idle')
  })

  it('afk after 3 minutes of no interaction', () => {
    const idle = core.computeState(null, freshSignals({ lastInteraction: T0 - 170_000 }), T0, () => 1)
    expect(idle.state).toBe('idle')
    const nap = core.computeState(idle, freshSignals({ lastInteraction: T0 - 181_000 }), T0, () => 0)
    expect(nap.state).toBe('afk')
    expect(nap.pose).toBe('sleep')
  })

  it('speech gap: same state re-speaks only after 6s', () => {
    const first = core.computeState(null, freshSignals({ error: true }), T0, () => 0)
    expect(first.speak).toBe(true)
    const quiet = core.computeState(first, freshSignals({ error: true }), T0 + 3000, () => 0)
    expect(quiet.speak).toBe(false)
    expect(quiet.line).toBe('')
    const again = core.computeState(quiet, freshSignals({ error: true }), T0 + 9000, () => 0)
    expect(again.speak).toBe(true)
    expect(again.streak).toBe(1)
  })

  it('idle stays idle no matter the rng (no teasing flicker)', () => {
    const low = core.computeState(null, freshSignals(), T0, () => 0.001)
    expect(low.state).toBe('idle')
    const high = core.computeState(null, freshSignals(), T0, () => 0.5)
    expect(high.state).toBe('idle')
  })

  it('waiting beats idle but not thinking', () => {
    expect(core.computeState(null, freshSignals({ waiting: true }), T0, () => 1).state).toBe('waiting')
    expect(core.computeState(null, freshSignals({ waiting: true, thinking: true }), T0, () => 1).state).toBe('thinking')
  })

  it('petDisabled short-circuits to hidden without speech', () => {
    const out = core.computeState(null, freshSignals({ petDisabled: true, error: true }), T0, () => 0)
    expect(out.state).toBe('hidden')
    expect(out.pose).toBeNull()
    expect(out.speak).toBe(false)
  })

  it('denseCode flips mode to mini', () => {
    const out = core.computeState(null, freshSignals({ denseCode: true }), T0, () => 1)
    expect(out.mode).toBe('mini')
  })

  it('default rng falls back to idle, not teasing', () => {
    const out = core.computeState(null, freshSignals(), T0)
    expect(out.state).toBe('idle')
  })

  it('partial prev is normalized with defaults', () => {
    const out = core.computeState({ state: 'idle' }, freshSignals({ error: true }), T0, () => 0)
    expect(out.state).toBe('failure')
    expect(out.lastSpeechAt).toBe(T0)
    expect(out.lineCount).toBe(1)
    expect(out.streak).toBe(1)
  })

  it('curious wins inside its 6s window', () => {
    const inWindow = core.computeState(null, freshSignals({ curiousAt: T0 - 4000 }), T0, () => 1)
    expect(inWindow.state).toBe('curious')
    const expired = core.computeState(null, freshSignals({ curiousAt: T0 - 7000 }), T0, () => 1)
    expect(expired.state).toBe('idle')
  })

  it('afk never covers active work signals', () => {
    const err = core.computeState(null, freshSignals({ error: true, lastInteraction: T0 - 500_000 }), T0, () => 0)
    expect(err.state).toBe('failure')
    const tool = core.computeState(null, freshSignals({ tool: true, lastInteraction: T0 - 500_000 }), T0, () => 0)
    expect(tool.state).toBe('tool')
  })

  it('non-finite or future success timestamps are ignored', () => {
    expect(core.computeState(null, freshSignals({ successAt: Infinity }), T0, () => 1).state).not.toBe('success')
    expect(core.computeState(null, freshSignals({ successAt: T0 + 5000 }), T0, () => 1).state).not.toBe('success')
    expect(core.computeState(null, freshSignals({ successAt: T0 - 500 }), T0, () => 1).state).toBe('success')
  })

  it('greetBucket maps all six time buckets', () => {
    expect(core.greetBucket(5)).toBe('night')
    expect(core.greetBucket(6)).toBe('morning')
    expect(core.greetBucket(8)).toBe('morning')
    expect(core.greetBucket(9)).toBe('forenoon')
    expect(core.greetBucket(11)).toBe('forenoon')
    expect(core.greetBucket(12)).toBe('noon')
    expect(core.greetBucket(13)).toBe('noon')
    expect(core.greetBucket(14)).toBe('afternoon')
    expect(core.greetBucket(17)).toBe('afternoon')
    expect(core.greetBucket(18)).toBe('evening')
    expect(core.greetBucket(22)).toBe('evening')
    expect(core.greetBucket(23)).toBe('night')
  })

  it('weatherText maps WMO codes', () => {
    expect(core.weatherText(0).kind).toBe('sunny')
    expect(core.weatherText(2).kind).toBe('cloudy')
    expect(core.weatherText(61).kind).toBe('rain')
    expect(core.weatherText(71).kind).toBe('snow')
    expect(core.weatherText(95).kind).toBe('thunder')
    expect(core.weatherText(3).kind).toBe('cloudy')
    expect(core.weatherText(45).kind).toBe('fog')
    expect(core.weatherText(999).kind).toBe('unknown')
  })

  it('classifyTask sorts text into topic buckets', () => {
    expect(core.classifyTask('帮我写一个 React 组件')).toBe('code')
    expect(core.classifyTask('把这段文章润色成周报')).toBe('write')
    expect(core.classifyTask('调研一下 Server-Sent Events 的原理')).toBe('research')
    expect(core.classifyTask('这个报错怎么修复')).toBe('bug')
    expect(core.classifyTask('把 CSV 清洗后做统计')).toBe('data')
    expect(core.classifyTask('部署到服务器上线')).toBe('deploy')
    expect(core.classifyTask('今天心情不错')).toBe('general')
  })

  it('pickDialogueAvoidRecent avoids recent lines', () => {
    const recent = ['早啊主人，太阳都晒到尾巴了才来🌞', '主人早安！鲸鱼娘今天也是精神百倍😤']
    const pick = core.pickDialogueAvoidRecent('daily', 'morning', 0, () => 0.99, recent)
    expect(pick).toBe('早～再不起来我就把你的咖啡喝光啦☕')
  })

  it('meme keyword groups match and have lines', () => {
    expect(core.matchKeyword('我是打工人', true)).toBe('worker')
    expect(core.matchKeyword('今天一直在摸鱼', true)).toBe('slack')
    expect(core.matchKeyword('DDL 要到了', true)).toBe('ddl')
    expect(core.matchKeyword('老板又在画饼', true)).toBe('cake')
    expect(core.matchKeyword('已老实求放过', true)).toBe('crazy')
    expect(core.matchKeyword('我立个 flag', true)).toBe('flag')
    expect(core.matchKeyword('这个 bug 好玄学', true)).toBe('bugtalk')
    for (const id of ['worker', 'slack', 'ddl', 'cake', 'crazy', 'flag', 'bugtalk']) {
      expect(core.DIALOGUE.keyword[id] && core.DIALOGUE.keyword[id].length).toBeGreaterThanOrEqual(5)
    }
    for (const id of ['worker', 'slack', 'ddl', 'cake', 'crazy', 'flag']) {
      expect(core.DIALOGUE.meme[id] && core.DIALOGUE.meme[id].length).toBeGreaterThanOrEqual(5)
    }
    for (const id of ['code', 'write', 'research', 'bug', 'data', 'deploy', 'general']) {
      expect(core.DIALOGUE.context[id] && core.DIALOGUE.context[id].length).toBeGreaterThanOrEqual(4)
    }
    for (const id of ['sunny', 'rain', 'snow', 'thunder', 'cloudy', 'fog', 'hot', 'cold', 'wind']) {
      expect(core.DIALOGUE.weather[id] && core.DIALOGUE.weather[id].length).toBeGreaterThanOrEqual(3)
    }
    for (const id of ['morning', 'forenoon', 'noon', 'afternoon', 'evening', 'night']) {
      expect(core.DIALOGUE.greet[id] && core.DIALOGUE.greet[id].length).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('whale-moe growth', () => {
  it('pat raises mood and affinity and unlocks first-pat', () => {
    const out = core.computeGrowth(null, { type: 'pat' }, T0, 1)
    expect(out.growth.mood).toBe(74)
    expect(out.growth.affinity).toBe(2)
    expect(out.unlocks.includes('first-pat')).toBe(true)
  })

  it('poke lowers mood but never below zero', () => {
    let g = core.computeGrowth(null, { type: 'poke' }, T0, 0).growth
    for (let i = 0; i < 20; i++) g = core.computeGrowth(g, { type: 'poke' }, T0, 0).growth
    expect(g.mood).toBe(0)
  })

  it('feed restores satiety and unlocks first-feed', () => {
    const out = core.computeGrowth({ satiety: 10 }, { type: 'feed' }, T0, 0)
    expect(out.growth.satiety).toBe(40)
    expect(out.unlocks.includes('first-feed')).toBe(true)
  })

  it('level rises at affinity 500 and unlocks lv5 at level 5', () => {
    const out = core.computeGrowth({ affinity: 1999 }, { type: 'praise' }, T0, 0)
    expect(out.growth.level).toBe(5)
    expect(out.unlocks.includes('lv5')).toBe(true)
  })

  it('signin streak increments across consecutive days', () => {
    const d1 = core.computeGrowth(null, { type: 'signin' }, T0, 0).growth
    expect(d1.signinStreak).toBe(1)
    const d2 = core.computeGrowth(d1, { type: 'signin' }, T0 + 86400000, 0).growth
    expect(d2.signinStreak).toBe(2)
    const d3 = core.computeGrowth(d2, { type: 'signin' }, T0 + 2 * 86400000, 0).growth
    expect(d3.signinStreak).toBe(3)
    expect(d3.achievements.includes('signin3')).toBe(true)
  })

  it('keyword matcher only works when enabled', () => {
    expect(core.matchKeyword('谢谢你！', true)).toBe('thanks')
    expect(core.matchKeyword('谢谢你！', false)).toBeNull()
    expect(core.matchKeyword('无关内容', true)).toBeNull()
  })

  it('dialogue bank meets the 480-line quota', () => {
    expect(core.dialogueCount()).toBeGreaterThanOrEqual(480)
  })

  it('pickDialogue rotates within the requested event', () => {
    for (const c of [0, 1, 2, 3]) {
      const line = core.pickDialogue('interact', 'pat', c, () => 0.2)
      expect(core.DIALOGUE.interact.pat.includes(line)).toBe(true)
    }
  })
})
