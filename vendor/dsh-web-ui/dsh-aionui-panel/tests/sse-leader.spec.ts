// @vitest-environment jsdom
/**
 * sse-leader relay tests (issue #383): one EventSource per URL browser-wide,
 * events fanned out through the broadcast channel, leadership handover when
 * the leading tab tears down, and the degraded plain-EventSource fallback
 * when the cross-tab machinery is missing. Each "tab" is a fresh module
 * instance (vi.resetModules) sharing the fake lock manager and buses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Fake EventSource: records instances and lets the test push events. */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  closed = false
  private handlers = new Map<string, Array<(raw: unknown) => void>>()
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener(name: string, handler: (raw: unknown) => void): void {
    const list = this.handlers.get(name) ?? []
    list.push(handler)
    this.handlers.set(name, list)
  }
  emit(name: string, data: string): void {
    for (const handler of this.handlers.get(name) ?? []) handler({ data })
  }
  close(): void {
    this.closed = true
  }
}

/** Fake BroadcastChannel: a shared bus per name, no echo to the poster. */
class FakeChannel {
  static buses = new Map<string, Set<FakeChannel>>()
  name: string
  private listeners: Array<(raw: unknown) => void> = []
  constructor(name: string) {
    this.name = name
    const bus = FakeChannel.buses.get(name) ?? new Set<FakeChannel>()
    bus.add(this)
    FakeChannel.buses.set(name, bus)
  }
  addEventListener(_name: string, handler: (raw: unknown) => void): void {
    this.listeners.push(handler)
  }
  postMessage(data: string): void {
    for (const peer of FakeChannel.buses.get(this.name) ?? []) {
      if (peer !== this) for (const handler of peer.listeners) handler({ data })
    }
  }
  close(): void {
    FakeChannel.buses.get(this.name)?.delete(this)
  }
}

/** Fake LockManager: exclusive per name, queued grants, abortable candidacy. */
class FakeLocks {
  private held = new Set<string>()
  private queues = new Map<string, Array<() => void>>()
  async request(name: string, options: { signal?: AbortSignal }, callback: () => Promise<void>): Promise<void> {
    if (this.held.has(name)) {
      await new Promise<void>((resolve, reject) => {
        const grant = (): void => { resolve() }
        const queue = this.queues.get(name) ?? []
        queue.push(grant)
        this.queues.set(name, queue)
        options.signal?.addEventListener('abort', () => {
          const pending = this.queues.get(name) ?? []
          const index = pending.indexOf(grant)
          if (index >= 0) pending.splice(index, 1)
          reject(new DOMException('aborted', 'AbortError'))
        }, { once: true })
      })
    }
    this.held.add(name)
    try {
      await callback()
    } finally {
      this.held.delete(name)
      const queue = this.queues.get(name) ?? []
      queue.shift()?.()
    }
  }
}

type Relay = typeof import('../src/client/sse-leader.ts')

const seams = (locks: FakeLocks) => ({
  eventSource: FakeEventSource as unknown as typeof EventSource,
  broadcastChannel: FakeChannel as unknown as typeof BroadcastChannel,
  locks: locks as unknown as LockManager,
})

/** A fresh "tab": its own module instance with an empty relay registry. */
async function openTab(): Promise<Relay> {
  vi.resetModules()
  return import('../src/client/sse-leader.ts')
}

afterEach(() => {
  FakeEventSource.instances = []
  FakeChannel.buses = new Map()
})

describe('subscribeSharedEvents', () => {
  it('shares one stream across tabs and fans events out to every listener', async () => {
    const locks = new FakeLocks()
    const tabA = await openTab()
    const tabB = await openTab()
    const eventsA: string[] = []
    const eventsB: string[] = []
    tabA.subscribeSharedEvents('/x/events?root=/p', 'change', data => { eventsA.push(data) }, seams(locks))
    tabB.subscribeSharedEvents('/x/events?root=/p', 'change', data => { eventsB.push(data) }, seams(locks))
    // Tab A leads immediately; tab B's candidacy queues behind the held lock.
    await vi.waitFor(() => { expect(FakeEventSource.instances).toHaveLength(1) })
    FakeEventSource.instances[0].emit('change', '{"kind":"fs"}')
    expect(eventsA).toEqual(['{"kind":"fs"}'])
    expect(eventsB).toEqual(['{"kind":"fs"}'])
  })

  it('promotes a waiting tab when the leader tears down', async () => {
    const locks = new FakeLocks()
    const tabA = await openTab()
    const tabB = await openTab()
    const eventsB: string[] = []
    const disposeA = tabA.subscribeSharedEvents('/x/events?root=/p', 'change', () => {}, seams(locks))
    tabB.subscribeSharedEvents('/x/events?root=/p', 'change', data => { eventsB.push(data) }, seams(locks))
    await vi.waitFor(() => { expect(FakeEventSource.instances).toHaveLength(1) })
    // The leader's tab closes (its last listener unsubscribes): the queued
    // candidacy is granted and the follower opens the browser-wide stream.
    disposeA()
    await vi.waitFor(() => { expect(FakeEventSource.instances).toHaveLength(2) })
    expect(FakeEventSource.instances[0].closed).toBe(true)
    FakeEventSource.instances[1].emit('change', 'next')
    expect(eventsB).toEqual(['next'])
  })

  it('closes the stream when the last local listener unsubscribes', async () => {
    const tab = await openTab()
    const dispose = tab.subscribeSharedEvents('/x/events', 'change', () => {}, seams(new FakeLocks()))
    await vi.waitFor(() => { expect(FakeEventSource.instances).toHaveLength(1) })
    dispose()
    expect(FakeEventSource.instances[0].closed).toBe(true)
  })

  it('degrades to a plain per-subscription EventSource without the machinery', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const tab = await openTab()
    const events: string[] = []
    const dispose = tab.subscribeSharedEvents('/x/events', 'change', data => { events.push(data) }, {
      eventSource: FakeEventSource as unknown as typeof EventSource,
    })
    expect(FakeEventSource.instances).toHaveLength(1)
    FakeEventSource.instances[0].emit('change', 'plain')
    expect(events).toEqual(['plain'])
    dispose()
    expect(FakeEventSource.instances[0].closed).toBe(true)
    vi.unstubAllGlobals()
  })
})
