import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { createProjectResolver, SOURCE_EXTENSIONS } from "./imports.mjs";

// 检查每个 ClientMessages 发的 namespace 和它下面 Client Component 实际用到的是否一致，约定见
// .claude/rules/i18n.md「Reading messages」。拿不准时多算不少算；分析不了的写法直接报错，不悄悄跳过。

const ALL = "*";
const SOURCE_EXTENSION_SET = new Set(SOURCE_EXTENSIONS.map((ext) => `.${ext}`));
const CLIENT_MESSAGES_MODULE = "lib/i18n/client-messages";
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git"]);
// Next 的嵌套顺序是 layout > template > error > loading > not-found > page（文档 project-structure 的
// Component hierarchy）；forbidden、unauthorized 和 not-found 同级。
const BOUNDARY_FILES = [
  "error",
  "loading",
  "not-found",
  "forbidden",
  "unauthorized",
];
const ROUTE_FILE_NAMES = new Set([
  "layout",
  "template",
  ...BOUNDARY_FILES,
  "page",
  "default",
  "global-error",
  "global-not-found",
]);
const SCOPE_HOSTS = new Set(["layout", "template", "page"]);
const MDX = /\.mdx?$/;

function fileVersion(stat) {
  return stat
    ? `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`
    : null;
}

const toPosix = (path) => path.split(sep).join("/");

function isSourceFile(filename) {
  return (
    SOURCE_EXTENSION_SET.has(extname(filename)) &&
    !/\.d\.[cm]?ts$/.test(filename)
  );
}

function scriptKind(filename) {
  const extension = extname(filename);
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if ([".ts", ".mts", ".cts"].includes(extension)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JSX;
}

function stringValue(node) {
  return node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function hasModifier(node, flag) {
  return (ts.getCombinedModifierFlags(node) & flag) !== 0;
}

function bindingNames(name, names = []) {
  if (ts.isIdentifier(name)) names.push(name.text);
  else
    for (const element of name.elements)
      if (!ts.isOmittedExpression(element)) bindingNames(element.name, names);
  return names;
}

// 类型位置在运行时不存在；extends 子句虽然是 ExpressionWithTypeArguments，引用的却是运行时的值。
function isTypeOnlyNode(node) {
  return ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node);
}

// 标识符引用了某个绑定，而不是声明名、属性名、JSX 属性名这类位置。
function isReference(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent)) return parent.expression === node;
  if (ts.isQualifiedName(parent)) return parent.left === node;
  if (
    ts.isPropertyAssignment(parent) ||
    ts.isBindingElement(parent) ||
    ts.isPropertyDeclaration(parent)
  )
    return parent.initializer === node;
  if (
    ts.isVariableDeclaration(parent) ||
    ts.isParameter(parent) ||
    ts.isFunctionDeclaration(parent) ||
    ts.isFunctionExpression(parent) ||
    ts.isClassDeclaration(parent) ||
    ts.isClassExpression(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isGetAccessorDeclaration(parent) ||
    ts.isSetAccessorDeclaration(parent)
  )
    return parent.name !== node;
  return !(
    ts.isJsxAttribute(parent) ||
    ts.isJsxClosingElement(parent) ||
    ts.isImportSpecifier(parent) ||
    ts.isExportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isLabeledStatement(parent) ||
    ts.isBreakOrContinueStatement(parent)
  );
}

