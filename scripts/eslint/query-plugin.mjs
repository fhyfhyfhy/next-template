import { basename } from "node:path";

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

const MUTATION_CALLBACKS = new Set([
  "onMutate",
  "onSuccess",
  "onError",
  "onSettled",
]);

/** 阻止 useMutation 的回调覆盖 mutationOptions 工厂里的回调，否则工厂负责的缓存更新会丢失。 */
export const mutationCallbacksRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      callback:
        "Keep {{name}} out of useMutation: it replaces the mutationOptions factory's callback and the cache updates in it. Keep cache updates and onMutate in the factory; put this caller's onSuccess, onError, or onSettled reaction in mutate(variables, { ... }).",
    },
  },
  create(context) {
    return {
      'CallExpression[callee.name="useMutation"] > ObjectExpression > Property'(
        node,
      ) {
        const name = node.computed
          ? undefined
          : (node.key.name ?? node.key.value);
        if (MUTATION_CALLBACKS.has(name)) {
          context.report({ node, messageId: "callback", data: { name } });
        }
      },
    };
  },
};

const QUERY_FACTORIES = new Set(["queryOptions", "infiniteQueryOptions"]);
const WRITE_VERBS = new Set(["create", "update", "delete"]);

/**
 * api 文件按 HTTP 方法命名、一个文件一个接口（.claude/rules/data-fetching-api.md 的 Files），工厂跟着接口走：
 * get- 文件不放 mutationOptions，create-、update-、delete- 文件不放 query 工厂。领域动词（retry-、search-）
 * 不对应固定的方法，不检查。只认从 @/lib/react-query 引入的工厂，包括改名引入。
 */
export const apiFileFactoriesRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      query:
        "{{factory}} reads a GET endpoint, but {{file}} holds a write. Move it to the get- file of the endpoint it reads: one endpoint per file, named after its HTTP method (Files in .claude/rules/data-fetching-api.md).",
      mutation:
        "mutationOptions builds a write, but {{file}} holds a GET. Move it to the file named after the write's HTTP method, such as update- or create-: one endpoint per file (Files in .claude/rules/data-fetching-api.md).",
    },
  },
  create(context) {
    const file = basename(context.filename);
    const verb = file.split("-")[0];
    if (verb !== "get" && !WRITE_VERBS.has(verb)) return {};
    // 本地名 → 引入名，覆盖 import { queryOptions as listOptions }。
    const factories = new Map();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== WRAPPER_SOURCE) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported.name ?? specifier.imported.value;
          factories.set(specifier.local.name, imported);
        }
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const factory = factories.get(node.callee.name);
        if (verb === "get" && factory === "mutationOptions") {
          context.report({ node, messageId: "mutation", data: { file } });
        } else if (verb !== "get" && QUERY_FACTORIES.has(factory)) {
          context.report({
            node,
            messageId: "query",
            data: { factory, file },
          });
        }
      },
    };
  },
};
