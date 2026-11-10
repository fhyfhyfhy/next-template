import { expect, test } from "vitest";

import { parseFeatureGraph } from "./feature-graph.mjs";

function doc(lines) {
  return ["# Feature 划分", "", "```mermaid", ...lines, "```", ""].join("\n");
}

test("按节点名读出每个 feature 依赖的 feature，单独列出的节点没有依赖", () => {
  const { graph } = parseFeatureGraph(
    doc([
      "flowchart LR",
      "  orders[order] -->|下单的任务| task[task]",
      "  orders --> upload[upload]",
      "  task -->|封面图| upload",
      "  ui[ui-catalog]",
    ]),
  );
  expect(
    Object.fromEntries([...graph].map(([name, deps]) => [name, [...deps]])),
  ).toStrictEqual({
    order: ["task", "upload"],
    task: ["upload"],
    upload: [],
    "ui-catalog": [],
  });
});

test("CRLF 换行的文件也能解析", () => {
  const { graph } = parseFeatureGraph(
    doc(["flowchart LR", "  a[feature-a] --> b[feature-b]"]).replaceAll(
      "\n",
      "\r\n",
    ),
  );
  expect([...graph.get("feature-a")]).toStrictEqual(["feature-b"]);
});

test("记下每个节点第一次出现的行和每条边的行，行号按整个文件从 1 数", () => {
  const { nodes, edges } = parseFeatureGraph(
    doc(["flowchart LR", "  a[feature-a] --> b[feature-b]", "  c[feature-c]"]),
  );
  expect(Object.fromEntries(nodes)).toStrictEqual({
    "feature-a": 5,
    "feature-b": 5,
    "feature-c": 6,
  });
  expect(edges).toStrictEqual([
    { from: "feature-a", to: "feature-b", line: 5 },
  ]);
});

test.each([
  ["没有 mermaid 代码块", "# Feature 划分\n", /no mermaid block/],
  [
    "有认不出的行",
    doc(["flowchart LR", "  a[feature-a] -.-> b[feature-b]"]),
    /can't read: a\[feature-a\] -\.-> b\[feature-b\]/,
  ],
  [
    "节点没有名字",
    doc(["flowchart LR", "  a[feature-a] --> b"]),
    /node b has no feature name/,
  ],
  [
    "同一个节点有两个名字",
    doc(["flowchart LR", "  a[feature-a] --> b[feature-b]", "  a[feature-c]"]),
    /node a is named both feature-a and feature-c/,
  ],
])("%s时抛错", (_, markdown, message) => {
  expect(() => parseFeatureGraph(markdown)).toThrow(message);
});
