// Each kind of build has its own directory, so that none overwrites another: the demo:* commands
// (scripts/run-next.mjs --demo) inline the Mock API's address into the build, which, mixed with the
// project's own build, would make pnpm start run a version pointed at the Mock API; the e2e build
// turns on the testing API, so it must not be started as a normal build, nor overwrite a running
// start. next.config.ts and eslint.config.mjs take the directories from here; tsconfig.json,
// .gitignore and .prettierignore cannot import, so build-dirs.test.mjs checks that they cover each one.

/** The env vars that decide the directory. */
export const BUILD_DIR_ENV_VARS = [
  "NEXT_PUBLIC_MOCK_API",
  "EXPOSE_TESTING_API",
];

/**
 * The directory this build, start or typegen uses: next.config.ts's `distDir`.
 * @param {Record<string, string | undefined>} env
 */
export function buildDir(env) {
  return [
    ".next",
    env.NEXT_PUBLIC_MOCK_API === "1" && "demo",
    env.EXPOSE_TESTING_API === "1" && "e2e",
  ]
    .filter(Boolean)
    .join("-");
}

/** Every possible directory: `.next`, `.next-e2e`, `.next-demo` and `.next-demo-e2e`. */
export const BUILD_DIRS = ["0", "1"].flatMap((demo) =>
  ["0", "1"].map((e2e) =>
    buildDir({ NEXT_PUBLIC_MOCK_API: demo, EXPOSE_TESTING_API: e2e }),
  ),
);

/**
 * The environment without the variables that decide the directory, which writes `.next`. tsconfig.json
 * reads only .next/types, so before a demo or e2e build next typegen runs with this environment;
 * otherwise it would write to the build's own directory, and .next/types would stay stale.
 * @param {Record<string, string | undefined>} env
 */
export function withoutBuildDirVars(env) {
  const copy = { ...env };
  for (const name of BUILD_DIR_ENV_VARS) delete copy[name];
  return copy;
}
