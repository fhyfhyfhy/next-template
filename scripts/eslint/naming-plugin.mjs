import { relative, sep } from "node:path";

const kebabCase = /[a-z0-9]+(?:-[a-z0-9]+)*/.source;
const routeParam = /[a-z][a-zA-Z0-9]*/.source;
// A file name is checked per .-separated segment (basic.example.tsx, index.d.ts); directories and
// files starting with . are allowed (.claude/).
const kebabCaseName = new RegExp(
  String.raw`^\.?${kebabCase}(?:\.${kebabCase})*$`,
);
// Directories under app/ may also use Next.js route syntax: the intercepting prefixes (.), (..) and
// (...), (group), @slot, _private, and the dynamic segments [param], [...param] and [[...param]]. A
// dynamic segment's name is a key of params, so it is camelCase as in the Next.js docs.
const appRouteDirectoryName = new RegExp(
  String.raw`^(?:\(\.\)|\(\.\.\.\)|(?:\(\.\.\))+)?(?:${kebabCase}|\(${kebabCase}\)|@${kebabCase}|_${kebabCase}|\[(?:\.\.\.)?${routeParam}\]|\[\[\.\.\.${routeParam}\]\])$`,
);

/** Creates the path naming plugin for the caller's project root, Next.js route directory conventions included. */
export default function createNamingPlugin(projectRoot) {
  // ESLint handles only source files, so this covers only source files and their directories; CSS,
  // images, Markdown and the like are not checked.
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
