// 此文件由 scripts/showcase/index-generator.mjs 自动生成，请勿手动修改。

"use client";

import type { ExampleDefinition } from "../../types/examples";
import { Example as Example0, metadata as metadata0 } from "./action.example";
import { Example as Example1, metadata as metadata1 } from "./basic.example";

export const examples = [
  {
    ...metadata0,
    id: "action",
    filename: "action.example.tsx",
    component: Example0,
  },
  {
    ...metadata1,
    id: "basic",
    filename: "basic.example.tsx",
    component: Example1,
  },
] satisfies readonly ExampleDefinition[];
