import { relative, sep } from "node:path";

// 服务端代码直接调用 feature 的数据层，不经 HTTP 请求本 app 自己的 Route Handler（.claude/rules/data-flow.md 的
// Transport）。只检查确定只在服务端运行的文件里直接写出的 fetchApi 和 fetch 调用；经辅助函数间接发出的请求查不到。

// feature 的服务端层：server/ 和 server.ts 入口。
const FEATURE_SERVER_PATHS = [
  /^features\/[^/]+\/server\//,
  /^features\/[^/]+\/server\.[cm]?[jt]sx?$/,
];

const SERVER_PATHS = [
  ...FEATURE_SERVER_PATHS,
  /^app\/api\//,
  /^(instrumentation|proxy)\.[cm]?[jt]sx?$/,
];

function directives(program) {
  return program.body
    .filter((statement) => statement.type === "ExpressionStatement")
    .map((statement) => statement.directive)
    .filter(Boolean);
}

/** 文件只在服务端运行：服务端目录和入口、"use server" 或 server-only 的模块，以及 app/ 下没有 "use client" 的文件。 */
function isServerFile(path, program) {
  if (SERVER_PATHS.some((pattern) => pattern.test(path))) return true;
  const fileDirectives = directives(program);
  if (fileDirectives.includes("use server")) return true;
  if (fileDirectives.includes("use client")) return false;
  const importsServerOnly = program.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      statement.source.value === "server-only",
  );
  return importsServerOnly || path.startsWith("app/");
}

function isSameOriginPath(node) {
  if (node.type === "Literal") {
    return typeof node.value === "string" && node.value.startsWith("/");
  }
  if (node.type === "TemplateLiteral") {
    const start = node.quasis[0].value.cooked;
    if (start.startsWith("/")) return true;
    // 裸 fetch 的同源路径以 BASE_PATH 开头（lib/base-path.ts）。
    const [first] = node.expressions;
    return (
      start === "" && first?.type === "Identifier" && first.name === "BASE_PATH"
    );
  }
  return false;
}

const SOURCE_FILE = "[cm]?[jt]sx?$";
const ACTION_MODULE = new RegExp(
  `^features/[^/]+/api/[^/]+-action\\.${SOURCE_FILE}`,
);
const SEARCH_PARAMS_MODULE = new RegExp(
  `^features/[^/]+/utils/[^/]+-search-params\\.${SOURCE_FILE}`,
);
const FEATURE_TYPES = /^features\/[^/]+\/types\//;
const TEST_FILE = new RegExp(`\\.(test|spec)\\.${SOURCE_FILE}`);

// z.date()、z.coerce.date() 这类写法；z.iso.date()、z.string().date() 校验的是字符串，不算。
function isZodNamespace(node) {
  if (node.type === "Identifier") return node.name === "z";
  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.object.name === "z" &&
    node.property.name === "coerce"
  );
}
const NON_JSON_TYPES = new Set(["date", "bigint"]);
const NON_JSON_METHODS = new Set(["optional", "transform"]);

