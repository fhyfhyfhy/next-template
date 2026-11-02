import { relative, sep } from "node:path";

const kebabCase = /[a-z0-9]+(?:-[a-z0-9]+)*/.source;
const routeParam = /[a-z][a-zA-Z0-9]*/.source;
// 文件名按 . 分段检查（basic.example.tsx、index.d.ts）；允许 . 开头的目录和文件（.claude/）。
const kebabCaseName = new RegExp(
  String.raw`^\.?${kebabCase}(?:\.${kebabCase})*$`,
);
// app/ 下的目录还可以用 Next.js 路由写法：拦截前缀 (.)、(..)、(...)，(group)、@slot、_private，
// 动态段 [param]、[...param]、[[...param]]。动态段名是 params 的 key，和 Next.js 文档一样用 camelCase。
const appRouteDirectoryName = new RegExp(
  String.raw`^(?:\(\.\)|\(\.\.\.\)|(?:\(\.\.\))+)?(?:${kebabCase}|\(${kebabCase}\)|@${kebabCase}|_${kebabCase}|\[(?:\.\.\.)?${routeParam}\]|\[\[\.\.\.${routeParam}\]\])$`,
);

/** 为调用方的项目根目录创建路径命名插件，包含 Next.js 路由目录约定。 */
export default function createNamingPlugin(projectRoot) {
  // ESLint 只处理源码文件，所以只覆盖源码文件和它们所在的目录；CSS、图片、Markdown 等不在检查范围内。
  const kebabCasePathRule = {
    meta: {
      type: "suggestion",
      schema: [],
      messages: {
        name: "Use kebab-case for file and directory names: {{names}} in {{path}}. Dots separate name segments (basic.example.tsx). Under app/, Next.js route folders such as (group), @slot, _private, [param] and [...param] are also allowed.",
      },
    },
    create(context) {
      const parts = relative(projectRoot, context.filename).split(sep);
      if (parts[0] === "..") return {};
      const invalid = parts.filter((part, index) => {
        if (kebabCaseName.test(part)) return false;
        const isAppDirectory =
          parts[0] === "app" && index > 0 && index < parts.length - 1;
        return !(isAppDirectory && appRouteDirectoryName.test(part));
      });
      if (invalid.length === 0) return {};

      return {
        Program(node) {
          context.report({
            node,
            messageId: "name",
            data: { names: invalid.join(", "), path: parts.join("/") },
          });
        },
      };
    },
  };

  return { rules: { "kebab-case": kebabCasePathRule } };
}
