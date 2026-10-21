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

  return (filename, specifier) => {
    if (typeof specifier !== "string") return null;
    const isRelative = /^(?:\.{1,2})(?:\/|$)/.test(specifier);
    const isAlias = specifier.startsWith("@/");
    if (!isRelative && !isAlias) return null;

    const fallback = isAlias
      ? resolve(root, specifier.slice(2))
      : resolve(dirname(filename), specifier);
    const target =
      ts.resolveModuleName(specifier, filename, compilerOptions, host)
        .resolvedModule?.resolvedFileName ?? fallback;
    return { target: resolve(target), isRelative, isAlias };
  };
}