/** 解析一个模块里和 namespace 检查有关的事实：只看语法，不解析 import 指向哪里。 */
export function parseModule(filename, text) {
  const sourceFile = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filename),
  );
  const mod = {
    sourceFile,
    directives: new Set(),
    // 模块自己的代码带来的依赖，kind 为 static、side-effect 或 dynamic（动态 import 和 require）。
    edges: [],
    dynamicEdges: new Map(),
    // export … from 按导出名记录，只有用到的名字才沿着走。
    reexports: new Map(),
    stars: [],
    localExports: new Set(),
    exportAliases: new Map(),
    bindings: new Map(),
    namespaces: [],
    problems: [],
    tags: new Map(),
    elements: [],
  };
  const range = (node) => ({
    start: node.getStart(sourceFile),
    end: node.getEnd(),
  });
  const problem = (node, messageId) =>
    mod.problems.push({ messageId, data: {}, ...range(node) });

  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    )
      break;
    mod.directives.add(statement.expression.text);
  }

  const useTranslations = new Set();
  const intlNamespaces = new Set();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = stringValue(statement.moduleSpecifier);
      const clause = statement.importClause;
      // MDX 里渲染的组件要经过 MDX 编译才看得到，这里还不支持。
      if (MDX.test(specifier ?? "")) problem(statement, "mdx");
      if (!clause) {
        mod.edges.push({ kind: "side-effect", specifier, symbols: ALL });
        continue;
      }
      if (clause.isTypeOnly) continue;
      const symbols = new Set();
      let all = false;
      if (clause.name) {
        symbols.add("default");
        mod.bindings.set(clause.name.text, { specifier, imported: "default" });
      }
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named)) {
        all = true;
        mod.bindings.set(named.name.text, { specifier, imported: ALL });
        if (specifier === "next-intl") intlNamespaces.add(named.name.text);
      } else if (named) {
        for (const element of named.elements) {
          if (element.isTypeOnly) continue;
          const imported = (element.propertyName ?? element.name).text;
          symbols.add(imported);
          mod.bindings.set(element.name.text, { specifier, imported });
          if (specifier === "next-intl" && imported === "useTranslations")
            useTranslations.add(element.name.text);
          // useExtracted 的文案从源码抽取，没有 namespace 可查。
          if (specifier === "next-intl" && imported === "useExtracted")
            problem(element, "unsupported");
          if (
            imported === "ClientMessages" ||
            imported === "RootClientMessages"
          )
            mod.tags.set(element.name.text, { specifier, imported });
        }
      }
      // 全是类型的 import 编译后不剩运行时依赖。
      if (all || symbols.size)
        mod.edges.push({
          kind: "static",
          specifier,
          symbols: all ? ALL : symbols,
        });
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference)
    ) {
      const specifier = stringValue(statement.moduleReference.expression);
      mod.bindings.set(statement.name.text, { specifier, imported: ALL });
      mod.edges.push({ kind: "static", specifier, symbols: ALL });
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const specifier = stringValue(statement.moduleSpecifier);
      const clause = statement.exportClause;
      if (specifier && !clause) {
        mod.stars.push(specifier);
        if (specifier === "next-intl") problem(statement, "indirectUse");
      } else if (specifier && ts.isNamespaceExport(clause)) {
        mod.reexports.set(clause.name.text, { specifier, symbols: ALL });
      } else if (clause) {
        for (const element of clause.elements) {
          if (element.isTypeOnly) continue;
          const local = (element.propertyName ?? element.name).text;
          if (specifier) {
            mod.reexports.set(element.name.text, {
              specifier,
              symbols: new Set([local]),
            });
            if (specifier === "next-intl" && local === "useTranslations")
              problem(element, "indirectUse");
          } else {
            mod.exportAliases.set(element.name.text, local);
            if (useTranslations.has(local)) problem(element, "indirectUse");
          }
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      mod.localExports.add("default");
    } else if (hasModifier(statement, ts.ModifierFlags.Export)) {
      if (hasModifier(statement, ts.ModifierFlags.Default))
        mod.localExports.add("default");
      else if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          for (const name of bindingNames(declaration.name))
            mod.localExports.add(name);
      else if (statement.name && ts.isIdentifier(statement.name))
        mod.localExports.add(statement.name.text);
    }
  }

  const isUseTranslations = (node) =>
    (ts.isIdentifier(node) && useTranslations.has(node.text)) ||
    (ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      intlNamespaces.has(node.expression.text) &&
      node.name.text === "useTranslations");

  function dynamicEdge(call, isRequire) {
    const argument = call.arguments[0];
    const specifier = stringValue(argument);
    let edge = null;
    if (specifier !== null)
      edge = { kind: "dynamic", specifier, symbols: ALL, ...range(call) };
    else if (!isRequire && argument && ts.isTemplateExpression(argument)) {
      // bundler 把带变量的路径当成一个目录下的一组文件，所以路径要从一个目录开始。
      const prefix = argument.head.text;
      if (/^(?:\.{1,2}\/|@\/)/.test(prefix))
        edge = {
          kind: "dynamic",
          pattern: {
            prefix,
            suffix: argument.templateSpans.at(-1).literal.text,
          },
          symbols: ALL,
          ...range(call),
        };
    }
    if (!edge) return problem(call, "dynamicImport");
    mod.edges.push(edge);
    mod.dynamicEdges.set(call, edge);
  }

  function visit(node) {
    if (
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      isTypeOnlyNode(node)
    )
      return;
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
        dynamicEdge(node, false);
      else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length
      )
        dynamicEdge(node, true);
      else if (isUseTranslations(node.expression)) {
        const argument = node.arguments[0];
        const namespace = stringValue(argument);
        if (!argument) problem(node, "missingNamespace");
        else if (namespace === null) problem(argument, "literalNamespace");
        else
          mod.namespaces.push({
            namespace: namespace.split(".")[0],
            ...range(argument),
          });
      }
    }
    // 只认直接调用：赋给别的变量或作为参数传出去以后，调用处的 namespace 就查不到了。
    if (
      ((ts.isIdentifier(node) && useTranslations.has(node.text)) ||
        (ts.isPropertyAccessExpression(node) && isUseTranslations(node))) &&
      isReference(node) &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node)
    )
      problem(node, "indirectUse");
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (
      opening &&
      ts.isIdentifier(opening.tagName) &&
      mod.tags.has(opening.tagName.text)
    ) {
      const element = {
        local: opening.tagName.text,
        namespaces: null,
        list: null,
        tagRange: range(opening.tagName),
        ...range(node),
      };
      for (const attribute of opening.attributes.properties) {
        if (
          !ts.isJsxAttribute(attribute) ||
          attribute.name.getText(sourceFile) !== "namespaces"
        )
          continue;
        const expression = attribute.initializer?.expression;
        if (
          expression &&
          ts.isArrayLiteralExpression(expression) &&
          expression.elements.every((item) => stringValue(item) !== null)
        ) {
          element.namespaces = expression.elements.map(stringValue);
          element.list = range(expression);
        }
      }
      mod.elements.push(element);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return mod;
}

