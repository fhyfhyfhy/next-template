import { SOURCE_EXTENSIONS } from "./imports.mjs";

// 哪些目录放应用代码，以及它们的层级。eslint.config.mjs 用它们检查层级；派生项目在 eslint.config.project.mjs
// 里管应用代码的规则也从这里取，template 新增的层才会进到那些规则里。

const extensionGlob = `{${SOURCE_EXTENSIONS.join(",")}}`;

// 同层和下层依赖允许；文件和 feature 循环分别由 import/no-cycle、architecture/no-feature-cycle 检查。
// 数组里的几个目录算同一层。
// 和 .claude/rules/architecture.md「Layers」「Feature structure」两张表一一对应，改一边要同步另一边。
export const ROOT_LAYERS = [
  { name: "app/", files: ["app/**"] },
  { name: "features/", files: ["features/**"] },
  {
    name: "components/",
    files: ["components/!(ui)/**", `components/*.${extensionGlob}`],
  },
  { name: "components/ui/", files: ["components/ui/**"] },
  { name: "hooks/", files: ["hooks/**"] },
  { name: "lib/", files: ["lib/**"] },
  [
    { name: "utils/", files: ["utils/**"] },
    { name: "constants/", files: ["constants/**"] },
    { name: "types/", files: ["types/**"] },
  ],
];

// 「Layers」表里的目录逐个列出，不分它们在哪一层。
export const ROOT_DIRECTORIES = ROOT_LAYERS.flat();

export const FEATURE_LAYERS = [
  "components",
  "hooks",
  "stores",
  "api",
  "server",
  ["utils", "constants", "types"],
].map((level) =>
  [level].flat().map((dir) => ({
    name: `features/{name}/${dir}/`,
    files: [`features/*/${dir}/**`],
  })),
);

// Next 在应用进程里加载的根目录文件也是应用代码，但不在「Layers」表的目录里，单独列出。
export const ROOT_APP_FILES = [`{proxy,instrumentation}.${extensionGlob}`];
