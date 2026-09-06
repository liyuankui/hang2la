import { TIERS, tierLabel, parseItems, buildPrompt, buildItemsPrompt, parseItemsResponse, parseTierResult, toMarkdown } from './tier.js'
import { PROVIDERS, chat, fetchFreeModels } from './llm.js'
import { fetchImageDataURL, imageUrl } from './image.js'

const $ = (id) => document.getElementById(id)
const els = ['topic', 'items', 'gen-count', 'btn-gen-items', 'btn-demo', 'btn-manual', 'btn-ai', 'btn-settings',
  'btn-lang', 'btn-img', 'btn-png', 'btn-md', 'board-wrap', 'board', 'board-title', 'board-title-text',
  'settings', 'set-provider', 'set-baseurl', 'set-model', 'set-key', 'set-save', 'set-cancel', 'key-url',
  'key-hint', 'toast', 'opt-analytics', 'btn-fetch-models', 'free-models', 'free-models-hint']
  .reduce((m, id) => ((m[id] = $(id)), m), {})

// ── i18n ────────────────────────────────────────────────────────
const I18N = {
  zh: {
    badge: 'AI 排榜', settings: '⚙ 设置', tagline: 'AI 帮你排,拖拽随你改 · 夯 / 顶级 / 人上人 / NPC / 拉完了',
    topic_ph: '排什么?如:编程语言 / 奶茶品牌 / 羽毛球拍', items_ph: '每行一个条目,最多 30 个\nJava\nGo\nRust',
    gen_label: '没条目?让 AI 想', gen_unit: '个', gen_btn: '✨ AI 列条目',
    demo: '试个示例', manual: '手动开排', ai_btn: '🔥 智能分档',
    img_btn: '🎨 AI 配图', export_png: '导出 PNG', copy_md: '复制文案',
    board_hint: '卡片可拖到别的档位,不满意随时改', export_foot: '从夯到拉',
    privacy: 'API Key 仅存本地浏览器', analytics: '匿名统计',
    settings_title: 'AI 设置', key_hint: '没有 Key?先去领一个免费的:', provider: '供应商',
    base_url: 'Base URL', model: '模型', api_key: 'API Key', key_ph: '只存本浏览器',
    settings_privacy: 'Key 只存在你浏览器的 localStorage,请求只发往你选的供应商。OpenRouter / 智谱 GLM-4-Flash 均有免费额度。',
    cancel: '取消', save: '保存', refresh: '刷新',
    inbox: '待分档', inbox_slogan: '拖我上去', board_suffix: '从夯到拉',
    need_topic: '先填个主题', need_items: '先填条目,每行一个', need_key: '填个 API Key 才能智能分档(有免费款)',
    truncated: (n) => `条目超过 ${n} 个,已取前 ${n} 个`, ai_loading: 'AI 拉扯中…',
    ai_429: '免费模型限流了,去 ⚙ 设置换个免费模型再试',
    gen_loading: 'AI 开脑洞中…', gen_ok: (n) => `已填入 ${n} 个条目,可再编辑`, gen_fail: (e) => `列条目失败:${e}`,
    img_done: '配图完成 ✨', img_partial: (n) => `配图完成,${n} 张失败,可再点一次重试`,
    img_busy: (a, b) => `配图中 ${a}/${b}…`, img_all: '配图已齐,刷新页面可重新生成',
    png_loading: '导出中…', png_fail: '导出失败,截图也行', png_browser: '这张图浏览器渲染不出来,试试 Chrome / Safari 最新版',
    md_copied: '文案已复制,去发帖吧', md_fail: '复制失败,手动长按选中吧',
    settings_saved: '设置已存进本浏览器', need_topic_gen: '先填主题,AI 才知道列什么',
    models_ok: (n) => `${n} 个免费模型,点输入框即可选择`, models_loading: '拉取免费模型列表…',
    models_empty: '没拉到列表,可手填模型名',
  },
  en: {
    badge: 'AI Tier List', settings: '⚙ Settings', tagline: 'AI sorts it, you drag it — GOATED / S-TIER / A-TIER / NPC / TRASHED',
    topic_ph: 'What are we ranking? e.g. programming languages / milk tea brands', items_ph: 'One item per line, up to 30\nJava\nGo\nRust',
    gen_label: 'No items? Let AI think of', gen_unit: '', gen_btn: '✨ AI list items',
    demo: 'Try a demo', manual: 'Rank manually', ai_btn: '🔥 AI Tier It',
    img_btn: '🎨 AI Icons', export_png: 'Export PNG', copy_md: 'Copy Text',
    board_hint: 'Drag cards between tiers anytime', export_foot: 'Hang to La',
    privacy: 'API key stays in your browser', analytics: 'Anonymous stats',
    settings_title: 'AI Settings', key_hint: 'No key yet? Grab a free one: ', provider: 'Provider',
    base_url: 'Base URL', model: 'Model', api_key: 'API Key', key_ph: 'stored locally only',
    settings_privacy: 'Keys live only in your browser localStorage; requests go only to your chosen provider. OpenRouter / Zhipu GLM-4-Flash both have free tiers.',
    cancel: 'Cancel', save: 'Save', refresh: 'Refresh',
    inbox: 'UNSORTED', inbox_slogan: 'drag me up', board_suffix: 'Tier List',
    need_topic: 'Enter a topic first', need_items: 'Add items first, one per line', need_key: 'An API key is needed for AI tiering (free ones exist)',
    truncated: (n) => `More than ${n} items, kept the first ${n}`, ai_loading: 'AI is wrestling…',
    ai_429: 'Free model rate-limited, swap another free model in ⚙ Settings',
    gen_loading: 'AI is brainstorming…', gen_ok: (n) => `Filled in ${n} items, edit freely`, gen_fail: (e) => `Failed: ${e}`,
    img_done: 'Icons done ✨', img_partial: (n) => `Done, ${n} failed — click again to retry`,
    img_busy: (a, b) => `Icons ${a}/${b}…`, img_all: 'All set, refresh the page to regenerate',
    png_loading: 'Exporting…', png_fail: 'Export failed, take a screenshot instead', png_browser: 'Your browser cannot render this, try latest Chrome / Safari',
    md_copied: 'Copied, go post it', md_fail: 'Copy failed, select manually',
    settings_saved: 'Settings saved in this browser', need_topic_gen: 'Enter a topic first so AI knows what to list',
    models_ok: (n) => `${n} free models, click the input to pick`, models_loading: 'Loading free models…',
    models_empty: 'No list fetched, type a model name',
  },
}
let lang = localStorage.getItem('hang2la-lang')
  || (navigator.language?.startsWith('en') ? 'en' : 'zh')