function topLevelDeclarations(sourceFile) {
  const declarations = new Map();
  for (const statement of sourceFile.statements) {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name
    )
      declarations.set(statement.name.text, statement);
    else if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        for (const name of bindingNames(declaration.name))
          declarations.set(name, declaration);
  }
  return declarations;
}

function defaultExport(mod, declarations) {
  for (const statement of mod.sourceFile.statements) {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      hasModifier(statement, ts.ModifierFlags.Export) &&
      hasModifier(statement, ts.ModifierFlags.Default)
    )
      return statement;
    if (ts.isExportAssignment(statement) && !statement.isExportEquals)
      return ts.isIdentifier(statement.expression)
        ? (declarations.get(statement.expression.text) ?? statement.expression)
        : statement.expression;
  }
  const local = mod.exportAliases.get("default");
  return local === undefined ? null : (declarations.get(local) ?? null);
}

/**
 * 把 route 文件渲染用到的依赖分到 ClientMessages 元素的里外两侧。从默认导出出发，经由同文件的顶层
 * 声明继续找；generateMetadata 这类不渲染的导出不算。watched 里的名字（children 和 slot）出现在元素
 * 外面时记下位置，它们下面的 route 就收不到这一层的文案。
 */
function routeReferences(mod, element, watched) {
  const { sourceFile } = mod;
  const declarations = topLevelDeclarations(sourceFile);
  const root = defaultExport(mod, declarations);
  const inside = [];
  const outside = [];
  const watchedOutside = [];
  if (!root) {
    const reexported = mod.reexports.get("default");
    outside.push(...(reexported ? [reexported] : mod.edges));
    return { inside, outside, watchedOutside };
  }
  const expanded = new Set();
  function collect(node, fixedInside) {
    function visit(child) {
      if (isTypeOnlyNode(child)) return;
      const isInside =
        fixedInside ??
        Boolean(
          element &&
          child.getStart(sourceFile) >= element.start &&
          child.getEnd() <= element.end,
        );
      const side = isInside ? inside : outside;
      if (mod.dynamicEdges.has(child)) side.push(mod.dynamicEdges.get(child));
      if (ts.isIdentifier(child) && isReference(child)) {
        const name = child.text;
        const at = { start: child.getStart(sourceFile), end: child.getEnd() };
        if (element && !isInside && watched.has(name))
          watchedOutside.push({ name, ...at });
        if (mod.bindings.has(name)) {
          const { specifier, imported } = mod.bindings.get(name);
          side.push({
            specifier,
            symbols: imported === ALL ? ALL : new Set([imported]),
            ...at,
          });
        } else if (declarations.has(name) && declarations.get(name) !== root) {
          const key = `${name}\0${isInside}`;
          if (!expanded.has(key)) {
            expanded.add(key);
            collect(declarations.get(name), isInside);
          }
        }
      }
      ts.forEachChild(child, visit);
    }
    visit(node);
  }
  collect(root, undefined);
  // 副作用 import 不渲染东西，但可能往注册表里登记组件，按这个文件渲染的主体算。
  (element ? inside : outside).push(
    ...mod.edges.filter((edge) => edge.kind === "side-effect"),
  );
  return { inside, outside, watchedOutside };
}

