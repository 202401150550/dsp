// ati-core · LLM 接入层
// OpenAI 兼容 API（DeepSeek / OpenAI / yunnet / 任何兼容端点）
// 无 API key 时自动降级为 echo mock

import { NnOperator } from './operators.js'

const DEFAULT_BASE = 'https://api.deepseek.com/v1'

export class LlmConfig {
  constructor({
    baseUrl = process.env.OPENAI_BASE_URL || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE,
    apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    model = process.env.ATI_LLM_MODEL || 'deepseek-chat',
    temperature = 0.7,
    maxTokens = 1024,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.apiKey = apiKey
    this.model = model
    this.temperature = temperature
    this.maxTokens = maxTokens
  }

  get available() { return !!this.apiKey }
}

/**
 * 真实 LLM 推理算子
 * config.model 被替换为实际的 HTTP 调用
 */
export class LlmOperator extends NnOperator {
  /**
   * @param {Object} config
   * @param {LlmConfig} config.llm — LLM 配置
   * @param {string} config.systemPrompt — system 消息
   * @param {Array<{role,content}>} config.history — 额外上下文消息
   * @param {string} config.name — 显示名
   */
  constructor(config = {}) {
    const llm = config.llm || new LlmConfig()
    super({
      ...config,
      model: llm.available ? _makeLlmFn(llm, config) : _makeMockFn(config),
    })
    this.llmConfig = llm
  }
}

function _makeLlmFn(llm, operatorConfig) {
  return async (input) => {
    const messages = []
    if (operatorConfig.systemPrompt) {
      messages.push({ role: 'system', content: operatorConfig.systemPrompt })
    }
    if (Array.isArray(operatorConfig.history)) {
      messages.push(...operatorConfig.history)
    }
    // input 可以是 string 或 {messages: [...]}
    if (typeof input === 'string') {
      messages.push({ role: 'user', content: input })
    } else if (input && Array.isArray(input.messages)) {
      messages.push(...input.messages)
    } else if (input != null) {
      messages.push({ role: 'user', content: JSON.stringify(input) })
    }

    const res = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages,
        temperature: llm.temperature,
        max_tokens: llm.maxTokens,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? ''
  }
}

function _makeMockFn(operatorConfig) {
  const prefix = `[MOCK:${operatorConfig.llm?.model || 'no-key'}]`
  return async (input) => {
    const text = typeof input === 'string' ? input : JSON.stringify(input)
    // 简单的"智能" mock：反转字符串模拟处理
    const processed = text.split('').reverse().join('')
    return `${prefix} ${processed}`
  }
}

/** 从 SocialNetwork 的消息格式构造 LLM 输入 */
export function socialMessageToLlmInput(msg, context = []) {
  return {
    messages: [
      ...context.map((c) => ({ role: c.role || 'user', content: c.content })),
      { role: 'user', content: msg.body },
    ],
  }
}
