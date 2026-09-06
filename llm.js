// llm.js — 供应商适配:全部走 OpenAI 兼容 /chat/completions,key 只存浏览器 localStorage

export const PROVIDERS = [
  {
    id: 'openrouter',
    label: 'OpenRouter(有免费模型)',
    enLabel: 'OpenRouter (free models)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-31b-it:free',
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'zhipu',
    label: '智谱 BigModel(GLM-4-Flash 免费档)',
    enLabel: 'Zhipu BigModel (GLM-4-Flash free)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    enLabel: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    enLabel: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'custom',
    label: '自定义(OpenAI 兼容)',
    enLabel: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    model: '',
    keyUrl: '',
  },
]

// 拉取 OpenRouter 当前可用的免费模型(公开接口,无需 key)
export async function fetchFreeModels(baseUrl) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`)
  if (!res.ok) throw new Error(`拉模型列表失败 ${res.status}`)
  const data = await res.json()
  return (data?.data ?? [])
    .map((m) => m.id)
    .filter((id) => id.endsWith(':free'))
    .sort()
}

async function post(url, body, apiKey) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`API ${res.status}:${detail.slice(0, 200)}`)
  }
  return res.json()
}

// 发一次分级请求。先带 response_format,服务端不认就去掉重试
export async function chat({ baseUrl, apiKey, model, prompt, signal }) {
  if (!baseUrl || !apiKey || !model) throw new Error('先在设置里填好供应商、模型与 API Key')
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const base = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  }
  let data
  try {
    data = await post(url, { ...base, response_format: { type: 'json_object' } }, apiKey, signal)
  } catch (e) {
    if (!/response_format|json_object/i.test(e.message)) throw e
    data = await post(url, base, apiKey, signal)
  }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('模型没有返回内容')
  return content
}
