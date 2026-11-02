import "server-only";

/**
 * Server Component、Server Action、Route Handler 请求后端时附加的凭证，`fetchApi` 经 `#credentials` 引入：
 * package.json 的 `imports` 只在 `react-server` 条件下解析到本文件，浏览器侧是 `credentials-browser.ts`。
 * 不合并成一个按 `typeof window` 分支的文件：Client Component 在服务端渲染时也没有 `window`，
 * 服务端分支会被打进那里，而那里静态引入 `next/headers` 或 `server-only` 会让构建失败。
 * 读本次请求的 cookie 时，调用方按请求执行，`use cache` 里的调用要传 `auth: false`。
 */
export async function credentialHeaders(): Promise<Record<string, string>> {
  // TODO: 模板还没配置凭证，需要登录态的接口在服务端拿不到用户；按后端的认证方式填写（setup-data-access skill），接口全部公开时改为写明这一点。
  return {};
}
