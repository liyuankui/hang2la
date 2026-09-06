import { describe, expect, test } from 'bun:test'
import {
  parseItems,
  normalizeTier,
  extractJson,
  parseTierResult,
  buildPrompt,
  toMarkdown,
  TIERS,
} from './tier.js'

describe('parseItems', () => {
  test('按行拆分并去空', () => {
    expect(parseItems('Java\n\n  Go  \nRust')).toEqual(['Java', 'Go', 'Rust'])
  })
  test('剥序号前缀', () => {
    expect(parseItems('1. 奶茶\n二、咖啡\n- 柠檬水')).toEqual(['奶茶', '咖啡', '柠檬水'])
  })
  test('去重(忽略大小写)', () => {
    expect(parseItems('Python\npython\nPYTHON')).toEqual(['Python'])
  })
  test('限量与超长截断', () => {
    expect(parseItems(Array.from({ length: 40 }, (_, i) => `item${i}`).join('\n'), 30)).toHaveLength(30)
    expect(parseItems('a'.repeat(99))[0]).toHaveLength(40)
  })
  test('非字符串与空串', () => {
    expect(parseItems(null)).toEqual([])
    expect(parseItems('   \n  ')).toEqual([])
  })
})

describe('normalizeTier', () => {
  test('中文/英文/别名/大小写归一', () => {
    expect(normalizeTier('夯')).toBe('hang')
    expect(normalizeTier('S')).toBe('hang')
    expect(normalizeTier('top')).toBe('top')
    expect(normalizeTier('人上人')).toBe('elite')
    expect(normalizeTier('NPC')).toBe('npc')
    expect(normalizeTier('拉胯')).toBe('la')
    expect(normalizeTier('F')).toBe('la')
  })
  test('认不出返回 null', () => {
    expect(normalizeTier('不存在的档')).toBeNull()
    expect(normalizeTier(null)).toBeNull()
  })
})

describe('extractJson', () => {
  test('纯 JSON', () => {
    expect(extractJson('{"results":[]}')).toEqual({ results: [] })
  })
  test('code fence 包裹', () => {
    expect(extractJson('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }])
  })
  test('前后混入解说文字', () => {
    expect(extractJson('好的,这是结果:{"results":[{"name":"x"}]} 希望有帮助')).toEqual({
      results: [{ name: 'x' }],
    })
  })
  test('尾逗号容错', () => {
    expect(extractJson('[{"a":1},]')).toEqual([{ a: 1 }])
    expect(extractJson('{"results":[{"a":1},],}')).toEqual({ results: [{ a: 1 }] })
  })
  test('坏输入抛错', () => {
    expect(() => extractJson('')).toThrow()
    expect(() => extractJson('没有任何结构')).toThrow()
    expect(() => extractJson('{"a": [1,')).toThrow()
  })
})

describe('parseTierResult', () => {
  const items = ['Java', 'Go', 'Rust', 'PHP']
  test('标准 results 数组', () => {
    const raw = JSON.stringify({
      results: [
        { name: 'Java', tier: '顶级', reason: '饭碗之神' },
        { name: 'Go', tier: '夯', reason: '云原生扛把子' },
        { name: 'Rust', tier: '人上人', reason: '学不动' },
      ],
    })
    const out = parseTierResult(raw, items)
    expect(out.find((r) => r.name === 'Go').tier).toBe('hang')
    expect(out.find((r) => r.name === 'Java').tier).toBe('top')
  })
  test('漏评条目落 NPC,改名可对齐', () => {
    const raw = JSON.stringify({
      results: [
        { item: 'Java 语言', level: 'S' },
        { term: 'PHP', rank: '拉完了', comment: '最好的语言' },
      ],
    })
    const out = parseTierResult(raw, items)
    expect(out.find((r) => r.name === 'Java').tier).toBe('hang')
    expect(out.find((r) => r.name === 'PHP').tier).toBe('la')
    expect(out.find((r) => r.name === 'Rust').tier).toBe('npc')
  })
  test('认不出的档位落 NPC', () => {
    const raw = JSON.stringify({ results: [{ name: 'Go', tier: '??' }] })
    expect(parseTierResult(raw, ['Go'])[0].tier).toBe('npc')
  })
  test('没有数组结构抛错', () => {
    expect(() => parseTierResult('{"foo": 1}', items)).toThrow()
  })
})

describe('buildPrompt / toMarkdown', () => {
  test('prompt 含主题、条目与五档', () => {
    const p = buildPrompt('编程语言', ['Go', 'Rust'])
    expect(p).toContain('编程语言')
    expect(p).toContain('Go、Rust')
    for (const t of TIERS) expect(p).toContain(t.label)
  })
  test('markdown 分档输出且带来源', () => {
    const md = toMarkdown('奶茶', [
      { name: '喜茶', tier: 'hang', reason: '永远的神' },
      { name: '香飘飘', tier: 'la', reason: '杯装回忆' },
    ])
    expect(md).toContain('# 奶茶 · 从夯到拉')
    expect(md).toContain('**喜茶** — 永远的神')
    expect(md).toContain('香飘飘')
    expect(md).toContain('hang2la')
  })
})
