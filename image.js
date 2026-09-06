// image.js — AI 配图:Pollinations 免费生图,无 key,fetch 转 dataURL 供导出

const ENDPOINT = 'https://image.pollinations.ai/prompt/'

export function buildImagePrompt(topic, name) {
  return `minimal flat vector icon of ${name}, ${topic} theme, single object, centered, vibrant pastel background, clean edges, no text, no letters, no watermark`
}

// 稳定 seed:同名同图,重生成不跳变
export function seedOf(name) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return h % 100000
}

export function imageUrl(topic, name, size = 128) {
  const prompt = encodeURIComponent(buildImagePrompt(topic, name))
  return `${ENDPOINT}${prompt}?width=${size}&height=${size}&nologo=true&seed=${seedOf(name)}`
}

// 拉一张图 → dataURL(仅导出时用;URL 同 seed 已生成过会命中缓存,秒回)
// data 协议在 SVG 导出里安全,不污染 canvas
export async function fetchImageDataURL(url, timeoutMs = 20000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`生图 ${res.status}`)
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) throw new Error('返回的不是图片')
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(blob)
    })
  } finally {
    clearTimeout(timer)
  }
}
