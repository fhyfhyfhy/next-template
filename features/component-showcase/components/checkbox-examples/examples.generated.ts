// 此文件由 scripts/showcase/index-generator.mjs 自动生成，请勿手动修改。

"use client";

import type { ExampleDefinition } from "../../types/examples";
import { Example as Example0, metadata as metadata0 } from "./basic.example";
import {
  Example as Example1,
  metadata as metadata1,
} from "./composition.example";
import { Example as Example2, metadata as metadata2 } from "./icons.example";
import {
  Example as Example3,
  metadata as metadata3,
} from "./validation.example";

export const examples = [
  {
    ...metadata0,
    id: "basic",
    filename: "basic.example.tsx",
    component: Example0,
  },
  {
    ...metadata1,
    id: "composition",
    filename: "composition.example.tsx",
    component: Example1,
  },
  {
    ...metadata2,
    id: "icons",
    filename: "icons.example.tsx",
    component: Example2,
  },
  {
    ...metadata3,
    id: "validation",
    filename: "validation.example.tsx",
    component: Example3,
  },
] satisfies readonly ExampleDefinition[];
