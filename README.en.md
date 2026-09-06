# hang2la — From Hang to La

> An AI-powered Chinese-meme tier list: 夯(Hang) / 顶级(Top) / 人上人(Elite) / NPC / 拉完了(La)

![screenshot](screenshot.png)

**[Try it live](https://liyuankui.github.io/hang2la/)** · zero install, zero backend, fully static

Type a topic and a list of items; the AI sorts everything into five tiers with one snarky comment each. Drag cards between tiers, then export a PNG or copy the markdown.

## How to play

1. Enter a topic and items (one per line, up to 30) — or type a count and hit "✨ AI list items" to have AI brainstorm them
2. Hit "🔥 AI Tier It" — or go keyless with manual mode
3. Optional "🎨 AI Icons": free AI-generated icons per item (no key needed, via Pollinations; serial generation takes 1-2 min, click again to fill failures)
4. Drag to fine-tune → export PNG / copy text
5. Toggle 中文 / EN in the header — bilingual UI with meme-accurate tier names (夯/顶级/人上人/NPC/拉完了 ↔ GOATED/S-TIER/A-TIER/NPC/TRASHED)

## Free AI access

Fully client-side. Your API key lives in your own browser's localStorage and is sent only to the provider you pick:

| Provider | Free tier | Get a key |
|----------|-----------|-----------|
| OpenRouter (default) | `:free` models | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Zhipu BigModel | GLM-4-Flash free tier | [open.bigmodel.cn](https://open.bigmodel.cn/usercenter/apikeys) |
| DeepSeek / OpenAI / any OpenAI-compatible | pay-as-you-go | custom Base URL in settings |

## Privacy

- API keys never leave your browser
- Anonymous analytics are on by default with a one-click opt-out in the footer; opting out sends zero network requests (see [POSTHOG_ANALYTICS.md](POSTHOG_ANALYTICS.md))

## Development

```bash
bun test          # core logic tests
bunx serve .      # local preview
```

Zero build: native ES Modules, no frameworks, no dependencies.

## License

MIT
