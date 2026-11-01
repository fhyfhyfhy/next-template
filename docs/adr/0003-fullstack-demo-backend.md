# 模板转为全栈，Demo 后端由本 app 实现

模板默认的项目形态从"前端接独立后端"改为全栈：后端由本 app 的 Route Handler、Server Action 和服务端数据层实现，数据存在 Postgres（kysely + pg）。Demo 是模板约定的可运行参考，所以 Data demo 整体换成这种写法，取代 [ADR 0001](0001-demos-use-standalone-mock-api.md) 的独立进程 Mock API。接独立后端的约定不再由模板和 Demo 提供。

服务端的读取不经过 HTTP：`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md` 的 Caveats 指出，Server Component 请求自己的 Route Handler 会多一次往返，build 时没有 server 在监听，prerender 也会失败。浏览器的读取不用 Server Action：`02-guides/server-actions.md` 写明 Server Action 在客户端排队、一次只发一个，轮询、边输入边搜索、SSE 都会互相阻塞，也会阻塞写入。

## Considered Options

- 保留独立进程，只把内存存储换成 Postgres：Demo 继续演示"前端接独立后端"，但模板要转为全栈，Demo 演示的就不再是模板的约定。
- Route Handler 同时服务服务端和浏览器，页面全部改成 dynamic：绕开了 build 失败，但正是上面文档不推荐的写法。
- 读写全部用 Server Action：读取会排队，见上。

## Consequences

- Server Component、`use cache` 和 Server Action 直接调用 feature 的 `server/` 层。浏览器的读取经 `fetchApi` 请求 `/api/demo` 的 GET Route Handler，写入一律走 Server Action。服务端 prefetch 覆盖 options factory 的 `queryFn`，改调数据层。
- 同一份数据既会经 RSC 序列化进入浏览器缓存，也会经 JSON 进入。所以响应 schema 只用 JSON 原生类型（时间戳用 epoch 毫秒，可空用 `null`，不用 transform 和 `z.date()`），放在 feature 的 `types/` 里，服务端和浏览器共用。
- Demo 后端只在配置了 Demo 专用的数据库连接时启用，用自己的 database 和 migration。没有配置时，Data demo 页面显示说明，`/api/demo` 返回 404。派生项目的部署不配置这个连接，所以 Demo 的写接口和控制接口不会暴露出去。
- Demo 只在长期运行的 `next dev` 和 `next start` 里跑：推进任务的 Demo 生成器是进程内的后台程序，用 Postgres advisory lock 保证同一个库上只有一个进程在推进。
- 浏览器发出的请求都是同源请求，`NEXT_PUBLIC_API_BASE_URL`、`#credentials` 和 `setup-data-access` skill 里面向独立后端的部分不再适用。
