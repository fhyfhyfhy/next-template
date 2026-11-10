import { statSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

import { createProjectResolver } from "./imports.mjs";

/** 文件或目录的版本，用来判断缓存是否失效；不存在时为 null。 */
export function fileVersion(stat) {
  // ctime 和 inode 能发现恢复了 mtime 的写入，以及编辑器的原子替换。
  return stat
    ? `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`
    : null;
}

/**
 * 磁盘上的 stat，每个路径在下一次 reset() 之前只读一次：一次检查不管问多少遍，看到的都是磁盘的同一个状态。
 * 跨文件复用的检查器在每次检查开始时调用 reset()。
 */
export function createStatSnapshot() {
  const stats = new Map();
  return {
    reset: () => stats.clear(),
    readStat: (filename) => {
      const path = resolve(filename);
      if (!stats.has(path))
        stats.set(path, statSync(path, { throwIfNoEntry: false }));
      return stats.get(path);
    },
  };
}

/**
 * 项目的解析器（createProjectResolver），只在它读过的文件变化后重建：tsconfig 及其 extends、package.json，
 * 以及解析时探测过的路径（含不存在的），所以新增一个解析时更优先的目标也会让它失效。readStat 读取用来比较的
 * stat，比如 createStatSnapshot 的。返回的函数给出当前的 resolveImport 和它的 revision，每次重建 revision
 * 加一，调用方据此判断自己缓存的解析结果是否过期。配置无效期间每次调用都抛错，直到配置修好，不会退回旧解析器。
 */
export function createCachedResolver(projectRoot, readStat) {
  const root = resolve(projectRoot);
  let current = null;
  let dependencies = new Map();
  let revision = 0;
  const track = (filename) => {
    const stat = readStat(filename);
    dependencies.set(resolve(filename), fileVersion(stat));
    return stat;
  };
  const host = {
    ...ts.sys,
    fileExists: (filename) => track(filename)?.isFile() ?? false,
    directoryExists: (directory) => track(directory)?.isDirectory() ?? false,
    readFile: (filename) => {
      track(filename);
      return ts.sys.readFile(filename);
    },
    realpath: (filename) => {
      track(filename);
      return ts.sys.realpath(filename);
    },
  };

  return () => {
    if (
      current &&
      [...dependencies].every(
        ([filename, version]) => fileVersion(readStat(filename)) === version,
      )
    )
      return current;
    // 重建之前先丢掉旧解析器：重建抛错时 dependencies 已经记下无效配置的版本，留着旧解析器的话，下一次调用会
    // 把它当成当前的。
    current = null;
    dependencies = new Map();
    current = {
      resolveImport: createProjectResolver(root, host),
      revision: ++revision,
    };
    return current;
  };
}
