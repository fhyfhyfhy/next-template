// 此文件由 scripts/ui-catalog/index-generator.mjs 自动生成，请勿手动修改。

"use client";

import type { ExampleDefinition } from "../../types/examples";
import { Example as Example0, metadata as metadata0 } from "./async.example";
import { Example as Example1, metadata as metadata1 } from "./basic.example";
import { Example as Example2, metadata as metadata2 } from "./sizes.example";

export const examples = [
  {
    ...metadata0,
    id: "async",
    filename: "async.example.tsx",
    component: Example0,
  },
  {
    ...metadata1,
    id: "basic",
    filename: "basic.example.tsx",
    component: Example1,
  },
  {
    ...metadata2,
    id: "sizes",
    filename: "sizes.example.tsx",
    component: Example2,
  },
] satisfies readonly ExampleDefinition[];
