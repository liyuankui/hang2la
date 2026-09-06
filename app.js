import { TIERS, parseItems, buildPrompt, parseTierResult, toMarkdown } from './tier.js'
import { PROVIDERS, chat } from './llm.js'
import { fetchImageDataURL, imageUrl } from './image.js'

const $ = (id) => document.getElementById(id)
const els = ['topic', 'items', 'btn-demo', 'btn-manual', 'btn-ai', 'btn-settings', 'btn-img', 'btn-png', 'btn-md',
  'board-wrap', 'board', 'board-title', 'board-title-text', 'settings', 'set-provider', 'set-baseurl',
  'set-model', 'set-key', 'set-save', 'set-cancel', 'key-url', 'key-hint', 'toast', 'opt-analytics']
  .reduce((m, id) => ((m[id] = $(id)), m), {})

// ── PostHog 匿名统计(可关,关后零请求) ─────────────────────────
const POSTHOG_KEY = 'phc_AbKVVXPDZKThtUacCHhFOITuBczUvLmPStN1JAZs93e'
const POSTHOG_ENDPOINT = 'https://eu.i.posthog.com/capture/'
const PROJECT = 'hang2la'
const UID_KEY = PROJECT + '-uid'

let analyticsOn = localStorage.getItem('hang2la-analytics-off') !== '1'
function track(event, props = {}) {
  if (!analyticsOn) return
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return
  try {
    navigator.sendBeacon(POSTHOG_ENDPOINT, JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      timestamp: new Date().toISOString(),
      properties: {
        distinct_id: localStorage.getItem(UID_KEY) || 'unknown',
        project: PROJECT,
        url: location.pathname,
        page: 'index',
        ...props,
      },
    }))
  } catch {}
}
if (!localStorage.getItem(UID_KEY)) localStorage.setItem(UID_KEY, crypto.randomUUID().slice(0, 8))
track('page_view')

els['opt-analytics'].checked = analyticsOn
els['opt-analytics'].addEventListener('change', (e) => {
  analyticsOn = e.target.checked
  localStorage.setItem('hang2la-analytics-off', analyticsOn ? '0' : '1')
  if (analyticsOn) track('analytics_opt_in')
})

// ── 配置(key 只存本地) ─────────────────────────────────────────
const CONFIG_KEY = 'hang2la-config'
const defaultConfig = () => {
  const p = PROVIDERS[0]
  return { provider: p.id, baseUrl: p.baseUrl, model: p.model, apiKey: '' }
}
let config = { ...defaultConfig(), ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }

// ── 状态与渲染 ──────────────────────────────────────────────────
let state = { topic: '', results: [] } // results: [{name, tier(null=待分档), reason, emoji?, image?(URL), imageLoaded?}]

function renderBoard(onImageSettled) {
  const { topic, results } = state
  els['board-wrap'].hidden = false
  els['board-title'].textContent = topic ? `${topic} · 从夯到拉` : '从夯到拉'
  els['board-title-text'].textContent = els['board-title'].textContent

  const rows = [
    ...TIERS.map((t) => ({ id: t.id, label: t.label, slogan: t.slogan, colors: t.colors })),
    { id: 'inbox', label: '待分档', slogan: '拖我上去', colors: null },
  ]
  els['board'].replaceChildren()
  for (const row of rows) {
    const members = results.filter((r) => (row.id === 'inbox' ? r.tier === null : r.tier === row.id))
    const rowEl = document.createElement('div')
    rowEl.className = 'tier-row'
    rowEl.dataset.tier = row.id
    if (row.id === 'inbox') rowEl.id = 'inbox-row'

    const label = document.createElement('div')
    label.className = 'tier-label'
    if (row.colors) label.style.background = `linear-gradient(135deg, ${row.colors[0]}, ${row.colors[1]})`
    label.innerHTML = `<span class="zh"></span><span class="slogan"></span>`
    label.querySelector('.zh').textContent = row.label
    label.querySelector('.slogan').textContent = row.slogan

    const pool = document.createElement('div')
    pool.className = 'tier-pool'
    for (const m of members) {
      const chip = document.createElement('div')
      chip.className = 'chip'
      chip.draggable = true
      chip.dataset.name = m.name
      const name = document.createElement('div')
      name.className = 'name'
      if (m.image && !m.imageFailed && !m.imagePending) {
        const avatar = document.createElement('img')
        avatar.src = m.image
        avatar.alt = ''
        avatar.width = 22
        avatar.height = 22
        avatar.onload = () => {
          if (m.imageLoaded) return // 重建渲染的缓存命中,不重复计数
          m.imageLoaded = true
          onImageSettled?.(m, true)
        }
        avatar.onerror = () => {
          if (m.imageFailed) return
          m.imageFailed = true
          m.image = ''
          onImageSettled?.(m, false)
        }
        name.appendChild(avatar)
        name.appendChild(document.createTextNode(' '))
      }
      if (m.emoji) {
        const emoji = document.createElement('span')
        emoji.className = 'emoji'
        emoji.textContent = m.emoji + ' '
        name.appendChild(emoji)
      }
      name.appendChild(document.createTextNode(m.name))
      chip.appendChild(name)
      if (m.reason) {
        const reason = document.createElement('div')
        reason.className = 'reason'
        reason.textContent = m.reason
        chip.appendChild(reason)
      }
      pool.appendChild(chip)
    }
    rowEl.append(label, pool)
    els['board'].appendChild(rowEl)
  }
  // 待分档空且全部有档时,收起待分档行
  if (results.length && results.every((r) => r.tier !== null)) {
    els['board'].querySelector('#inbox-row')?.remove()
  }
}

