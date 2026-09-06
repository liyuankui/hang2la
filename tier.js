// tier.js — 档位定义与纯逻辑,无 DOM 依赖(浏览器与测试共用)

export const TIERS = [
  { id: 'hang',  label: '夯',     en: 'GOATED',  slogan: '强到无需多言', enSlogan: 'needs no intro',    colors: ['#ff4d4f', '#ffa940'] },
  { id: 'top',   label: '顶级',   en: 'S-TIER',  slogan: '标杆水平',     enSlogan: 'the benchmark',     colors: ['#a855f7', '#6366f1'] },
  { id: 'elite', label: '人上人', en: 'A-TIER',  slogan: '性价比之选',   enSlogan: 'great value',       colors: ['#0ea5e9', '#22d3ee'] },
  { id: 'npc',   label: 'NPC',    en: 'NPC',     slogan: '查无此人',     enSlogan: 'background extra',  colors: ['#94a3b8', '#cbd5e1'] },
  { id: 'la',    label: '拉完了', en: 'TRASHED', slogan: '地板砖',       enSlogan: 'rock bottom',       colors: ['#78716c', '#a8a29e'] },
]

export const tierLabel = (t, lang) => (lang === 'en' ? t.en : t.label)

export const MAX_ITEMS = 30

const TIER_ALIASES = {
  hang: ['夯', 'hang', 's', 's+', '神', '天花板', 't0', 'goated', 'goat'],
  top: ['顶级', 'top', 'a', '标杆', 't1', 's-tier', 'stier', 'a-tier', 'atier'],
  elite: ['人上人', 'elite', 'b', '优秀', 't2', 'solid'],
  npc: ['npc', 'c', '中庸', '平庸', 't3'],
  la: ['拉完了', '拉', 'la', 'l', 'f', '拉胯', '垫底', '拉闸', 't4', 'trashed', 'flop'],
}

// 文本 → 条目数组:按行拆、去序号、去重、限量
export function parseItems(text, max = MAX_ITEMS) {
  if (typeof text !== 'string') return []
  const seen = new Set()
  const items = []
  for (const raw of text.split('\n')) {
    const name = raw
      .replace(/^\s*[\d一二三四五六七八九十]+[.、)．]\s*/, '') // 剥 "1. " "一、"
      .replace(/^[-*•\s]+/, '')
      .replace(/\s+$/, '')
      .slice(0, 40)
    if (!name) continue
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    items.push(name)
    if (items.length >= max) break
  }
  return items
}

// 任意档位写法 → 标准 id;认不出返回 null
export function normalizeTier(t) {
  if (t == null) return null
  const key = String(t).trim().toLowerCase()
  for (const [id, aliases] of Object.entries(TIER_ALIASES)) {
    if (id === key || aliases.some((a) => a.toLowerCase() === key)) return id
  }
  return null
}

