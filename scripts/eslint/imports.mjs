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

/** Resolves the project's imports; host can track the config and resolved paths, so the caller can tell when its cache is stale. */
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
      // Only the options and extends are needed here; listing include's source files would scan the
      // whole project again.
      { ...host, readDirectory: () => [] },
      dirname(configPath),
    );
    // Parsing only the options lists no input files, so the no-inputs diagnostic is ignored.
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

  // With packages true it resolves package names too, returning the real path TypeScript resolves
  // them to (a workspace package resolves to its source in the repo).
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
