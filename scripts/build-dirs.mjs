// e2e 的 build 打开了测试 API，不能被当成正常产物 start，也不能覆盖正在运行的 start，所以放进自己的目录。
// next.config.ts 和 eslint.config.mjs 从这里取目录；tsconfig.json、.gitignore、.prettierignore 写不了 import，
// 由 build-dirs.test.mjs 检查它们覆盖了每个目录。

/** 决定目录的环境变量。 */
export const BUILD_DIR_ENV_VARS = ["EXPOSE_TESTING_API"];

/**
 * 这次 build、start 或 typegen 用的目录，即 next.config.ts 的 `distDir`。
 * @param {Record<string, string | undefined>} env
 */
export function buildDir(env) {
  return env.EXPOSE_TESTING_API === "1" ? ".next-e2e" : ".next";
}

/** 所有可能的目录。 */
export const BUILD_DIRS = ["0", "1"].map((e2e) =>
  buildDir({ EXPOSE_TESTING_API: e2e }),
);

/**
 * 去掉决定目录的变量，得到写 `.next` 的环境。tsconfig.json 只读 .next/types，e2e 的 build 之前要用这份环境跑
 * next typegen，否则它写进自己的目录，.next/types 照旧过期。
 * @param {Record<string, string | undefined>} env
 */
export function withoutBuildDirVars(env) {
  const copy = { ...env };
  for (const name of BUILD_DIR_ENV_VARS) delete copy[name];
  return copy;
}
