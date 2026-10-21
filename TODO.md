# 待办

## 承接已删除的状态管理规则

- [ ] 编写项目的技术选型 skill。客户端交互状态默认使用 React state，并遵循 composition-patterns；只有具体需求或已验证的性能问题使该方案不适用时，才选用 Zustand。将 URL 状态使用 nuqs、集中维护同一参数的 parser 和默认值、通过统一入口更新等约定放在该 skill 中。
- [ ] 在 `.claude/rules/data-fetching.md` 补充服务端数据的归属：从 React Query cache 消费数据；有独立编辑生命周期的草稿可以单独管理，避免为展示维护同步副本。
- [ ] 迁移时按所选库的官方文档和安装版本核对 API。原规则关于 nuqs 配置默认值后不能传 `null` 的说明不再采用；通用的 Zustand 创建、selector 和持久化示例交给库文档。

React Query 选型和 SWR 约束已由 `.claude/rules/data-fetching.md` 覆盖；状态模块的业务归属和公共入口已由 `.claude/rules/architecture.md` 覆盖，沿用现有规则。

## 文案、国际化与错误恢复

- [ ] 详细制定文案与 i18n 规范：覆盖可见文案、可访问性标签、提示和错误文案，明确翻译 key 的复用、命名与命名空间、领域文案归属，以及未启用 i18n 时的处理方式。
- [ ] 详细制定错误与恢复规范：明确请求封装、全局 handler 与组件的职责，覆盖通知去重、字段校验、局部错误状态与恢复操作，以及失败向调用方传递和成功反馈的时机。
