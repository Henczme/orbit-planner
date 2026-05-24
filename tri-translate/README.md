# TriTranslate

一个极简中英德三语翻译 PWA。

## 架构

- 前端：静态网页，可部署到 GitHub Pages，可添加到 iPhone 桌面。
- 翻译：Cloudflare Worker 代理 Google Cloud Translation API。
- 发音：浏览器内置 Speech Synthesis。

## Cloudflare Worker 设置

1. 在 Google Cloud 开启 Cloud Translation API，并创建 API key。
2. 在 Cloudflare Workers 创建 Worker，代码使用 `worker/worker.js`。
3. 添加 Worker secret：

```bash
wrangler secret put GOOGLE_TRANSLATE_API_KEY
```

4. 部署 Worker：

```bash
cd worker
wrangler deploy
```

5. 打开 App，在设置里填入 Worker URL。