export default function createDataFlowPlugin(projectRoot) {
  const noServerSelfFetchRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        selfFetch:
          "Server code calls the feature's data layer directly instead of requesting the app's own Route Handlers. See Transport in .claude/rules/data-flow.md.",
      },
    },
    create(context) {
      const path = relative(projectRoot, context.filename).split(sep).join("/");
      let serverFile = false;
      return {
        Program(node) {
          serverFile = isServerFile(path, node);
        },
        CallExpression(node) {
          if (!serverFile) return;
          if (node.callee.type !== "Identifier") return;
          if (node.callee.name === "fetch") {
            const [input] = node.arguments;
            if (input && isSameOriginPath(input)) {
              context.report({ node: input, messageId: "selfFetch" });
            }
            return;
          }
          if (node.callee.name !== "fetchApi") return;
          const [config] = node.arguments;
          if (config?.type !== "ObjectExpression") return;
          const url = config.properties.find(
            (property) =>
              property.type === "Property" &&
              !property.computed &&
              property.key.type === "Identifier" &&
              property.key.name === "url",
          );
          if (url && isSameOriginPath(url.value)) {
            context.report({ node: url.value, messageId: "selfFetch" });
          }
        },
      };
    },
  };

  // feature 的 server/ 和 server.ts 都 import "server-only"（.claude/rules/server-data.md），在 Next 之外加载的除外：
  // 测试、import 了 vitest 的测试 helper，以及 migration（.claude/rules/data-setup.md 的 Schema changes）。
  const serverOnlyRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        missing:
          'Import "server-only" in this module, so a browser bundle that reaches it fails to build. See .claude/rules/server-data.md.',
      },
    },
    create(context) {
      const path = relative(projectRoot, context.filename).split(sep).join("/");
      if (!FEATURE_SERVER_PATHS.some((pattern) => pattern.test(path))) {
        return {};
      }
      if (/\.(test|spec)\.[cm]?[jt]sx?$|\/migrations\.mts$/.test(path)) {
        return {};
      }
      return {
        Program(node) {
          const sources = node.body
            .filter((statement) => statement.type === "ImportDeclaration")
            .map((statement) => statement.source.value);
          if (sources.includes("server-only") || sources.includes("vitest")) {
            return;
          }
          context.report({
            loc: { line: 1, column: 0 },
            messageId: "missing",
          });
        },
      };
    },
  };

  // Server Action 模块以 "use server" 开头（.claude/rules/server-data.md 的 Server Actions）：没有它，导出的函数
  // 是普通函数，Client Component import 时会把它连同数据层一起打进浏览器的 bundle。
  const actionModuleRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        missing:
          'Start this module with "use server": a file named -action holds a Server Action, and without the directive its export is an ordinary function that a Client Component would bundle. See Server Actions in .claude/rules/server-data.md.',
      },
    },
    create(context) {
      const path = relative(projectRoot, context.filename).split(sep).join("/");
      if (!ACTION_MODULE.test(path) || TEST_FILE.test(path)) return {};
      return {
        Program(node) {
          if (node.body[0]?.directive === "use server") return;
          context.report({ loc: { line: 1, column: 0 }, messageId: "missing" });
        },
      };
    },
  };

  // 一页的 URL 参数定义在 utils/<page>-search-params 里，Server Component 也要用（.claude/rules/data-flow.md 的
  // URL state）：nuqs 的主入口是 client module，这里只能从 nuqs/server 引入。只引类型不受影响。
  const searchParamsImportsRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        client:
          "Import from nuqs/server here: the nuqs entry is a client module, and Server Components read these parsers too. See URL state in .claude/rules/data-flow.md.",
      },
    },
    create(context) {
      const path = relative(projectRoot, context.filename).split(sep).join("/");
      if (!SEARCH_PARAMS_MODULE.test(path) || TEST_FILE.test(path)) return {};
      return {
        ImportDeclaration(node) {
          if (node.source.value !== "nuqs" || node.importKind === "type") {
            return;
          }
          context.report({ node: node.source, messageId: "client" });
        },
      };
    },
  };

  // feature 的 types/ 里的 schema 只描述 JSON 原生的值（.claude/rules/server-data.md 的 Results）：同一份数据
  // 预取时经 RSC、刷新时经 JSON 到浏览器，两边要得到同样的值。optional 和 transform 只在 import 了 zod 的文件里查。
  const jsonNativeSchemaRule = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        type: "z.{{name}}() is not a JSON-native value: data in types/ reaches the browser through RSC on a server prefetch and through JSON on a refetch, and both must produce the same value. Use z.number() with epoch milliseconds for a time, and a string for an integer too large for a number. See Results in .claude/rules/server-data.md.",
        optional:
          "Use .nullable() instead of .optional(): JSON has no undefined, so a missing value is null on the wire. See Results in .claude/rules/server-data.md.",
        transform:
          "Describe the value as it is on the wire, without .transform(): a prefetch through RSC skips the schema, so only the refetch would be transformed. Shape the value in the data layer's mapping function. See Results in .claude/rules/server-data.md.",
      },
    },
    create(context) {
      const path = relative(projectRoot, context.filename).split(sep).join("/");
      if (!FEATURE_TYPES.test(path) || TEST_FILE.test(path)) return {};
      let importsZod = false;
      return {
        ImportDeclaration(node) {
          if (node.source.value === "zod") importsZod = true;
        },
        CallExpression(node) {
          const { callee } = node;
          if (callee.type !== "MemberExpression" || callee.computed) return;
          const { name } = callee.property;
          if (NON_JSON_TYPES.has(name) && isZodNamespace(callee.object)) {
            context.report({ node, messageId: "type", data: { name } });
          } else if (importsZod && NON_JSON_METHODS.has(name)) {
            context.report({ node: callee.property, messageId: name });
          }
        },
      };
    },
  };

  return {
    rules: {
      "no-server-self-fetch": noServerSelfFetchRule,
      "server-only": serverOnlyRule,
      "action-module": actionModuleRule,
      "search-params-imports": searchParamsImportsRule,
      "json-native-schema": jsonNativeSchemaRule,
    },
  };
}
