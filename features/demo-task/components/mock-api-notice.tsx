/** Mock API 没有运行时代替 Data demo 页面显示，页面不发任何请求。 */
export function MockApiNotice() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <h1 className="text-3xl font-medium tracking-tight">Mock API 未运行</h1>
      <div className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          Data demo 只对着模板自带的 Mock API 运行。项目配置了真实后端（
          <code>NEXT_PUBLIC_API_BASE_URL</code>）时 Mock API
          不会启动，这些页面也不发请求，免得 demo 的写入落到真实后端上。
        </p>
        <p>
          要查看 Data demo，运行 <code>pnpm demos</code>：它会启动 Mock API
          并让整个应用指向它，这次运行期间真实业务页面的请求也会发给 Mock API。
        </p>
      </div>
    </main>
  );
}
