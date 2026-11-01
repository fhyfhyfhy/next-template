/**
 * 浏览器请求后端时附加的凭证，`fetchApi` 经 `#credentials` 引入，拆分原因见 `credentials-server.ts`。
 * Client Component 在服务端渲染和单元测试（Vitest）也解析到本文件，那时没有 `window`、拿不到浏览器里的
 * 凭证：填写时先在 `typeof window === "undefined"` 时返回 `{}`。浏览器自己携带的 cookie 不经过这里。
 */
export async function credentialHeaders(): Promise<Record<string, string>> {
  // TODO: 模板还没配置凭证；按后端的认证方式填写（setup-data-access skill），只靠浏览器自带 cookie 或接口全部公开时改为写明这一点。
  return {};
}
