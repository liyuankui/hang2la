import { describe, expect, test } from 'bun:test'
import { buildImagePrompt, seedOf, imageUrl } from './image.js'

describe('image prompt/url 构造', () => {
  test('prompt 含条目与主题,且禁止文字水印', () => {
    const p = buildImagePrompt('编程语言', 'Go')
    expect(p).toContain('Go')
    expect(p).toContain('编程语言')
    expect(p).toContain('no text')
    expect(p).toContain('no watermark')
  })
  test('seed 同名稳定、异名大概率不同', () => {
    expect(seedOf('Go')).toBe(seedOf('Go'))
    expect(seedOf('Go')).not.toBe(seedOf('Rust'))
  })
  test('url 正确编码并带尺寸与 seed', () => {
    const url = imageUrl('奶茶', '喜 茶', 128)
    expect(url).toContain('https://image.pollinations.ai/prompt/')
    expect(url).toContain('width=128&height=128')
    expect(url).toContain('nologo=true')
    expect(url).toContain(`seed=${seedOf('喜 茶')}`)
    expect(decodeURIComponent(url.split('/prompt/')[1].split('?')[0])).toContain('喜 茶')
  })
})
