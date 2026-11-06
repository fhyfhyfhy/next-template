# 模板本身就是一个真实项目，不另设 Demo

模板原来在项目代码之外另有一层 Demo：`/demos` 下的页面、`demo-*` feature、只由 `demo:*` 命令启用的 Demo backend，以及给数据层注入延迟和故障的故障实验室，供 agent 和开发者写代码时对照，rules 和 skills 也直接引用它的代码。现在去掉这一层：仓库本身就是一个全栈的真实项目，任务和上传是它自己的业务（Sample product），写法和派生项目的业务一样。派生项目删掉这些业务、写自己的，要参考写法时到模板的仓库里看；rules 和 skills 只引用派生项目也会保留的代码，取自业务的写法用内联代码示意。取代 [ADR 0003](0003-fullstack-demo-backend.md)：全栈的形态不变，变的是不再有 Demo 专用的开关和数据。

## Considered Options

- 保留 Demo 层：派生项目要么带着一套不上线的代码，要么删掉它、让 rules 和 skills 里的引用失效。Demo 专用的开关、数据集、命令，以及包在数据层外面的故障注入，也让它和真实项目的写法越走越远。

## Consequences

- 后端的连接参数是必填的环境变量（`lib/env.ts`）。本地开发连 `compose.yaml` 里的 Postgres 和对象存储：`pnpm dev` 启动它们、执行 migration，库里没有任务时写入种子数据；部署时由平台设置环境变量，migration 由 `pnpm db:migrate` 执行。
- 种子数据用应用自己的数据层写入，所以在 Next 之外用 tsx 加载 TypeScript 模块，并打开 `react-server` 条件，让 `server-only` 解析成空模块（`scripts/local-services/services.mjs`）。
- e2e 没有应用里的测试入口：用例直接写 e2e 数据库来准备数据和模拟别处的改动，在浏览器里拦截请求来制造延迟和失败。服务端缓存只能通过应用自己的写入失效，所以 e2e 在 build 之前把数据库恢复成种子数据，之后种子数据只读，要写的用例建自己的记录。
- 故障实验室和 Demo 给每个操作加的默认延迟一起去掉。服务端渲染时某段数据的读取要慢下来，e2e 用锁表来拖住它。
