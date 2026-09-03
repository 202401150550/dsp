// ati-core · AI 社交桥
// 把 AtiOrchestrator 挂到 SocialNetwork 的 bot 节点上
// bot 收到消息 → 触发 ACI 思考 → 自动回复

import { LlmOperator, LlmConfig } from './llm.js'
import { ToolOperator, ActuatorOperator } from './operators.js'

export class AiSocialBridge {
  /**
   * @param {SocialNetwork} social
   * @param {AtiOrchestrator} aci
   * @param {Object} opts
   * @param {string} opts.botId — bot 在社交网络里的 userId（需先 join）
   * @param {LlmConfig} opts.llm — LLM 配置（可选，无则 mock）
   * @param {string} opts.systemPrompt — bot 的 system prompt
   */
  constructor(social, aci, {
    botId = 'ati-bot',
    llm = null,
    systemPrompt = '你是 ATI Core，一个嵌入在 DSH 开放世界拓扑中的智能体。简洁、务实、有洞察力地回复。',
  } = {}) {
    this.social = social
    this.aci = aci
    this.botId = botId
    this.llm = llm || new LlmConfig()
    this.systemPrompt = systemPrompt
    this._conversationHistory = new Map() // userId → [{role, content}]
    this._autoReplyEnabled = true
    this._replyCount = 0

    // 确保社交网络里有这个 bot 节点
    if (!social.graph.hasNode(botId)) {
      social.join(botId, { displayName: 'ATI Bot', isBot: true })
    }
  }

  /** 启动自动回复监听 */
  start() {
    // 监听社交网络的事件流
    const origEmit = this.social._emit.bind(this.social)
    this.social._emit = (kind, detail) => {
      origEmit(kind, detail)
      if (this._autoReplyEnabled && kind === 'message') {
        setImmediate(() => this._onMessage(detail).catch(() => {}))
      }
    }
    return this
  }

  stop() { this._autoReplyEnabled = false }

  async _onMessage({ from, to, body }) {
    if (to !== this.botId || !body) return
    try {
      await this.replyTo(from, body)
    } catch { /* silent */ }
  }

  /**
   * 手动触发：让 bot 回复某个用户
   * 内部走完整的 ACI think 循环
   */
  async replyTo(userId, message) {
    if (!this.social.isConnected(userId, this.botId)) {
      // 自动建立连接
      try { this.social.connect(userId, this.botId) } catch { /* already connected */ }
    }

    // 维护对话历史
    if (!this._conversationHistory.has(userId)) {
      this._conversationHistory.set(userId, [])
    }
    const history = this._conversationHistory.get(userId)
    history.push({ role: 'user', content: message })

    // 构造 ACI 蓝图：sensor(收消息) → nn(LLM思考) → actuator(发回复)
    const llmOp = new LlmOperator({
      llm: this.llm,
      systemPrompt: this.systemPrompt,
      history: history.slice(-6), // 最近6条上下文
      name: `ati-social-${this.botId}`,
    })

    this.aci.registerCapability('social-llm', 'nn', llmOp)

    const result = await this.aci.think(
      `social-reply-${userId}-${Date.now()}`,
      `回复 ${userId}: "${message.slice(0, 50)}"`,
      {
        nodes: [
          { id: 'input', type: 'sensor' },
          { id: 'brain', type: 'nn', capability: 'social-llm' },
          { id: 'send', type: 'actuator' },
        ],
        edges: [
          { from: 'input', to: 'brain' },
          { from: 'brain', to: 'send' },
        ],
      },
      message,
    )

    const reply = result.output || `[${result.status}] 我在想…`

    // 记录 assistant 回复到对话历史
    history.push({ role: 'assistant', content: reply })

    // 发回社交网络
    this.social.sendMessage(this.botId, userId, reply)
    this._replyCount++

    return { reply, result }
  }

  get conversationCount() { return this._conversationHistory.size }
  get totalReplies() { return this._replyCount }
}
