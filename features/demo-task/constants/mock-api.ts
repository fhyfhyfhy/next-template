/**
 * scripts/run-next.mjs 启动了 Mock API 时注入 `NEXT_PUBLIC_MOCK_API=1`，build 时内联。为 false 时项目配置了
 * 真实后端，Data demo 不能发出任何请求。layout 只显示说明还不够：Next 并行渲染 layout 和 page，layout 不渲染
 * children 时 page 里的服务端读取照样执行（build 时会请求真实后端并失败），所以每个服务端读取的入口——页面里发请求的
 * Server Component 和 generateMetadata——都要先判断它。浏览器里的 query 不受影响：页面没挂载就不会发。
 */
export const MOCK_API_RUNNING = process.env.NEXT_PUBLIC_MOCK_API === "1";