// ── 拖拽微调 ────────────────────────────────────────────────────
els['board'].addEventListener('dragstart', (e) => {
  const chip = e.target.closest('.chip')
  if (!chip) return
  e.dataTransfer.setData('text/plain', chip.dataset.name)
  e.dataTransfer.effectAllowed = 'move'
})
els['board'].addEventListener('dragover', (e) => {
  const row = e.target.closest('.tier-row')
  if (!row) return
  e.preventDefault()
  row.classList.add('over')
})
els['board'].addEventListener('dragleave', (e) => {
  e.target.closest('.tier-row')?.classList.remove('over')
})
els['board'].addEventListener('drop', (e) => {
  const row = e.target.closest('.tier-row')
  if (!row) return
  e.preventDefault()
  row.classList.remove('over')
  const name = e.dataTransfer.getData('text/plain')
  const hit = state.results.find((r) => r.name === name)
  if (!hit) return
  const to = row.dataset.tier === 'inbox' ? null : row.dataset.tier
  if (hit.tier === to) return
  hit.tier = to
  renderBoard()
  track('tier_adjust', { to: to || 'inbox' })
})

// ── 三种开排方式 ────────────────────────────────────────────────
const DEMO = {
  topic: '编程语言(梗界口碑版)',
  items: 'Python\nJava\nGo\nRust\nJavaScript\nTypeScript\nC++\nPHP\nRuby\nKotlin\nSwift\nCOBOL',
}

function startManual(topic, items, via) {
  if (!items.length) return toast('先填条目,每行一个')
  const rawLines = els['items'].value.split('\n').filter((l) => l.trim()).length
  if (rawLines > items.length) toast(`条目超过 ${items.length} 个,已取前 ${items.length} 个`)
  state = { topic, results: items.map((name) => ({ name, tier: null, reason: '' })) }
  renderBoard()
  track(via)
}

els['btn-demo'].addEventListener('click', () => {
  els['topic'].value = DEMO.topic
  els['items'].value = DEMO.items
  startManual(DEMO.topic, parseItems(DEMO.items), 'demo_fill')
})

els['btn-manual'].addEventListener('click', () => {
  startManual(els['topic'].value.trim(), parseItems(els['items'].value), 'manual_start')
})

els['btn-ai'].addEventListener('click', async () => {
  const topic = els['topic'].value.trim() || '这个主题'
  const items = parseItems(els['items'].value)
  if (!items.length) return toast('先填条目,每行一个')
  const rawLines = els['items'].value.split('\n').filter((l) => l.trim()).length
  if (rawLines > items.length) toast(`条目超过 ${items.length} 个,已取前 ${items.length} 个`)
  if (!config.apiKey) {
    openSettings()
    return
  }
  const btn = els['btn-ai']
  btn.disabled = true
  btn.dataset.orig = btn.textContent
  btn.textContent = 'AI 拉扯中…'
  const t0 = Date.now()
  try {
    const content = await chat({ ...config, prompt: buildPrompt(topic, items) })
    state = { topic, results: parseTierResult(content, items) }
    renderBoard()
    track('tier_generate', { provider: config.provider, model: config.model, count: items.length, ms: Date.now() - t0, ok: true })
  } catch (e) {
    toast(`出错了:${e.message}`)
    track('tier_generate', { provider: config.provider, ok: false })
  } finally {
    btn.disabled = false
    btn.textContent = btn.dataset.orig
  }
})

