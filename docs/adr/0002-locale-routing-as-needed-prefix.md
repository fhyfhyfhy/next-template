# 多语言路由用 `[locale]` 根 segment，默认 locale 不带前缀

模板用 next-intl 做多语言，所有路由放在 `app/[locale]/` 下，`localePrefix` 用 `as-needed`：默认 locale 的 URL 不带前缀（`/demos/tasks`），其他 locale 带前缀（`/en/demos/tasks`）。locale 通过 `next/root-params` 从 URL 读出，每个 locale 都能静态预渲染，Cache Components 的静态 shell 和 Partial Prefetching 都照常工作。

## Considered Options

- URL 不带 locale，只靠 cookie 或 `Accept-Language` 决定：在 `getRequestConfig` 里读 cookie 或 header 属于 request-time API，`<html lang>` 又依赖这个值，整页都会变成 dynamic，静态 shell 也就没了。
- `localePrefix: 'never'`（proxy 内部 rewrite 到 `[locale]`）：静态渲染能保住，但同一个 URL 会返回多种语言，CDN 缓存得按 cookie 区分；它和 Partial Prefetching 的配合没有验证过，也没有 alternate links。
- `localePrefix: 'always'`：现有 URL 全部改变，e2e 和文档里的路径都要改，默认 locale 的 URL 也会多一段前缀。

## Consequences

- 根 layout 是 `app/[locale]/layout.tsx`。`app/` 下直接放的 layout 会抢走根 layout 的位置，所以全局 404 改用 `global-not-found`。
- 路由类型都带上 `[locale]`，例如 `PageProps<"/[locale]/demos/tasks">`。
- Server Action 和 Route Handler 读不到 root params，需要 locale 时由调用方显式传入。
- proxy 依次按 URL 前缀、cookie、`Accept-Language` 决定 locale。浏览器语言是英文的用户，第一次打开不带前缀的 URL 时会被跳到 `/en/...`，所以 e2e 要固定浏览器的 locale。
