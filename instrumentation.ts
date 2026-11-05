declare global {
  // dev 下改动这个文件会重新执行 register，后台任务的启动标记挂在 globalThis 上，只启动一次。
  var __demoBackgroundJobs: boolean | undefined;
}

/**
 * Next 服务启动时调用一次。先校验应用的全部环境变量，再在 Demo backend 启用时（只有 demo:* 命令会设置
 * DEMO_DATABASE_URL）启动它的两个后台任务：推进任务的 Demo generator 和清理没被使用的上传。
 * 它们只在长期运行的 next dev / next start 进程里跑；build 阶段的
 * 预渲染进程也会加载这个文件，那里不启动。多个进程连同一个库时，每个后台任务只有一个进程在运行（advisory lock）。
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }
  const { env, validateEnv } = await import("@/lib/env");
  validateEnv();
  if (env.DEMO_DATABASE_URL === undefined) return;
  if (globalThis.__demoBackgroundJobs) return;
  globalThis.__demoBackgroundJobs = true;
  const [{ startDemoGenerator }, { startUploadCleanup }] = await Promise.all([
    import("@/features/demo-task/server"),
    import("@/features/demo-upload/server"),
  ]);
  startDemoGenerator();
  startUploadCleanup();
}
