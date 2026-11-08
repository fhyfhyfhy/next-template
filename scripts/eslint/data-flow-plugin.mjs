import { relative, sep } from "node:path";

// 服务端代码直接调用 feature 的数据层，不经 HTTP 请求本 app 自己的 Route Handler（.claude/rules/data-flow.md 的
// Transport）。只检查确定只在服务端运行的文件里直接写出的 fetchApi 调用；经辅助函数间接发出的请求查不到。

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
    return node.quasis[0].value.cooked.startsWith("/");
  }
  return false;
}

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

  return {
    rules: {
      "no-server-self-fetch": noServerSelfFetchRule,
      "server-only": serverOnlyRule,
    },
  };
}