// LLM 原始输出 → JSON:剥 code fence、截取最外层括号、解析
export function extractJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('模型返回为空')
  let s = raw.replace(/```(?:json)?/gi, '').trim()
  const first = Math.min(
    ...[s.indexOf('['), s.indexOf('{')].filter((i) => i >= 0),
  )
  if (!Number.isFinite(first)) throw new Error('返回中没有 JSON 结构')
  const open = s[first]
  const close = open === '[' ? ']' : '}'
  const last = s.lastIndexOf(close)
  if (last <= first) throw new Error('JSON 结构不完整')
  s = s.slice(first, last + 1)
  try {
    return JSON.parse(s)
  } catch {
    return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')) // 容忍尾逗号
  }
}

// 对账:AI 结果对齐回原始条目,漏评的进 NPC 区
export function parseTierResult(raw, items) {
  const data = extractJson(raw)
  const rows = Array.isArray(data) ? data : data.results ?? data.tiers ?? data.items ?? data.rank
  if (!Array.isArray(rows)) throw new Error('JSON 里没有结果数组')

  const byName = new Map()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const name = String(row.name ?? row.item ?? row.term ?? '').trim()
    if (!name) continue
    byName.set(name.toLowerCase(), row)
  }

  const match = (item) =>
    byName.get(item.toLowerCase()) ??
    // LLM 偶尔改名:退而求其次做包含匹配
    [...byName.entries()].find(([k]) => k.includes(item.toLowerCase()) || item.toLowerCase().includes(k))?.[1]

  return items.map((item) => {
    const row = match(item)
    const tier = normalizeTier(row?.tier ?? row?.level ?? row?.rank) ?? 'npc'
    const reason = String(row?.reason ?? row?.comment ?? '').trim().slice(0, 60)
    const emoji = String(row?.emoji ?? '').trim().slice(0, 8).replace(/^['"]|['"]$/g, '')
    return { name: item, tier, reason, emoji: /^\p{Extended_Pictographic}/u.test(emoji) ? emoji : '' }
  })
}

const PROMPTS = {
  zh: (topic, items, labels) => `你是中文互联网梗文化的排榜专家。请把以下条目分入五档:${labels}。
主题:${topic}
条目:${items.join('、')}

规则:
1. 每个条目必须且只能进一档,不许遗漏
2. 「夯」最强,「拉完了」最差,按大众口碑与你的判断排
3. 每条给一句不超过 20 字的毒舌点评,幽默但别刻薄到人身攻击
4. 每条配一个最贴合的 emoji(单个,别用组合表情)
5. 只输出 JSON,格式:{"results":[{"name":"条目","tier":"档位(${labels})","reason":"点评","emoji":"🚀"}]}`,
  en: (topic, items, labels) => `You are a meme-culture tier list expert. Sort these items into five tiers: ${labels}.
Topic: ${topic}
Items: ${items.join(', ')}

Rules:
1. Every item goes into exactly one tier, no omissions
2. GOATED is best, TRASHED is worst; rank by mainstream reputation and your judgment
3. Give each item one snarky comment under 15 words, funny but no personal attacks
4. Give each item one fitting emoji (single, no combos)
5. Output JSON only: {"results":[{"name":"item","tier":"tier (${labels})","reason":"comment","emoji":"🚀"}]}`,
}

export function buildPrompt(topic, items, lang = 'zh') {
  const labels = TIERS.map((t) => (lang === 'en' ? t.en : t.label)).join('/')
  return PROMPTS[lang](topic, items, labels)
}

// AI 补条目:主题 → N 个条目
export function buildItemsPrompt(topic, count, lang = 'zh') {
  if (lang === 'en') {
    return `Brainstorm ${count} most representative, recognizable items about "${topic}" for a tier list ranking. Each item MUST be a rankable entity of the same kind as the topic (a brand / product / person / work etc.) — NOT phenomena, behaviors, memes or events. Be specific, no duplicates. IMPORTANT: you MUST return exactly ${count} items, count carefully. Output JSON only: {"items":["item1","item2",...]}`
  }
  return `围绕主题「${topic}」头脑风暴出 ${count} 个最具代表性、有辨识度的排榜条目。每个条目必须是同一类型的可排名实体(品牌/产品/人物/作品等),不要列现象、行为、营销事件或梗。要具体,不重复。注意:必须正好列出 ${count} 个,数清楚再输出。只输出 JSON:{"items":["条目1","条目2",...]}`
}

// 数量不足时的补齐轮
export function buildMoreItemsPrompt(topic, need, existing, lang = 'zh') {
  if (lang === 'en') {
    return `About "${topic}", we already have these items: ${existing.join(', ')}. List exactly ${need} MORE distinct rankable entities of the same kind (no phenomena/memes/events, no repeats of existing ones). Count carefully, output exactly ${need}. JSON only: {"items":[...]}`
  }
  return `关于主题「${topic}」,已有条目:${existing.join('、')}。请再补充正好 ${need} 个不重复的新条目,必须是与主题同类的可排名实体(不要现象/梗/事件,也不要与已有的重复),数清楚数量。只输出 JSON:{"items":[...]}`
}

export function parseItemsResponse(raw, count) {
  const data = extractJson(raw)
  const list = Array.isArray(data) ? data : data.items
  if (!Array.isArray(list)) throw new Error('JSON 里没有条目数组')
  return list.map((s) => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, count)
}

// 榜单 → Markdown 分享文本
export function toMarkdown(topic, results, lang = 'zh') {
  const title = lang === 'en' ? `${topic} · Tier List` : `${topic} · 从夯到拉`
  const lines = [`# ${title}`, '']
  for (const t of TIERS) {
    const rows = results.filter((r) => r.tier === t.id)
    if (!rows.length) continue
    lines.push(`## ${tierLabel(t, lang)}`, '')
    for (const r of rows) lines.push(`- **${r.emoji ? `${r.emoji} ` : ''}${r.name}**${r.reason ? ` — ${r.reason}` : ''}`)
    lines.push('')
  }
  lines.push(lang === 'en' ? '> Made with hang2la' : '> 由 hang2la 智能生成')
  return lines.join('\n')
}
