import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";

export const SOURCE_EXTENSIONS = [
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
];
export const SOURCE_GLOB = `**/*.{${SOURCE_EXTENSIONS.join(",")}}`;

export function featurePath(projectRoot, filename) {
  const parts = relative(projectRoot, filename).split(sep);
  return parts[0] === "features" && parts[1] ? parts.slice(1) : null;
}

/** app/ 下文件相对 app/ 的路径段；不在 app/ 下时为 null。 */
export function appPath(projectRoot, filename) {
  const parts = relative(projectRoot, filename).split(sep);
  return parts[0] === "app" && parts.length > 1 ? parts.slice(1) : null;
}

/** import 的 source 节点指向的模块：字符串，或不带表达式的模板字符串；其余情况为 null。 */
export function importSpecifier(source) {
  if (!source) return null;
  const specifier =
    source.type === "TemplateLiteral" && source.expressions.length === 0
      ? source.quasis[0].value.cooked
      : source.value;
  return typeof specifier === "string" ? specifier : null;
}

/**
 * 文件引用模块的每种写法对应的 ESLint visitor：import、re-export、动态 import、`import("…")` 类型、
 * `import … = require()` 和 require()。每个都调用 check(source, node)：source 是指向模块的节点，交给
 * importSpecifier 读（不带 `from` 的 export 为 null），node 是引用它的节点。检查文件引用了什么的规则都经过
 * 这里，新增一种写法所有规则都会查到。
 */
export function importVisitors(check) {
  return {
    ImportDeclaration: (node) => check(node.source, node),
    ExportNamedDeclaration: (node) => check(node.source, node),
    ExportAllDeclaration: (node) => check(node.source, node),
    ImportExpression: (node) => check(node.source, node),
    TSImportType: (node) => check(node.source, node),
    TSImportEqualsDeclaration: (node) => {
      if (node.moduleReference.type === "TSExternalModuleReference") {
        check(node.moduleReference.expression, node);
      }
    },
    CallExpression: (node) => {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "require" &&
        node.arguments.length === 1
      ) {
        check(node.arguments[0], node);
      }
    },
  };
}

/** 解析项目依赖；host 可跟踪配置和解析路径，供调用方判断缓存是否失效。 */
export function createProjectResolver(projectRoot, host = ts.sys) {
  const root = resolve(projectRoot);
  const configPath = ts.findConfigFile(root, host.fileExists, "tsconfig.json");
  let compilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
    resolveJsonModule: true,
  };

  if (configPath) {
    const config = ts.readConfigFile(configPath, host.readFile);
    if (config.error)
      throw new Error(
        ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
      );
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      // 这里只需要解析选项和 extends；枚举 include 的源文件会重复扫描整个项目。
      { ...host, readDirectory: () => [] },
      dirname(configPath),
    );
    // 仅解析选项时不枚举输入文件，因此忽略空输入诊断。
    const errors = parsed.errors.filter((error) => error.code !== 18003);
    if (errors.length) {
      throw new Error(
        errors
          .map((error) =>
            ts.flattenDiagnosticMessageText(error.messageText, "\n"),
          )
          .join("\n"),
      );
    }
    compilerOptions = parsed.options;
  }

  // packages 为 true 时也解析包名，返回 TypeScript 解析到的文件的真实路径：workspace 包是它在仓库内的路径，
  // 不是 node_modules 里的链接；包带类型声明时是它的 .d.ts。
  return (filename, specifier, { packages = false } = {}) => {
    if (typeof specifier !== "string") return null;
    const isRelative = /^(?:\.{1,2})(?:\/|$)/.test(specifier);
    const isAlias = specifier.startsWith("@/");
    if (!isRelative && !isAlias) {
      if (!packages) return null;
      const target = ts.resolveModuleName(
        specifier,
        filename,
        compilerOptions,
        host,
      ).resolvedModule?.resolvedFileName;
      return target ? { target: resolve(target), isRelative, isAlias } : null;
    }

    const fallback = isAlias
      ? resolve(root, specifier.slice(2))
      : resolve(dirname(filename), specifier);
    const target =
      ts.resolveModuleName(specifier, filename, compilerOptions, host)
        .resolvedModule?.resolvedFileName ?? fallback;
    return { target: resolve(target), isRelative, isAlias };
  };
}
