import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const FEATURE_GRAPH_FILE = "docs/features.md";

const NODE = String.raw`([A-Za-z_]\w*)(?:\[([^\]\n]+)\])?`;
const EDGE = new RegExp(String.raw`^${NODE}\s*-->(?:\|[^|\n]*\|)?\s*${NODE}$`);
const NODE_ONLY = new RegExp(`^${NODE}$`);
const HEADER = /^(?:flowchart|graph)\s+(?:LR|RL|TB|TD|BT)$/;

/**
 * 解析 docs/features.md 第一个 mermaid 代码块里的 feature 依赖图。节点写成 `id[feature 名]`，边写成
 * `a -->|用途| b`。返回每个 feature 依赖的 feature 名（`graph`），以及每个节点和每条边在文件里的行号（从 1 开始）。
 * 认不出的行和没有名字的节点直接抛错：写错的图要让检查失败，而不是悄悄放过依赖。
 */
export function parseFeatureGraph(markdown) {
  const text = markdown.replaceAll("\r\n", "\n");
  const block = /^```mermaid[^\S\n]*\n([\s\S]*?)^```/m.exec(text);
  if (!block) throw new Error("it has no mermaid block");
  const firstLine = text.slice(0, block.index).split("\n").length + 1;

  const names = new Map();
  const nodeLines = new Map();
  const edges = [];
  let hasHeader = false;

  function node(id, name, line) {
    if (!nodeLines.has(id)) nodeLines.set(id, line);
    if (name === undefined) return id;
    const known = names.get(id);
    if (known !== undefined && known !== name.trim()) {
      throw new Error(`node ${id} is named both ${known} and ${name.trim()}`);
    }
    names.set(id, name.trim());
    return id;
  }

  for (const [index, raw] of block[1].split("\n").entries()) {
    const line = raw.trim();
    const lineNumber = firstLine + index;
    if (!line || line.startsWith("%%")) continue;
    if (!hasHeader && HEADER.test(line)) {
      hasHeader = true;
      continue;
    }
    const edge = EDGE.exec(line);
    if (edge) {
      edges.push({
        from: node(edge[1], edge[2], lineNumber),
        to: node(edge[3], edge[4], lineNumber),
        line: lineNumber,
      });
      continue;
    }
    const lone = NODE_ONLY.exec(line);
    if (lone) {
      node(lone[1], lone[2], lineNumber);
      continue;
    }
    throw new Error(`its mermaid block has a line it can't read: ${line}`);
  }

  for (const id of nodeLines.keys()) {
    if (!names.has(id)) {
      throw new Error(
        `node ${id} has no feature name; write it as ${id}[name]`,
      );
    }
  }

  const graph = new Map([...names.values()].map((name) => [name, new Set()]));
  for (const { from, to } of edges) {
    graph.get(names.get(from)).add(names.get(to));
  }
  return {
    graph,
    nodes: new Map([...nodeLines].map(([id, line]) => [names.get(id), line])),
    edges: edges.map(({ from, to, line }) => ({
      from: names.get(from),
      to: names.get(to),
      line,
    })),
  };
}

/**
 * 读项目的 feature 依赖图，返回 `{ graph }` 或 `{ error }`。按文件修改时间缓存：
 * 编辑器里长时间运行的 ESLint 也能读到改过的图。
 */
export function createFeatureGraphLoader(projectRoot) {
  const file = join(projectRoot, FEATURE_GRAPH_FILE);
  let cache;
  return () => {
    let mtimeMs;
    try {
      ({ mtimeMs } = statSync(file));
    } catch {
      return { error: `${FEATURE_GRAPH_FILE} does not exist` };
    }
    if (cache?.mtimeMs !== mtimeMs) {
      let result;
      try {
        result = {
          graph: parseFeatureGraph(readFileSync(file, "utf8")).graph,
        };
      } catch (error) {
        result = {
          error: `${FEATURE_GRAPH_FILE} can't be read: ${error.message}`,
        };
      }
      cache = { mtimeMs, result };
    }
    return cache.result;
  };
}
