import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { onTestFinished } from "vitest";

/** 把 `source` 写到 root 下的 `file`，目录不存在时创建。 */
export function writeFile(root, file, source) {
  const filename = join(root, file);
  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(filename, source, "utf8");
}

/**
 * 在新的临时目录里写下 `files`（路径到内容的映射，内容为 null 的不写），返回这个目录；当前测试结束时目录被删除，
 * 所以要在测试里调用。
 */
export function tempDir(files = {}) {
  const root = mkdtempSync(join(tmpdir(), "test-fixture-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, source] of Object.entries(files)) {
    if (source !== null) writeFile(root, file, source);
  }
  return root;
}
