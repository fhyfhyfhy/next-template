import { expect, test } from "vitest";

import { parseFeatureGraph } from "./feature-graph.mjs";

function doc(lines) {
  return ["# Feature 划分", "", "```mermaid", ...lines, "```", ""].join("\n");
}

test("按节点名读出每个 feature 依赖的 feature，单独列出的节点没有依赖", () => {
  const { graph } = parseFeatureGraph(
    doc([
      "flowchart LR",
      "  lab[demo-lab] -->|重置任务| task[demo-task]",
      "  lab --> upload[demo-upload]",
      "  task -->|封面图| upload",
      "  ui[demo-ui]",
    ]),
  );
  expect(
    Object.fromEntries([...graph].map(([name, deps]) => [name, [...deps]])),
  ).toStrictEqual({
    "demo-lab": ["demo-task", "demo-upload"],
    "demo-task": ["demo-upload"],
    "demo-upload": [],
    "demo-ui": [],
  });
});

test("CRLF 换行的文件也能解析", () => {
  const { graph } = parseFeatureGraph(
    doc(["flowchart LR", "  a[demo-a] --> b[demo-b]"]).replaceAll("\n", "\r\n"),
  );
  expect([...graph.get("demo-a")]).toStrictEqual(["demo-b"]);
});

test("记下每个节点第一次出现的行和每条边的行，行号按整个文件从 1 数", () => {
  const { nodes, edges } = parseFeatureGraph(
    doc(["flowchart LR", "  a[demo-a] --> b[demo-b]", "  c[demo-c]"]),
  );
  expect(Object.fromEntries(nodes)).toStrictEqual({
    "demo-a": 5,
    "demo-b": 5,
    "demo-c": 6,
  });
  expect(edges).toStrictEqual([{ from: "demo-a", to: "demo-b", line: 5 }]);
});

test.each([
  ["没有 mermaid 代码块", "# Feature 划分\n", /no mermaid block/],
  [
    "有认不出的行",
    doc(["flowchart LR", "  a[demo-a] -.-> b[demo-b]"]),
    /can't read: a\[demo-a\] -\.-> b\[demo-b\]/,
  ],
  [
    "节点没有名字",
    doc(["flowchart LR", "  a[demo-a] --> b"]),
    /node b has no feature name/,
  ],
  [
    "同一个节点有两个名字",
    doc(["flowchart LR", "  a[demo-a] --> b[demo-b]", "  a[demo-c]"]),
    /node a is named both demo-a and demo-c/,
  ],
])("%s时抛错", (_, markdown, message) => {
  expect(() => parseFeatureGraph(markdown)).toThrow(message);
});
