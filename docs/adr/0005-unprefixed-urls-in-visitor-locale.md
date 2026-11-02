# 多语言的 URL 不带 locale，按访问者的语言显示

模板主要用来做登录后使用的应用：语言是每个人的偏好，同事之间互相发链接，链接应该按读的人自己的语言打开。所以 URL 不带 locale（next-intl 的 `localePrefix: 'never'`）：proxy 按语言切换器写下的 `NEXT_LOCALE` cookie、浏览器的 `Accept-Language`、默认 locale 的顺序决定语言，把请求 rewrite 到 `app/[locale]/` 下。locale 仍是 `[locale]` 根 segment，经 `next/root-params` 读出，所以每个 locale 照常静态预渲染，Cache Components 的静态 shell 和 Partial Prefetching 都不受影响。取代 [ADR 0002](0002-locale-routing-as-needed-prefix.md)。

## Considered Options

- 不用 i18n 路由，在 `getRequestConfig` 里从 cookie 读 locale：代码最少，但根 layout 的 `<html lang>` 和下发的文案都依赖这个值，整棵树都要等请求。开着 Cache Components 只能在根 layout 设 `instant = false`，没有静态 shell，每次导航都在服务端阻塞。
- URL 带前缀，由 URL 决定语言（ADR 0002 的 `as-needed`）：适合要被搜索引擎收录的公开网站，但同一个链接对每个人都显示同一种语言。
- URL 带前缀，访问者的语言优先，前缀不一致时跳转：每个人都看到自己的语言，但多一次跳转，前缀也就不再说明页面的语言。

## Consequences

- 同一个 URL 按访问者返回不同的语言。缓存 HTML 的 CDN 要按 cookie 和 `Accept-Language` 区分，或者不缓存 HTML。
- 搜索引擎只看得到默认 locale 的页面：爬虫一般既不带 `Accept-Language` 也没有 cookie。这个模式下 next-intl 也不加 hreflang alternate 链接。
- 语言切换器链接到带目标 locale 前缀的地址（`/en/...`），proxy 把选择记进 `NEXT_LOCALE` cookie（保留一年），再跳到不带前缀的地址。带前缀的地址只用来切换语言。
- 没选过语言时按浏览器语言显示，不写 cookie，浏览器语言变了页面也跟着变。e2e 因此要固定浏览器的 locale。
- 根 layout 是 `app/[locale]/layout.tsx`。`app/` 下直接放的 layout 会抢走根 layout 的位置，所以全局 404 改用 `global-not-found`。
- 路由类型都带上 `[locale]`，例如 `PageProps<"/[locale]/demos/tasks">`。
- Server Action 和 Route Handler 读不到 root params，需要 locale 时由调用方显式传入。
