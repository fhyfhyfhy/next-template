declare global {
  // dev 下改动这个文件会重新执行 register，后台任务的启动标记挂在 globalThis 上，只启动一次。
  var __backgroundJobs: boolean | undefined;
}

/**
 * Next 服务启动时调用一次。先校验应用的全部环境变量，再启动后台任务：清理没被使用的上传，以及推进任务的
 * generator（`TASK_GENERATOR_ENABLED` 关闭时不启动，见 lib/env.ts）。
 * 它们只在长期运行的 next dev / next start 进程里跑；build 阶段的预渲染进程也会加载这个文件，那里不启动。
 * 多个进程连同一个库时，每个后台任务只有一个进程在运行（advisory lock）。
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
  if (globalThis.__backgroundJobs) return;
  globalThis.__backgroundJobs = true;
  const [{ startTaskGenerator }, { startUploadCleanup }] = await Promise.all([
    import("@/features/task/server"),
    import("@/features/upload/server"),
  ]);
  if (env.TASK_GENERATOR_ENABLED) startTaskGenerator();
  startUploadCleanup();
}
