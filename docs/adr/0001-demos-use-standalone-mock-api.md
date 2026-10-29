# Demo 经 fetchApi 请求独立进程的 Mock API

Demo 会长期保留，供 agent 照着写代码，所以它的请求代码必须和接真实后端时完全一样：经 `fetchApi` 发 HTTP 请求，解开响应信封，按状态码和业务 code 抛错或重试，并支持服务端 prefetch。因此 Demo 的后端是 `scripts/mock-api/` 下一个独立的 Node 进程（Mock API）。项目还没配置真实后端时，运行 Next 的脚本会把它一起启动。官方 demo 常用进程内的假数据或本 app 的 Route Handler，这里没有采用。

## Considered Options

- 进程内的假数据函数（`nextjs/async-react-demo` 的做法）：不经过 `fetchApi`，演示不到响应信封、错误、重试和凭证这些约定。
- 本 app 的 Route Handler（`nextjs/next-spa-patterns` 的做法）：Server Component 通过 HTTP 请求自己的 Route Handler，正是 `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md` 不推荐的写法，而且 `app/api/` 里会混进一批看起来像真实 BFF 的假代码。
- MSW：要多装一个依赖，而且在 Next 服务端拦截被 patch 过的 `fetch` 不稳定。

## Consequences

- `fetchApi` 只有一个 base URL，所以 Mock API 只在项目没配置真实后端时运行。Mock API 没运行时，Data demo 页面不发请求。
- `use cache` 里的读请求会在 build 时执行，所以 build 和 start 时也要带着 Mock API。`NEXT_PUBLIC_API_BASE_URL` 会在 build 时内联进产物，build 和 start 必须指向同一个地址。
- 项目改了响应格式时，Mock API 和 Demo 里判断错误的代码要一起改，由 `setup-data-access` 负责。
