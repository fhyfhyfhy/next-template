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

// 同目录的 Server Action 模块：./<verb>-<resource>-action，可以带扩展名。
const ACTION_SOURCE = /^\.\/[\w-]+-action(\.[cm]?[jt]s)?$/;

/**
 * api 文件一个文件一个操作，读和写分开（.claude/rules/tanstack-query.md 的 Files），工厂跟着操作走：
 * - get- 文件不放 mutationOptions，create-、update-、delete- 文件不放 query 工厂；
 * - 领域动词的文件（retry-、search-）读写都可能，所以只查同一个文件不同时放两种工厂；
 * - 放 mutationOptions 的文件要 import 同目录的 -action 模块：浏览器的写都走 Server Action
 *   （.claude/rules/server-data.md 的 Server Actions）。只查有没有这个 import，查不到 mutationFn 是否真的调了它。
 * 只认从 @/lib/react-query 引入的工厂，包括改名引入。
 */
export const apiFileFactoriesRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      query:
        "{{factory}} builds a read, but {{file}} holds a write. Move it to the read's own file, such as a get- file: one operation per file (Files in .claude/rules/tanstack-query.md).",
      mutation:
        "mutationOptions builds a write, but {{file}} holds a read. Move it to the write's own file, such as an update- or create- file: one operation per file (Files in .claude/rules/tanstack-query.md).",
      mixed:
        "{{file}} holds both a read and a write. Move mutationOptions to the write's own file: one operation per file (Files in .claude/rules/tanstack-query.md).",
      action:
        "A write's mutationFn calls its Server Action, but {{file}} imports none. Put the action in a sibling <verb>-<resource>-action module and import it here: every write from the browser goes through a Server Action (Server Actions in .claude/rules/server-data.md).",
    },
  },
  create(context) {
    const file = basename(context.filename);
    const verb = file.split("-")[0];
    // 本地名 → 引入名，覆盖 import { queryOptions as listOptions }。
    const factories = new Map();
    const queries = [];
    const mutations = [];
    let importsAction = false;
    return {
      ImportDeclaration(node) {
        if (ACTION_SOURCE.test(node.source.value)) importsAction = true;
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
        if (factory === "mutationOptions") mutations.push(node);
        else if (QUERY_FACTORIES.has(factory)) queries.push({ node, factory });
      },
      "Program:exit"() {
        if (verb === "get") {
          // 这些工厂要搬走，搬到的文件再查它的 action。
          for (const node of mutations) {
            context.report({ node, messageId: "mutation", data: { file } });
          }
          return;
        }
        if (WRITE_VERBS.has(verb)) {
          for (const { node, factory } of queries) {
            context.report({
              node,
              messageId: "query",
              data: { factory, file },
            });
          }
        } else if (queries.length > 0) {
          for (const node of mutations) {
            context.report({ node, messageId: "mixed", data: { file } });
          }
        }
        if (mutations.length > 0 && !importsAction) {
          context.report({
            node: mutations[0],
            messageId: "action",
            data: { file },
          });
        }
      },
    };
  },
};
