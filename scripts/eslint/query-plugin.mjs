import { basename } from "node:path";

const WRAPPER_SOURCE = "@/lib/react-query";
const PACKAGE_SOURCE = "@tanstack/react-query";

/**
 * Makes the rules of `@tanstack/eslint-plugin-query` recognize the APIs imported through
 * `@/lib/react-query`. The plugin treats only imports from `@tanstack/*-query` as TanStack Query, and
 * project code may import only from the wrapper, so without this rewrite prefer-query-options,
 * no-unstable-deps, no-rest-destructuring and stable-query-client would never report anything.
 * eslint.config.test.mjs covers these four rules.
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
      // The plugin reads the source from specifier.parent.source.value, so the specifier must point to
      // the rewritten node too.
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

/** Stops useMutation's callbacks from overriding those in the mutationOptions factory, which would lose the cache updates the factory owns. */
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
 * An api file is named after its HTTP method, one endpoint per file (Files in
 * .claude/rules/data-fetching-api.md), and the factories go with the endpoint: no mutationOptions in a
 * get- file, and no query factory in a create-, update- or delete- file. Domain verbs (retry-,
 * search-) map to no fixed method and are not checked. Only factories imported from
 * @/lib/react-query count, those imported under another name included.
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
    // Local name → imported name, which covers import { queryOptions as listOptions }.
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