const t = (key, ...args) => {
  const v = I18N[lang][key]
  return typeof v === 'function' ? v(...args) : v
}
function applyLang() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  document.title = lang === 'en' ? 'Hang to La · AI Tier List' : '从夯到拉 · AI 智能排榜'
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n)
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh)
  els['btn-lang'].textContent = lang === 'zh' ? 'EN' : '中文'
  if (state.results.length) renderBoard()
}
els['btn-lang'].addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh'
  localStorage.setItem('hang2la-lang', lang)
  applyLang()
  track('lang_switch', { to: lang })
})

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
        lang,
        ...props,
      },
    }))
  } catch {}
}
if (!localStorage.getItem(UID_KEY)) localStorage.setItem(UID_KEY, crypto.randomUUID().slice(0, 8))

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
  const title = topic ? `${topic} · ${t('board_suffix')}` : t('board_suffix')
  els['board-title'].textContent = title
  els['board-title-text'].textContent = title

  const rows = [
    ...TIERS.map((tr) => ({ id: tr.id, label: tierLabel(tr, lang), slogan: lang === 'en' ? tr.enSlogan : tr.slogan, colors: tr.colors })),
    { id: 'inbox', label: t('inbox'), slogan: t('inbox_slogan'), colors: null },
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

// ── AI 列条目(主题 → N 个条目) ─────────────────────────────────
els['btn-gen-items'].addEventListener('click', async () => {
  const topic = els['topic'].value.trim()
  if (!topic) return toast(t('need_topic_gen'))
  if (!config.apiKey) {
    openSettings()
    return toast(t('need_key'))
  }
  const count = Math.min(30, Math.max(3, Number(els['gen-count'].value) || 10))
  const btn = els['btn-gen-items']
  btn.disabled = true
  btn.dataset.orig = btn.textContent
  btn.textContent = t('gen_loading')
  try {
    const content = await chat({ ...config, prompt: buildItemsPrompt(topic, count, lang) })
    const fresh = parseItemsResponse(content, count)
    const merged = parseItems(els['items'].value + '\n' + fresh.join('\n'))
    els['items'].value = merged.join('\n')
    toast(t('gen_ok', fresh.length))
    track('items_generate', { ok: true, count: fresh.length })
  } catch (e) {
    toast(t('gen_fail', /429/.test(e.message) ? t('ai_429') : e.message))
    track('items_generate', { ok: false })
  } finally {
    btn.disabled = false
    btn.textContent = btn.dataset.orig
  }
})

// ── 三种开排方式 ────────────────────────────────────────────────
const DEMOS = {
  zh: { topic: '编程语言(梗界口碑版)', items: 'Python\nJava\nGo\nRust\nJavaScript\nTypeScript\nC++\nPHP\nRuby\nKotlin\nSwift\nCOBOL' },
  en: { topic: 'Programming languages (meme reputation)', items: 'Python\nJava\nGo\nRust\nJavaScript\nTypeScript\nC++\nPHP\nRuby\nKotlin\nSwift\nCOBOL' },
}

function startManual(topic, items, via) {
  if (!items.length) return toast(t('need_items'))
  const rawLines = els['items'].value.split('\n').filter((l) => l.trim()).length
  if (rawLines > items.length) toast(t('truncated', items.length))
  state = { topic, results: items.map((name) => ({ name, tier: null, reason: '' })) }
  renderBoard()
  track(via)
}

els['btn-demo'].addEventListener('click', () => {
  const demo = DEMOS[lang]
  els['topic'].value = demo.topic
  els['items'].value = demo.items
  startManual(demo.topic, parseItems(demo.items), 'demo_fill')
})

els['btn-manual'].addEventListener('click', () => {
  startManual(els['topic'].value.trim(), parseItems(els['items'].value), 'manual_start')
})

els['btn-ai'].addEventListener('click', async () => {
  const topic = els['topic'].value.trim() || t('board_suffix')
  const items = parseItems(els['items'].value)
  if (!items.length) return toast(t('need_items'))
  const rawLines = els['items'].value.split('\n').filter((l) => l.trim()).length
  if (rawLines > items.length) toast(t('truncated', items.length))
  if (!config.apiKey) {
    openSettings()
    return
  }
  const btn = els['btn-ai']
  btn.disabled = true
  btn.dataset.orig = btn.textContent
  btn.textContent = t('ai_loading')
  const t0 = Date.now()
  try {
    const content = await chat({ ...config, prompt: buildPrompt(topic, items, lang) })
    state = { topic, results: parseTierResult(content, items) }
    renderBoard()
    track('tier_generate', { provider: config.provider, model: config.model, count: items.length, ms: Date.now() - t0, ok: true })
  } catch (e) {
    toast(/429/.test(e.message) ? t('ai_429') : `error: ${e.message}`)
    track('tier_generate', { provider: config.provider, ok: false })
  } finally {
    btn.disabled = false
    btn.textContent = btn.dataset.orig
  }
})

// ── AI 配图(免费生图,受控队列:串行节流,失败自动重试 1 次) ──
els['btn-img'].addEventListener('click', () => {
  const todo = state.results.filter((r) => !r.image)
  if (!todo.length) return toast(t('img_all'))
  const btn = els['btn-img']
  btn.disabled = true
  btn.dataset.orig = btn.textContent
  const total = todo.length
  const callbacks = new Map() // name → 该条本轮的 settle 回调
  let done = 0
  let fail = 0
  let inflight = 0
  const paint = () => (btn.textContent = t('img_busy', done + fail, total))
  paint()

  const finishBatch = () => {
    btn.disabled = false
    btn.textContent = btn.dataset.orig
    track('image_generate', { ok: done, fail, total })
    toast(fail ? t('img_partial', fail) : t('img_done'))
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
  btn.textContent = t('png_loading')
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
    return toast(t('png_browser'))
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
    if (!blob) return toast(t('png_fail'))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${state.topic || 'tier-list'}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  })
  track('png_export')
}

// ── 复制 Markdown 文案 ──────────────────────────────────────────
els['btn-md'].addEventListener('click', async () => {
  const md = toMarkdown(state.topic, state.results, lang)
  try {
    await navigator.clipboard.writeText(md)
    toast(t('md_copied'))
  } catch {
    toast(t('md_fail'))
  }
  track('md_copy')
})

// ── 免费模型选择器(datalist,24h 缓存,仅 OpenRouter) ────────────
const MODELS_CACHE_KEY = 'hang2la-free-models'
const MODELS_TTL = 24 * 3600 * 1000

function fillModelOptions(list) {
  els['free-models'].replaceChildren(...list.map((id) => new Option(id, id)))
  els['free-models-hint'].textContent = list.length ? t('models_ok', list.length) : t('models_empty')
}

async function loadFreeModels({ force = false } = {}) {
  const cached = JSON.parse(localStorage.getItem(MODELS_CACHE_KEY) || 'null')
  if (!force && cached && Date.now() - cached.t < MODELS_TTL) {
    fillModelOptions(cached.list)
    return
  }
  els['free-models-hint'].textContent = t('models_loading')
  try {
    const list = await fetchFreeModels('https://openrouter.ai/api/v1')
    localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({ t: Date.now(), list }))
    fillModelOptions(list)
  } catch {
    fillModelOptions(cached?.list ?? [])
  }
}

els['btn-fetch-models'].addEventListener('click', () => loadFreeModels({ force: true }))

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
    ...PROVIDERS.map((p) => new Option(lang === 'en' ? p.enLabel ?? p.label : p.label, p.id, false, p.id === config.provider)),
  )
  const cur = PROVIDERS.find((p) => p.id === config.provider)
  if (cur && cur.id !== 'custom') fillProviderForm(cur)
  els['set-baseurl'].value = config.baseUrl
  els['set-model'].value = config.model
  els['set-key'].value = config.apiKey
  els['settings'].showModal()
  if (config.provider === 'openrouter') loadFreeModels()
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
  toast(t('settings_saved'))
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

applyLang()
track('page_view')
