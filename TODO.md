# 待办

## 承接已删除的状态管理规则

- [ ] 编写项目的技术选型 skill。客户端交互状态默认使用 React state，并遵循 composition-patterns；只有具体需求或已验证的性能问题使该方案不适用时，才选用 Zustand。将 URL 状态使用 nuqs、集中维护同一参数的 parser 和默认值、通过统一入口更新等约定放在该 skill 中。
- [ ] 迁移时按所选库的官方文档和安装版本核对 API。原规则关于 nuqs 配置默认值后不能传 `null` 的说明不再采用；通用的 Zustand 创建、selector 和持久化示例交给库文档。

## 表单

- [ ] TanStack Form v2 正式发布后评估升级：v2 的 `onSubmit` 可以直接返回字段错误（`createValidationError`），能替换现在服务端字段错误用的 `formApi.setErrorMap`。
- [ ] 复杂表单：字段数组、联动字段、多步骤表单还没有场景用到，第一次需要时补示例，并更新 `.claude/rules/libraries.md` 的 Forms 约定。

## Next.js 升级

- [ ] 升级到包含 vercel/next.js#100728 的版本（16.5.0-canary.28 起，等 16.5 正式版）后，确认打开故障实验室的 Draft Mode 时，服务器日志里不再出现 `Unexpected cache miss after cache warming phase during prerendering`。16.4.3 在 Draft Mode 下不把 `use cache` 的结果写进 Resume Data Cache，`partialPrefetching` 的预取到最终渲染时找不到条目，就打出这条警告（vercel/next.js#100680）；页面内容和 e2e 不受影响。

## 文案、国际化与错误恢复

- [ ] 制定文案风格规范：语气、标点、中英文混排。翻译流程、key 和 namespace 的约定已在 `.claude/rules/i18n.md`。
- [ ] 详细制定错误与恢复规范：覆盖字段校验、局部错误状态与恢复操作，以及成功反馈的时机。
- [ ] 按用户所在时区显示时间。现在全局固定为 `Asia/Shanghai`（`lib/i18n/request.ts`），服务端渲染和 hydration 才能得到一样的文本；服务端拿不到可靠的用户时区（`x-vercel-ip-timezone` 按 IP 推断且只在 Vercel 上有，读 cookie 会让页面变成 dynamic，见 next-intl#2136）。有需求时的做法：做一个 Client Component，hydration 之前按固定时区格式化，之后（`useHydrated`）换成浏览器的 `Intl.DateTimeFormat().resolvedOptions().timeZone`；代价是时区不同的用户整页加载时文本会跳一次。
