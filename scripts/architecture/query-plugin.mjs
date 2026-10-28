const WRAPPER_SOURCE = "@/lib/react-query";
const PACKAGE_SOURCE = "@tanstack/react-query";

/**
 * 让 `@tanstack/eslint-plugin-query` 的规则识别经 `@/lib/react-query` 引入的 API。
 * 插件只把 `@tanstack/*-query` 的 import 当作 TanStack Query；项目代码只能从封装引入，
 * 不改写的话 prefer-query-options、no-unstable-deps、no-rest-destructuring、
 * stable-query-client 永远不会报错。eslint.config.test.mjs 覆盖这四条规则。
 */
export default function withWrapperImports(plugin) {
  return {
    ...plugin,
    rules: Object.fromEntries(
      Object.entries(plugin.rules).map(([name, rule]) => [
        name,
        { ...rule, create: (context) => wrapListeners(rule.create(context)) },
      ]),
    ),
  };
}

function wrapListeners(listeners) {
  const onImport = listeners.ImportDeclaration;
  if (!onImport) return listeners;
  return {
    ...listeners,
    ImportDeclaration(node) {
      if (node.source.value !== WRAPPER_SOURCE) return onImport(node);
      // 插件按 specifier.parent.source.value 判断来源，specifier 也要指向改写后的节点。
      const aliased = {
        ...node,
        source: { ...node.source, value: PACKAGE_SOURCE },
      };
      aliased.specifiers = node.specifiers.map((specifier) => ({
        ...specifier,
        parent: aliased,
      }));
      return onImport(aliased);
    },
  };
}