// ── AI 配图(免费生图,受控队列:并发 2,失败自动重试 1 次) ──────
els['btn-img'].addEventListener('click', () => {
  const todo = state.results.filter((r) => !r.image)
  if (!todo.length) return toast('配图已齐,刷新页面可重新生成')
  const btn = els['btn-img']
  btn.disabled = true
  btn.dataset.orig = btn.textContent
  const total = todo.length
  const callbacks = new Map() // name → 该条本轮的 settle 回调
  let done = 0
  let fail = 0
  let inflight = 0
  const paint = () => (btn.textContent = `配图中 ${done + fail}/${total}…`)
  paint()

  const finishBatch = () => {
    btn.disabled = false
    btn.textContent = btn.dataset.orig
    track('image_generate', { ok: done, fail, total })
    toast(fail ? `配图完成,${fail} 张失败,可再点一次重试` : '配图完成 ✨')
  }

  const launchNext = () => {
    while (inflight < 1) {
      const r = todo.find((x) => !x.started)
      if (!r) {
        if (done + fail >= total) finishBatch()
        return
      }
      r.started = true
      r.imagePending = false
      r.imageFailed = false
      r.imageLoaded = false
      r.image = imageUrl(state.topic || 'tier list', r.name)
      inflight++
      callbacks.set(r.name, (row, ok) => {
        if (!ok && !row.retried) {
          row.retried = true
          row.image = ''
          row.started = false
          setTimeout(() => {
            inflight--
            launchNext()
          }, 3000)
          return
        }
        callbacks.delete(row.name)
        inflight--
        ok ? done++ : fail++
        paint()
        setTimeout(launchNext, ok ? 600 : 3000) // 节流:给免费限流窗口留呼吸
      })
      renderBoard((row, ok) => callbacks.get(row.name)?.(row, ok))
    }
  }

  for (const r of todo) {
    r.image = ''
    r.imagePending = true
    r.imageFailed = false
    r.imageLoaded = false
    r.started = false
    r.retried = false
  }
  launchNext()
})

// ── 导出 PNG(SVG foreignObject,零依赖) ─────────────────────────
els['btn-png'].addEventListener('click', async () => {
  const btn = els['btn-png']
  btn.disabled = true
  btn.dataset.orig = btn.textContent
  btn.textContent = '导出中…'
  try {
    await exportPNG()
  } finally {
    btn.disabled = false
    btn.textContent = btn.dataset.orig
  }
})

async function exportPNG() {
  const node = $('export-root')
  const W = node.offsetWidth
  const H = node.scrollHeight
  const css = await (await fetch('style.css')).text()
  const clone = node.cloneNode(true)
  // 外域图片进 SVG 会裂:已加载的转 dataURL,未就绪的剔除
  for (const chipEl of clone.querySelectorAll('.chip')) {
    const r = state.results.find((x) => x.name === chipEl.dataset.name)
    const img = chipEl.querySelector('img')
    if (!img) continue
    if (r?.image && r.imageLoaded) {
      try {
        img.src = await fetchImageDataURL(r.image, 20000)
        continue
      } catch {}
    }
    img.remove()
  }
  const wrap = document.createElement('div')
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  wrap.style.cssText = `width:${W}px;background:#fff;border-radius:16px;overflow:hidden`
  wrap.appendChild(clone)
  const style = document.createElement('style')
  style.textContent = css + '\n#export-root{box-shadow:none;margin:0}.chip{cursor:default}'
  wrap.insertBefore(style, clone)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(wrap)}</foreignObject></svg>`
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  try {
    await img.decode()
  } catch {
    return toast('这张图浏览器渲染不出来,试试 Chrome / Safari 最新版')
  }
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#faf7f2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  canvas.toBlob((blob) => {
    if (!blob) return toast('导出失败,截图也行')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${state.topic || '从夯到拉'}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  })
  track('png_export')
}

// ── 复制 Markdown 文案 ──────────────────────────────────────────
els['btn-md'].addEventListener('click', async () => {
  const md = toMarkdown(state.topic, state.results)
  try {
    await navigator.clipboard.writeText(md)
    toast('文案已复制,去发帖吧')
  } catch {
    toast('复制失败,手动长按选中吧')
  }
  track('md_copy')
})

// ── 设置弹窗 ────────────────────────────────────────────────────
function fillProviderForm(p) {
  els['set-baseurl'].value = p.baseUrl
  els['set-model'].value = p.model
  els['key-url'].textContent = p.keyUrl || ''
  els['key-url'].href = p.keyUrl || '#'
  els['key-hint'].style.display = p.keyUrl ? '' : 'none'
}
function openSettings() {
  els['set-provider'].replaceChildren(
    ...PROVIDERS.map((p) => new Option(p.label, p.id, false, p.id === config.provider)),
  )
  const cur = PROVIDERS.find((p) => p.id === config.provider)
  if (cur && cur.id !== 'custom') fillProviderForm(cur)
  els['set-baseurl'].value = config.baseUrl
  els['set-model'].value = config.model
  els['set-key'].value = config.apiKey
  els['settings'].showModal()
}
els['btn-settings'].addEventListener('click', openSettings)
els['set-provider'].addEventListener('change', (e) => {
  const p = PROVIDERS.find((x) => x.id === e.target.value)
  if (p) fillProviderForm(p)
})
els['set-cancel'].addEventListener('click', () => els['settings'].close())
els['set-save'].addEventListener('click', () => {
  config = {
    provider: els['set-provider'].value,
    baseUrl: els['set-baseurl'].value.trim(),
    model: els['set-model'].value.trim(),
    apiKey: els['set-key'].value.trim(),
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  els['settings'].close()
  toast('设置已存进本浏览器')
  track('settings_save', { provider: config.provider })
})

// ── toast ───────────────────────────────────────────────────────
let toastTimer
function toast(msg) {
  els['toast'].textContent = msg
  els['toast'].classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => els['toast'].classList.remove('show'), 2600)
}
