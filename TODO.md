# 待办

## 承接已删除的状态管理规则

- [ ] 编写项目的技术选型 skill。客户端交互状态默认使用 React state，并遵循 composition-patterns；只有具体需求或已验证的性能问题使该方案不适用时，才选用 Zustand。将 URL 状态使用 nuqs、集中维护同一参数的 parser 和默认值、通过统一入口更新等约定放在该 skill 中。
- [ ] 迁移时按所选库的官方文档和安装版本核对 API。原规则关于 nuqs 配置默认值后不能传 `null` 的说明不再采用；通用的 Zustand 创建、selector 和持久化示例交给库文档。

## 表单

- [ ] TanStack Form v2 正式发布后评估升级：v2 的 `onSubmit` 可以直接返回字段错误（`createValidationError`），能替换现在服务端字段错误用的 `formApi.setErrorMap`。
- [ ] 复杂表单：字段数组、联动字段、多步骤表单还没有场景用到，第一次需要时补示例，并更新 `.claude/rules/libraries.md` 的 Forms 约定。

## 账号与授权

- [ ] 应用现在没有账号，所有访客共享同一批任务，Server Action 只校验输入、不做授权（ADR 0006）。加账号时补上任务归属、按用户收藏（作品广场的“我的收藏”已经按请求读取，不进共用的缓存快照），并在每个 action 里授权写入；这时 data-flow.md 的 Signing out 和 refresh.md 的 Session changes 也有了实例。

## 可访问性

- [ ] 进行中任务徽标的 `aria-label` 挂在没有角色的 span 上（features/task/components/task-header/running-tasks-badge.tsx），读屏多半读可见文字，英文的复数说法听不到；换成可见文字或合适的角色，e2e 用 `getByLabel` 找它，要一起改。

## 数据新鲜度

- [ ] 进行中任务的集合每变一次，每个打开着的全部任务页都会调用一次 `expireTaskListAction`。refresh.md 的 Changes made elsewhere 建议改由后端事件失效缓存：generator（真实系统里是外部生成服务）推进任务时调用应用的 Route Handler 做 `revalidateTag`，浏览器只 `router.refresh()`。等部署成多实例、或者同时在线的访客多起来时再做，和共享的缓存 handler 一起考虑（README 的 Deployment 一节）。

## 文案、国际化与错误恢复

- [ ] 制定文案风格规范：语气、标点、中英文混排。翻译流程、key 和 namespace 的约定已在 `.claude/rules/i18n.md`。
- [ ] 详细制定错误与恢复规范：覆盖字段校验、局部错误状态与恢复操作，以及成功反馈的时机。
