# PostHog Analytics — hang2la

> 匿名使用统计。默认开启,页脚一键关闭;关闭后零网络请求。零 PII,distinct_id 为本地随机 8 位 ID。

## 事件字典

| 事件 | 触发 | 属性 |
|------|------|------|
| `page_view` | 页面加载 | `page: 'index'` |
| `demo_fill` | 点「试个示例」 | |
| `manual_start` | 点「手动开排」 | |
| `tier_generate` | AI 分档完成/失败 | `provider`, `model?`, `count?`, `ms?`, `ok` |
| `tier_adjust` | 拖拽换档 | `to`(档位 id 或 inbox) |
| `items_generate` | AI 列条目完成/失败 | `ok`, `count?` |
| `lang_switch` | 切换语言 | `to`(zh/en),全局属性 `lang` |
| `image_generate` | AI 配图批次结束 | `ok`, `fail`, `total` |
| `png_export` | 导出 PNG | |
| `md_copy` | 复制文案 | |
| `settings_save` | 保存 AI 设置 | `provider` |
| `analytics_opt_in` | 重新勾选匿名统计 | |

## 查询模板

```sql
-- 单项目漏斗(近 7 天,UTC)
SELECT event, count() AS cnt
FROM events
WHERE properties.project = 'hang2la'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY event
ORDER BY cnt DESC
```

- project 值:`hang2la`(uid key:`hang2la-uid`)
- 端点:PostHog EU,`navigator.sendBeacon`
- localhost / 127.0.0.1 自动跳过