/**
 * 创建检查器。filename 是绝对路径，sourceText 可以是未保存的内容，其余文件以磁盘为准。返回当前文件
 * 的问题：start、end 是 sourceText 里的偏移；fix 给出要替换的范围和文本。
 */
export function createClientNamespaceChecker(projectRoot) {
  const root = resolve(projectRoot);
  const realRoot = realpathSync(root);
  const diskModules = new Map();
  let snapshot = new Map();
  let resolveImport;
  let resolverDependencies = new Map();
  let resolverRevision = 0;
  let analysis = null;

  function readStat(filename) {
    const path = resolve(filename);
    if (!snapshot.has(path))
      snapshot.set(path, statSync(path, { throwIfNoEntry: false }));
    return snapshot.get(path);
  }

  function refreshResolver() {
    if (
      resolveImport &&
      [...resolverDependencies].every(
        ([filename, version]) => fileVersion(readStat(filename)) === version,
      )
    )
      return;
    resolverDependencies = new Map();
    // 跟踪 tsconfig、package.json 和解析时探测过的路径，新增的文件也会让解析结果失效。
    const track = (filename) => {
      const stat = readStat(filename);
      resolverDependencies.set(resolve(filename), fileVersion(stat));
      return stat;
    };
    resolveImport = createProjectResolver(root, {
      ...ts.sys,
      fileExists: (filename) => track(filename)?.isFile() ?? false,
      directoryExists: (directory) => track(directory)?.isDirectory() ?? false,
      readFile: (filename) => {
        track(filename);
        return ts.sys.readFile(filename);
      },
      realpath: (filename) => {
        track(filename);
        return ts.sys.realpath(filename);
      },
    });
    resolverRevision++;
  }

  function diskModule(filename) {
    const stat = readStat(filename);
    if (!stat?.isFile()) return null;
    const version = fileVersion(stat);
    let cached = diskModules.get(filename);
    if (cached?.version !== version) {
      const text = readFileSync(filename, "utf8");
      cached = {
        version,
        text,
        mod: cached?.text === text ? cached.mod : parseModule(filename, text),
      };
      diskModules.set(filename, cached);
    }
    return cached;
  }

  function analyze(override) {
    const deps = new Map();
    const issues = new Map();
    const scopes = [];
    const routeFiles = new Set();
    const resolutions = new Map();
    let packageImports;

    const depend = (path) => {
      const stat = readStat(path);
      deps.set(resolve(path), fileVersion(stat));
      return stat;
    };
    const getModule = (filename) => {
      if (override?.file === filename) return override.mod;
      depend(filename);
      return diskModule(filename)?.mod ?? null;
    };
    const report = (file, issue) => {
      if (!issues.has(file)) issues.set(file, []);
      issues.get(file).push(issue);
    };
    const display = (file) => toPosix(relative(root, file));

    // 和 bundler 一样按条件选分支：服务端取 react-server，浏览器取 browser 或 default。
    const packageImport = (specifier, context) => {
      if (packageImports === undefined) {
        const manifest = join(root, "package.json");
        depend(manifest);
        try {
          packageImports =
            JSON.parse(readFileSync(manifest, "utf8")).imports ?? {};
        } catch {
          packageImports = {};
        }
      }
      const conditions =
        context === "client"
          ? ["browser", "import", "default"]
          : ["react-server", "node", "import", "default"];
      let target = packageImports[specifier];
      while (target && typeof target === "object")
        target = target[conditions.find((name) => name in target)];
      return typeof target === "string" ? [resolve(root, target)] : [];
    };

    const listFiles = (directory, files = []) => {
      if (!depend(directory)?.isDirectory()) return files;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORED_DIRECTORIES.has(entry.name)) listFiles(path, files);
        } else if (entry.isFile()) files.push(path);
      }
      return files;
    };

    // TypeScript 解析包名时返回真实路径；项目根目录本身经过软链接时（比如 macOS 的 /var），要换回
    // 根目录下的写法，缓存和报告用的路径才和 ESLint 传进来的一致。
    const inProject = (target) => {
      for (const base of [root, realRoot]) {
        const path = relative(base, target);
        if (!path.startsWith("..") && !path.startsWith(sep) && path !== target)
          return path.split(sep).includes("node_modules")
            ? null
            : join(root, path);
      }
      return null;
    };
    const resolveSpecifier = (from, specifier) => {
      const key = `${dirname(from)}\0${specifier}`;
      if (!resolutions.has(key)) {
        const target = resolveImport(from, specifier, {
          packages: true,
        })?.target;
        // 第三方包不会用项目的 namespace；workspace 包解析到仓库里的源码，照常往下走。
        resolutions.set(key, target ? inProject(target) : null);
      }
      return resolutions.get(key);
    };

    const resolveEdge = (from, edge, context) => {
      let targets = [];
      if (edge.pattern) {
        const { prefix, suffix } = edge.pattern;
        const slash = prefix.lastIndexOf("/");
        const directoryPart = prefix.slice(0, slash + 1);
        const filePrefix = prefix.slice(slash + 1);
        const directory = directoryPart.startsWith("@/")
          ? resolve(root, directoryPart.slice(2))
          : resolve(dirname(from), directoryPart);
        targets = listFiles(directory).filter((file) => {
          const rest = toPosix(relative(directory, file));
          return rest.startsWith(filePrefix) && rest.endsWith(suffix);
        });
      } else if (edge.specifier?.startsWith("#")) {
        targets = packageImport(edge.specifier, context);
      } else if (edge.specifier) {
        const target = resolveSpecifier(from, edge.specifier);
        if (target) targets = [target];
      }
      return targets.filter(isSourceFile);
    };

    const startStates = (from, edges, context) =>
      edges.flatMap((edge) =>
        resolveEdge(from, edge, context).map((file) => ({
          file,
          symbols: edge.symbols,
          context,
        })),
      );

    // 沿依赖走，收集 Client 端模块用到的 namespace，各记一个用到它的文件当例子。
    const namespacesFrom = (states) => {
      const found = new Map();
      const seen = new Set();
      const stack = [...states];
      while (stack.length) {
        const { file, symbols, context: incoming } = stack.pop();
        const key = `${file}\0${incoming}\0${symbols === ALL ? ALL : [...symbols].sort().join(",")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const mod = getModule(file);
        if (!mod) continue;
        const context = mod.directives.has("use client") ? "client" : incoming;
        // Client 端拿到的 Server Action 只是引用，模块本身不进客户端。
        if (context === "client" && mod.directives.has("use server")) continue;
        let ownCode = symbols === ALL;
        const next = [];
        if (symbols === ALL) {
          next.push(...mod.reexports.values());
          for (const specifier of mod.stars)
            next.push({ specifier, symbols: ALL });
        } else {
          // 没有 ESM 导出的模块（比如 CommonJS）看不出名字来自哪里，整个算上。
          const hasExports =
            mod.localExports.size > 0 ||
            mod.reexports.size > 0 ||
            mod.exportAliases.size > 0 ||
            mod.stars.length > 0;
          for (const name of symbols) {
            const local = mod.exportAliases.get(name);
            if (mod.reexports.has(name)) next.push(mod.reexports.get(name));
            else if (local !== undefined && mod.bindings.has(local)) {
              const { specifier, imported } = mod.bindings.get(local);
              next.push({
                specifier,
                symbols: imported === ALL ? ALL : new Set([imported]),
              });
            } else if (
              mod.localExports.has(name) ||
              local !== undefined ||
              !hasExports
            )
              ownCode = true;
            else
              for (const specifier of mod.stars)
                next.push({ specifier, symbols: new Set([name]) });
          }
        }
        if (ownCode) {
          next.push(...mod.edges);
          if (context === "client")
            for (const { namespace } of mod.namespaces)
              if (!found.has(namespace)) found.set(namespace, file);
        }
        stack.push(...startStates(file, next, context));
      }
      return found;
    };

    const isClientMessagesModule = (file, specifier) => {
      const resolved = resolveImport(file, specifier);
      return (
        Boolean(resolved) &&
        toPosix(relative(root, resolved.target)).replace(/\.[^.]+$/, "") ===
          CLIENT_MESSAGES_MODULE
      );
    };

    const addRequired = (scope, file, found, at) => {
      for (const [namespace, example] of found) {
        if (scope) {
          if (!scope.required.has(namespace))
            scope.required.set(namespace, example);
        } else
          report(file, {
            messageId: "outside",
            data: { namespace, example: display(example) },
            ...at,
          });
      }
    };

    function routeFile(file, { kind, outer, isRoot = false, slots = [] }) {
      routeFiles.add(file);
      const mod = getModule(file);
      if (!mod) return outer;
      const { sourceFile } = mod;
      const isClient = mod.directives.has("use client");
      const exported = defaultExport(mod, topLevelDeclarations(sourceFile));
      const anchor = exported?.name ?? exported;
      const at = anchor
        ? { start: anchor.getStart(sourceFile), end: anchor.getEnd() }
        : { start: 0, end: 0 };
      const elements = mod.elements.filter((element) =>
        isClientMessagesModule(file, mod.tags.get(element.local).specifier),
      );
      for (const extra of elements.slice(1))
        report(file, { messageId: "onePerFile", data: {}, ...extra.tagRange });

      let scope = null;
      const element = elements[0];
      const tag = element && mod.tags.get(element.local).imported;
      if (!element) {
        if (kind === "layout" && isRoot)
          report(file, { messageId: "rootRequired", data: {}, ...at });
      } else if (!SCOPE_HOSTS.has(kind) || isClient)
        report(file, {
          messageId: "placement",
          data: { tag },
          ...element.tagRange,
        });
      else if (tag === "RootClientMessages" && !(kind === "layout" && isRoot))
        report(file, {
          messageId: "rootPlacement",
          data: {},
          ...element.tagRange,
        });
      else if (tag === "ClientMessages" && kind === "layout" && isRoot)
        report(file, {
          messageId: "rootRequired",
          data: {},
          ...element.tagRange,
        });
      else if (!element.namespaces)
        report(file, {
          messageId: "literalList",
          data: {},
          ...element.tagRange,
        });
      else {
        scope = {
          file,
          tag,
          list: element.namespaces,
          range: element.list,
          parent: outer,
          children: [],
          required: new Map(),
        };
        outer?.children.push(scope);
        scopes.push(scope);
      }

      if (isClient) {
        // error.tsx、global-error.tsx 这类 Client 文件：整个文件都在客户端渲染。
        addRequired(
          outer,
          file,
          namespacesFrom([{ file, symbols: ALL, context: "client" }]),
          at,
        );
      } else {
        const watched = new Set(
          kind === "layout" || kind === "template"
            ? ["children", ...slots]
            : [],
        );
        const { inside, outside, watchedOutside } = routeReferences(
          mod,
          scope ? element : null,
          watched,
        );
        for (const { name, start, end } of watchedOutside)
          report(file, {
            messageId: "childrenOutside",
            data: { name, tag },
            start,
            end,
          });
        if (scope)
          addRequired(
            scope,
            file,
            namespacesFrom(startStates(file, inside, "server")),
            at,
          );
        if (outer)
          addRequired(
            outer,
            file,
            namespacesFrom(startStates(file, outside, "server")),
            at,
          );
        else
          // 不在任何 ClientMessages 里：逐个引用查，问题报在引用的位置。
          for (const edge of outside)
            addRequired(
              null,
              file,
              namespacesFrom(startStates(file, [edge], "server")),
              edge.start === undefined
                ? at
                : { start: edge.start, end: edge.end },
            );
      }
      return scope && (kind === "layout" || kind === "template")
        ? scope
        : outer;
    }

    function segment(directory, outer, layoutAbove, isAppRoot) {
      if (!depend(directory)?.isDirectory()) return;
      const files = new Map();
      const children = [];
      const mdxRoutes = [];
      const entries = readdirSync(directory, { withFileTypes: true }).sort(
        (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
      );
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // _ 开头的是私有目录，不参与路由。
          if (
            !entry.name.startsWith("_") &&
            !IGNORED_DIRECTORIES.has(entry.name)
          )
            children.push(entry.name);
        } else if (entry.isFile()) {
          const extension = extname(entry.name);
          const name = entry.name.slice(0, -extension.length);
          if (!ROUTE_FILE_NAMES.has(name)) continue;
          if (MDX.test(extension)) mdxRoutes.push(join(directory, entry.name));
          else if (isSourceFile(entry.name) && !files.has(name))
            files.set(name, join(directory, entry.name));
        }
      }
      const slots = children
        .filter((name) => name.startsWith("@"))
        .map((name) => name.slice(1));
      const layout = files.get("layout");
      // MDX 写的 route 没有 JS 文件可报，报在包着它的 layout 上。
      for (const mdx of mdxRoutes)
        if (layout ?? layoutAbove)
          report(layout ?? layoutAbove, {
            messageId: "mdxRoute",
            data: { file: display(mdx) },
            start: 0,
            end: 0,
          });
      const afterLayout = layout
        ? routeFile(layout, {
            kind: "layout",
            outer,
            isRoot: !layoutAbove,
            slots,
          })
        : outer;
      const template = files.get("template");
      const afterTemplate = template
        ? routeFile(template, { kind: "template", outer: afterLayout })
        : afterLayout;
      for (const kind of [...BOUNDARY_FILES, "page", "default"])
        if (files.has(kind))
          routeFile(files.get(kind), { kind, outer: afterTemplate });
      if (isAppRoot)
        for (const kind of ["global-error", "global-not-found"])
          if (files.has(kind))
            routeFile(files.get(kind), { kind, outer: null });
      for (const child of children)
        // slot 作为 props 交给 layout；文档没说父级 template 是否包着 slot，按不包处理。
        segment(
          join(directory, child),
          child.startsWith("@") ? afterLayout : afterTemplate,
          layout ?? layoutAbove,
          false,
        );
    }

    const appDirectory = [join(root, "app"), join(root, "src", "app")].find(
      (directory) => depend(directory)?.isDirectory(),
    );
    if (appDirectory) segment(appDirectory, null, null, true);

    // 合并语义：一层发的 namespace 对它下面每一层都有效。外层已经发过的，这一层再写也不算它提供的，
    // 所以往上汇总需求时只扣掉 effective。
    for (const scope of scopes) {
      scope.above = new Map();
      for (let parent = scope.parent; parent; parent = parent.parent)
        for (const namespace of parent.list)
          if (!scope.above.has(namespace)) scope.above.set(namespace, parent);
      scope.effective = new Set(
        scope.list.filter((namespace) => !scope.above.has(namespace)),
      );
    }
    const needs = new Map();
    const need = (scope) => {
      if (!needs.has(scope)) {
        const map = new Map(scope.required);
        for (const child of scope.children)
          for (const [namespace, example] of need(child))
            if (!child.effective.has(namespace) && !map.has(namespace))
              map.set(namespace, example);
        needs.set(scope, map);
      }
      return needs.get(scope);
    };
    for (const scope of scopes) {
      const { above } = scope;
      const needed = need(scope);
      const found = [];
      const kept = [];
      for (const namespace of scope.list) {
        let issue = null;
        if (kept.includes(namespace)) issue = { messageId: "duplicate" };
        else if (above.has(namespace))
          issue = {
            messageId: "repeated",
            data: { owner: display(above.get(namespace).file) },
          };
        else if (!needed.has(namespace)) issue = { messageId: "unused" };
        else kept.push(namespace);
        if (issue)
          found.push({
            ...issue,
            data: { namespace, tag: scope.tag, ...issue.data },
          });
      }
      const missing = [...scope.required]
        .filter(
          ([namespace]) =>
            !scope.list.includes(namespace) && !above.has(namespace),
        )
        .sort(([a], [b]) => (a < b ? -1 : 1));
      for (const [namespace, example] of missing)
        found.push({
          messageId: "missing",
          data: { namespace, tag: scope.tag, example: display(example) },
        });
      const text = `[${[...kept, ...missing.map(([namespace]) => namespace)]
        .map((namespace) => JSON.stringify(namespace))
        .join(", ")}]`;
      for (const issue of found)
        report(scope.file, {
          ...issue,
          ...scope.range,
          fix: { ...scope.range, text },
        });
    }
    return {
      deps,
      issues,
      override,
      resolverRevision,
      routeFiles,
      isClientMessagesModule,
    };
  }

  function isFresh(override) {
    if (!analysis || analysis.resolverRevision !== resolverRevision)
      return false;
    if (
      (analysis.override?.file ?? null) !== (override?.file ?? null) ||
      analysis.override?.text !== override?.text
    )
      return false;
    for (const [path, version] of analysis.deps)
      if (fileVersion(readStat(path)) !== version) return false;
    return true;
  }

  return (filename, sourceText) => {
    snapshot = new Map();
    refreshResolver();
    const file = resolve(filename);
    const disk = diskModule(file);
    const override =
      disk?.text === sourceText
        ? null
        : { file, text: sourceText, mod: parseModule(file, sourceText) };
    const own = override?.mod ?? disk.mod;
    if (!isFresh(override)) analysis = analyze(override);
    // route 之外的文件（feature 组件等）里的 ClientMessages 不在分析的范围里，直接报位置不对。
    const misplaced = analysis.routeFiles.has(file)
      ? []
      : own.elements
          .filter((element) =>
            analysis.isClientMessagesModule(
              file,
              own.tags.get(element.local).specifier,
            ),
          )
          .map((element) => ({
            messageId: "placement",
            data: { tag: own.tags.get(element.local).imported },
            ...element.tagRange,
          }));
    return [
      ...own.problems,
      ...misplaced,
      ...(analysis.issues.get(file) ?? []),
    ];
  };
}
