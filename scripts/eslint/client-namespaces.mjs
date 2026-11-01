import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { createProjectResolver, SOURCE_EXTENSIONS } from "./imports.mjs";

// 检查每个 ClientMessages 发的 namespace 和它包着的 Client Component 实际用到的是否一致，约定见
// .claude/rules/i18n.md「Reading messages」。拿不准时多算不少算；分析不了的写法直接报错，不悄悄跳过。

const ALL = "*";
const CLIENT = "client";
const SERVER = "server";
const SOURCE_EXTENSION_SET = new Set(SOURCE_EXTENSIONS.map((ext) => `.${ext}`));
const DECLARATION_FILE = /\.d\.([cm]?)ts$/;
const MDX = /\.mdx?$/;
const CLIENT_MESSAGES_MODULE = "lib/i18n/client-messages";
// Client 端的 useTranslations 来自这些入口：next-intl 从 use-intl 重新导出。
const INTL_MODULES = new Set(["next-intl", "use-intl", "use-intl/react"]);
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
// 把下面的 route 当作 children（和平行路由的 slot）渲染的文件。
const WRAPPERS = new Set(["layout", "template"]);
// package.json 条件导出里，各环境不会选中的条件；其余分支都可能被 bundler 选中（包括 development）。
// Client Component 既在浏览器、也在服务端渲染，所以只排除 react-server。
const EXCLUDED_CONDITIONS = {
  [CLIENT]: new Set(["react-server"]),
  [SERVER]: new Set(["browser"]),
};

function fileVersion(stat) {
  return stat
    ? `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`
    : null;
}

const toPosix = (path) => path.split(sep).join("/");

function isSourceFile(filename) {
  return (
    SOURCE_EXTENSION_SET.has(extname(filename)) &&
    !DECLARATION_FILE.test(filename)
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

// import 绑定对应的导出名集合：命名空间导入用到整个模块。
const bindingSymbols = ({ imported }) =>
  imported === ALL ? ALL : new Set([imported]);

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

// require.context、import.meta.glob 这类按目录批量加载的写法。
function isContextLoader(callee) {
  if (!ts.isPropertyAccessExpression(callee)) return false;
  const { expression, name } = callee;
  return (
    (ts.isIdentifier(expression) &&
      expression.text === "require" &&
      name.text === "context") ||
    (ts.isMetaProperty(expression) &&
      ["glob", "webpackContext"].includes(name.text))
  );
}

function readDirectives(mod) {
  for (const statement of mod.sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    )
      break;
    mod.directives.add(statement.expression.text);
  }
}

// 顶层的 import、export：依赖、导出名和 next-intl 绑定。
function readTopLevel(context) {
  const { mod, range, problem, intl } = context;
  for (const statement of mod.sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = stringValue(statement.moduleSpecifier);
      const isIntl = INTL_MODULES.has(specifier);
      // MDX 里渲染的组件要经过 MDX 编译才看得到，这里还不支持。
      if (MDX.test(specifier ?? "")) problem(statement, "mdx");
      const at = range(statement.moduleSpecifier);
      const clause = statement.importClause;
      if (!clause) {
        mod.edges.push({ kind: "side-effect", specifier, symbols: ALL, ...at });
        continue;
      }
      if (clause.isTypeOnly) continue;
      const symbols = new Set();
      let all = false;
      if (clause.name) {
        symbols.add("default");
        mod.bindings.set(clause.name.text, { specifier, imported: "default" });
        if (isIntl) intl.objects.add(clause.name.text);
      }
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named)) {
        all = true;
        mod.bindings.set(named.name.text, { specifier, imported: ALL });
        if (isIntl) intl.objects.add(named.name.text);
      } else if (named) {
        for (const element of named.elements) {
          if (element.isTypeOnly) continue;
          const imported = (element.propertyName ?? element.name).text;
          symbols.add(imported);
          mod.bindings.set(element.name.text, { specifier, imported });
          if (isIntl && imported === "useTranslations")
            intl.hooks.add(element.name.text);
          // useExtracted 的文案从源码抽取，没有 namespace 可查。
          if (isIntl && imported === "useExtracted")
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
          ...at,
        });
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference)
    ) {
      const specifier = stringValue(statement.moduleReference.expression);
      mod.bindings.set(statement.name.text, { specifier, imported: ALL });
      if (INTL_MODULES.has(specifier)) intl.objects.add(statement.name.text);
      mod.edges.push({
        kind: "static",
        specifier,
        symbols: ALL,
        ...range(statement.moduleReference),
      });
    } else if (ts.isExportDeclaration(statement)) {
      readExport(context, statement);
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
}

function readExport({ mod, problem, intl }, statement) {
  if (statement.isTypeOnly) return;
  const specifier = stringValue(statement.moduleSpecifier);
  const clause = statement.exportClause;
  // 把 next-intl 转手导出以后，调用方的 useTranslations 就认不出来了。
  if (INTL_MODULES.has(specifier) && (!clause || ts.isNamespaceExport(clause)))
    problem(statement, "indirectUse");
  if (specifier && !clause) mod.stars.push(specifier);
  else if (specifier && ts.isNamespaceExport(clause))
    mod.reexports.set(clause.name.text, { specifier, symbols: ALL });
  else if (clause)
    for (const element of clause.elements) {
      if (element.isTypeOnly) continue;
      const local = (element.propertyName ?? element.name).text;
      if (specifier) {
        mod.reexports.set(element.name.text, {
          specifier,
          symbols: new Set([local]),
        });
        if (INTL_MODULES.has(specifier) && local === "useTranslations")
          problem(element, "indirectUse");
      } else {
        mod.exportAliases.set(element.name.text, local);
        if (intl.hooks.has(local) || intl.objects.has(local))
          problem(element, "indirectUse");
      }
    }
}

// 函数体里的用法：动态 import、useTranslations 的调用、ClientMessages 元素。
function readUsage({ mod, range, problem, intl }) {
  const isUseTranslations = (node) =>
    (ts.isIdentifier(node) && intl.hooks.has(node.text)) ||
    (ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      intl.objects.has(node.expression.text) &&
      node.name.text === "useTranslations");

  function dynamicEdge(call, isRequire) {
    const argument = call.arguments[0];
    const specifier = stringValue(argument);
    let edge = null;
    if (specifier !== null) {
      if (INTL_MODULES.has(specifier)) problem(call, "indirectUse");
      edge = { kind: "dynamic", specifier, symbols: ALL, ...range(call) };
    } else if (!isRequire && argument && ts.isTemplateExpression(argument)) {
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

  function readElement(node, opening) {
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
        attribute.name.getText(mod.sourceFile) !== "namespaces"
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

  function visit(node) {
    if (
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      isTypeOnlyNode(node)
    )
      return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword) dynamicEdge(node, false);
      else if (
        ts.isIdentifier(callee) &&
        callee.text === "require" &&
        node.arguments.length
      )
        dynamicEdge(node, true);
      else if (isContextLoader(callee)) problem(node, "dynamicImport");
      else if (isUseTranslations(callee)) {
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
    // 只认直接调用 useTranslations，以及 next-intl 命名空间对象上的属性访问：赋值、解构、传参以后，
    // 调用处的 namespace 就查不到了。
    if (ts.isIdentifier(node) && isReference(node)) {
      const { parent } = node;
      const isCallee = (target) =>
        ts.isCallExpression(target.parent) &&
        target.parent.expression === target;
      if (intl.hooks.has(node.text) && !isCallee(node))
        problem(node, "indirectUse");
      else if (intl.objects.has(node.text)) {
        if (!ts.isPropertyAccessExpression(parent))
          problem(node, "indirectUse");
        else if (parent.name.text === "useTranslations" && !isCallee(parent))
          problem(parent, "indirectUse");
      }
    }
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (
      opening &&
      ts.isIdentifier(opening.tagName) &&
      mod.tags.has(opening.tagName.text)
    )
      readElement(node, opening);
    ts.forEachChild(node, visit);
  }
  visit(mod.sourceFile);
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
  const context = {
    mod,
    range,
    problem: (node, messageId) =>
      mod.problems.push({ messageId, data: {}, ...range(node) }),
    intl: { hooks: new Set(), objects: new Set() },
  };
  readDirectives(mod);
  readTopLevel(context);
  readUsage(context);
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

function functionLike(node) {
  if (!node) return null;
  if (ts.isVariableDeclaration(node)) return functionLike(node.initializer);
  if (ts.isParenthesizedExpression(node)) return functionLike(node.expression);
  return ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
    ? node
    : null;
}

/**
 * layout、template 的 props 里 children 和 slot 在函数中叫什么：locals 是解构出来的局部名（含改名和
 * ...rest），object 是不解构时的 props 参数名。看不出来（比如默认导出被 HOC 包着）时返回 null。
 */
function propNames(root, props) {
  const fn = functionLike(root);
  if (!fn) return null;
  const locals = new Set();
  const [param] = fn.parameters;
  if (!param) return { locals, object: null };
  if (ts.isIdentifier(param.name)) return { locals, object: param.name.text };
  if (!ts.isObjectBindingPattern(param.name)) return null;
  for (const element of param.name.elements) {
    const key = element.dotDotDotToken
      ? null
      : (stringValue(element.propertyName) ??
        (ts.isIdentifier(element.propertyName ?? element.name)
          ? (element.propertyName ?? element.name).text
          : null));
    if (key === null || props.has(key))
      for (const name of bindingNames(element.name)) locals.add(name);
  }
  return { locals, object: null };
}

/**
 * 把 route 文件渲染用到的依赖分到 ClientMessages 元素的里外两侧。从默认导出出发，经由同文件的顶层
 * 声明继续找；generateMetadata 这类不渲染的导出不算。props 是 layout、template 渲染下面 route 用的
 * props（children 和 slot）：它们出现在元素外面时记下位置，下面的 route 就收不到这一层的文案。
 */
function routeReferences(mod, root, element, props) {
  const { sourceFile } = mod;
  const declarations = topLevelDeclarations(sourceFile);
  const inside = [];
  const outside = [];
  const propsOutside = [];
  if (!root) {
    const reexported = mod.reexports.get("default");
    outside.push(...(reexported ? [reexported] : mod.edges));
    return { inside, outside, propsOutside, propsUnknown: false };
  }
  const names = element && props.size ? propNames(root, props) : null;
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
        if (names && !isInside) {
          const { parent } = child;
          if (names.locals.has(name)) propsOutside.push({ name, ...at });
          // 不解构的 props：只有 props.children 这类访问能看出用的是哪个 prop，别的用法都按用到了算。
          else if (name === names.object) {
            const accessed = ts.isPropertyAccessExpression(parent)
              ? parent.name.text
              : null;
            if (accessed === null || props.has(accessed))
              propsOutside.push({
                name: accessed ? `${name}.${accessed}` : name,
                ...at,
              });
          }
        }
        if (mod.bindings.has(name))
          side.push({
            specifier: mod.bindings.get(name).specifier,
            symbols: bindingSymbols(mod.bindings.get(name)),
            ...at,
          });
        else if (declarations.has(name) && declarations.get(name) !== root) {
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
  return {
    inside,
    outside,
    propsOutside,
    propsUnknown: Boolean(element && props.size && !names),
  };
}

/**
 * 模块依赖图：解析 import 指向哪里，并从一组起点出发收集 Client 端用到的 namespace。
 * getModule 返回解析过的模块，depend 记下读过的文件版本，report 报告某个文件里的问题。
 */
function createModuleGraph({
  root,
  realRoot,
  resolveImport,
  getModule,
  depend,
  report,
}) {
  const resolutions = new Map();
  const manifests = new Map();
  const reported = new Set();

  // TypeScript 解析包名时返回真实路径；项目根目录本身经过软链接时（比如 macOS 的 /var），要换回根目录
  // 下的写法，缓存和报告用的路径才和 ESLint 传进来的一致。node_modules 里的第三方包不用项目的 namespace。
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

  const exists = (file) => depend(file)?.isFile() ?? false;

  // workspace 包的类型声明旁边是 bundler 实际加载的 JS；找不到就没法分析，报错而不是跳过。
  const runtimeFile = (declaration) => {
    const [, kind] = declaration.match(DECLARATION_FILE);
    const base = declaration.replace(DECLARATION_FILE, "");
    const candidates = kind ? [`.${kind}js`] : [".js", ".jsx", ".mjs", ".cjs"];
    return candidates.map((extension) => base + extension).find(exists) ?? null;
  };

  const resolveSpecifier = (from, specifier) => {
    const key = `${dirname(from)}\0${specifier}`;
    if (!resolutions.has(key)) {
      const target = resolveImport(from, specifier, { packages: true })?.target;
      const project = target ? inProject(target) : null;
      resolutions.set(
        key,
        project && DECLARATION_FILE.test(project)
          ? { file: runtimeFile(project), declaration: project }
          : { file: project },
      );
    }
    return resolutions.get(key);
  };

  const nearestManifest = (from) => {
    for (let directory = dirname(from); ; directory = dirname(directory)) {
      if (!manifests.has(directory)) {
        const file = join(directory, "package.json");
        let imports = null;
        if (exists(file))
          try {
            imports = JSON.parse(readFileSync(file, "utf8")).imports ?? {};
          } catch {
            imports = {};
          }
        manifests.set(directory, imports);
      }
      if (manifests.get(directory))
        return { directory, imports: manifests.get(directory) };
      if (directory === root || directory === dirname(directory)) return null;
    }
  };

  // package.json 的 imports：按 Node 的规则匹配 key（可以带一个 *），条件分支里可能被选中的都跟进去。
  const packageImport = (from, specifier, context) => {
    const manifest = nearestManifest(from);
    if (!manifest) return [];
    let target = manifest.imports[specifier];
    let match = null;
    if (target === undefined) {
      const key = Object.keys(manifest.imports)
        .filter((pattern) => {
          const [prefix, suffix = ""] = pattern.split("*");
          return (
            pattern.includes("*") &&
            specifier.startsWith(prefix) &&
            specifier.endsWith(suffix) &&
            specifier.length >= prefix.length + suffix.length
          );
        })
        .sort((a, b) => b.indexOf("*") - a.indexOf("*"))[0];
      if (!key) return [];
      const [prefix, suffix = ""] = key.split("*");
      match = specifier.slice(prefix.length, specifier.length - suffix.length);
      target = manifest.imports[key];
    }
    const leaves = (value) => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.flatMap(leaves);
      if (!value || typeof value !== "object") return [];
      return Object.entries(value)
        .filter(([condition]) => !EXCLUDED_CONDITIONS[context].has(condition))
        .flatMap(([, branch]) => leaves(branch));
    };
    return leaves(target).map((path) =>
      resolve(
        manifest.directory,
        match === null ? path : path.replaceAll("*", match),
      ),
    );
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
      targets = packageImport(from, edge.specifier, context);
    } else if (edge.specifier) {
      const { file, declaration } = resolveSpecifier(from, edge.specifier);
      if (file) targets = [file];
      else if (declaration && edge.start !== undefined) {
        const key = `${from}\0${edge.start}`;
        if (!reported.has(key)) {
          reported.add(key);
          report(from, {
            messageId: "unresolvedPackage",
            data: { specifier: edge.specifier },
            start: edge.start,
            end: edge.end,
          });
        }
      }
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

  // 一个模块按 symbols 被用到时，接下来要走的依赖；ownCode 表示模块自己的代码会执行。
  const usedEdges = (mod, symbols) => {
    if (symbols === ALL)
      return {
        ownCode: true,
        next: [
          ...mod.reexports.values(),
          ...mod.stars.map((specifier) => ({ specifier, symbols: ALL })),
        ],
      };
    // 没有 ESM 导出的模块（比如 CommonJS）看不出名字来自哪里，整个算上。
    const hasExports =
      mod.localExports.size > 0 ||
      mod.reexports.size > 0 ||
      mod.exportAliases.size > 0 ||
      mod.stars.length > 0;
    let ownCode = false;
    const next = [];
    for (const name of symbols) {
      const local = mod.exportAliases.get(name);
      if (mod.reexports.has(name)) next.push(mod.reexports.get(name));
      else if (local !== undefined && mod.bindings.has(local)) {
        const binding = mod.bindings.get(local);
        next.push({
          specifier: binding.specifier,
          symbols: bindingSymbols(binding),
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
    return { ownCode, next };
  };

  // 从一组起点沿依赖走，收集 Client 端模块用到的 namespace，各记一个用到它的文件当例子。
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
      // Client 端调用的 Server Action 在服务端执行：它自己用的文案不用下发，但它返回的 JSX 里的
      // Client Component 渲染在调用方下面，所以按服务端接着走。
      const context = mod.directives.has("use server")
        ? SERVER
        : mod.directives.has("use client")
          ? CLIENT
          : incoming;
      const { ownCode, next } = usedEdges(mod, symbols);
      if (ownCode) {
        next.push(...mod.edges);
        if (context === CLIENT)
          for (const { namespace } of mod.namespaces)
            if (!found.has(namespace)) found.set(namespace, file);
      }
      stack.push(...startStates(file, next, context));
    }
    return found;
  };

  return { startStates, namespacesFrom };
}

/**
 * 按 app 目录的路由结构建出每个 ClientMessages 的范围（scope），记下每个范围里 Client Component 用到的
 * namespace（required），并报告放错位置的 ClientMessages 和渲染在所有范围外面的 Client Component。
 */
function collectScopes({
  appDirectory,
  graph,
  getModule,
  depend,
  report,
  display,
  isClientMessagesModule,
}) {
  const scopes = [];
  const routeFiles = new Set();

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

  function hostScope(file, mod, { kind, outer, isRoot }, at) {
    const elements = mod.elements.filter((element) =>
      isClientMessagesModule(file, mod.tags.get(element.local).specifier),
    );
    const problem = (messageId, range, data = {}) =>
      report(file, { messageId, data, ...range });
    for (const extra of elements.slice(1))
      problem("onePerFile", extra.tagRange);
    const element = elements[0];
    if (!element) {
      if (kind === "layout" && isRoot) problem("rootRequired", at);
      return null;
    }
    const tag = mod.tags.get(element.local).imported;
    if (!SCOPE_HOSTS.has(kind) || mod.directives.has("use client"))
      problem("placement", element.tagRange, { tag });
    else if (tag === "RootClientMessages" && !(kind === "layout" && isRoot))
      problem("rootPlacement", element.tagRange);
    else if (tag === "ClientMessages" && kind === "layout" && isRoot)
      problem("rootRequired", element.tagRange);
    else if (!element.namespaces) problem("literalList", element.tagRange);
    else
      return {
        file,
        tag,
        element,
        list: element.namespaces,
        range: element.list,
        parent: outer,
        children: [],
        required: new Map(),
      };
    return null;
  }

  /**
   * 分析一个 route 文件，返回它下面的 route 所在的范围：layout、template 有 ClientMessages 时是它
   * 自己的范围，否则沿用外层的。
   */
  function routeFile(file, options) {
    const { kind, outer, slots = [] } = options;
    routeFiles.add(file);
    const mod = getModule(file);
    if (!mod) return outer;
    const root = defaultExport(mod, topLevelDeclarations(mod.sourceFile));
    const anchor = root?.name ?? root;
    const at = anchor
      ? { start: anchor.getStart(mod.sourceFile), end: anchor.getEnd() }
      : { start: 0, end: 0 };
    const scope = hostScope(file, mod, options, at);
    if (scope) {
      outer?.children.push(scope);
      scopes.push(scope);
    }

    if (mod.directives.has("use client")) {
      // error.tsx、global-error.tsx 这类 Client 文件：整个文件都在客户端渲染。
      addRequired(
        outer,
        file,
        graph.namespacesFrom([{ file, symbols: ALL, context: CLIENT }]),
        at,
      );
    } else {
      const props = new Set(WRAPPERS.has(kind) ? ["children", ...slots] : []);
      const { inside, outside, propsOutside, propsUnknown } = routeReferences(
        mod,
        root,
        scope?.element ?? null,
        props,
      );
      for (const { name, start, end } of propsOutside)
        report(file, {
          messageId: "childrenOutside",
          data: { name, tag: scope.tag },
          start,
          end,
        });
      if (propsUnknown)
        report(file, {
          messageId: "childrenUnknown",
          data: { tag: scope.tag },
          ...scope.element.tagRange,
        });
      if (scope)
        addRequired(
          scope,
          file,
          graph.namespacesFrom(graph.startStates(file, inside, SERVER)),
          at,
        );
      if (outer)
        addRequired(
          outer,
          file,
          graph.namespacesFrom(graph.startStates(file, outside, SERVER)),
          at,
        );
      else
        // 不在任何 ClientMessages 里：逐个引用查，问题报在引用的位置。
        for (const edge of outside)
          addRequired(
            null,
            file,
            graph.namespacesFrom(graph.startStates(file, [edge], SERVER)),
            edge.start === undefined
              ? at
              : { start: edge.start, end: edge.end },
          );
    }
    return scope && WRAPPERS.has(kind) ? scope : outer;
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
        if (!entry.name.startsWith("_") && !IGNORED_DIRECTORIES.has(entry.name))
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
          slots: children
            .filter((name) => name.startsWith("@"))
            .map((name) => name.slice(1)),
        })
      : outer;
    const template = files.get("template");
    // template 包着本层每个平行路由：create-component-tree.js 给 children 和每个 slot 的 LayoutRouter
    // 传的都是本层的 template。
    const afterTemplate = template
      ? routeFile(template, { kind: "template", outer: afterLayout })
      : afterLayout;
    for (const kind of [...BOUNDARY_FILES, "page", "default"])
      if (files.has(kind))
        routeFile(files.get(kind), { kind, outer: afterTemplate });
    if (isAppRoot)
      for (const kind of ["global-error", "global-not-found"])
        if (files.has(kind)) routeFile(files.get(kind), { kind, outer: null });
    for (const child of children)
      segment(
        join(directory, child),
        afterTemplate,
        layout ?? layoutAbove,
        false,
      );
  }

  segment(appDirectory, null, null, true);
  return { scopes, routeFiles };
}

/**
 * 合并语义下逐个检查范围的列表：一层发的 namespace 对它下面每一层都有效，外层已经发过的这一层再写
 * 也不算它提供的（effective 里没有）。缺的、重复的、没人用的都报告，fix 把列表改成该有的样子。
 */
function checkScopes(scopes, report, display) {
  for (const scope of scopes) {
    scope.above = new Map();
    for (let parent = scope.parent; parent; parent = parent.parent)
      for (const namespace of parent.list)
        if (!scope.above.has(namespace)) scope.above.set(namespace, parent);
    scope.effective = new Set(
      scope.list.filter((namespace) => !scope.above.has(namespace)),
    );
  }
  // 一层下面（含更深的范围）还需要从这一层或更外层拿的 namespace。
  const subtreeNeeds = new Map();
  const needsOf = (scope) => {
    if (!subtreeNeeds.has(scope)) {
      const needs = new Map(scope.required);
      for (const child of scope.children)
        for (const [namespace, example] of needsOf(child))
          if (!child.effective.has(namespace) && !needs.has(namespace))
            needs.set(namespace, example);
      subtreeNeeds.set(scope, needs);
    }
    return subtreeNeeds.get(scope);
  };
  for (const scope of scopes) {
    const needs = needsOf(scope);
    const problems = [];
    const kept = [];
    for (const namespace of scope.list) {
      const data = { namespace, tag: scope.tag };
      if (kept.includes(namespace))
        problems.push({ messageId: "duplicate", data });
      else if (scope.above.has(namespace))
        problems.push({
          messageId: "repeated",
          data: { ...data, owner: display(scope.above.get(namespace).file) },
        });
      else if (!needs.has(namespace))
        problems.push({ messageId: "unused", data });
      else kept.push(namespace);
    }
    const missing = [...scope.required]
      .filter(
        ([namespace]) =>
          !scope.list.includes(namespace) && !scope.above.has(namespace),
      )
      .sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [namespace, example] of missing)
      problems.push({
        messageId: "missing",
        data: { namespace, tag: scope.tag, example: display(example) },
      });
    const text = `[${[...kept, ...missing.map(([namespace]) => namespace)]
      .map((namespace) => JSON.stringify(namespace))
      .join(", ")}]`;
    for (const problem of problems)
      report(scope.file, {
        ...problem,
        ...scope.range,
        fix: { ...scope.range, text },
      });
  }
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

  const isClientMessagesModule = (file, specifier) => {
    const resolved = resolveImport(file, specifier);
    return (
      Boolean(resolved) &&
      toPosix(relative(root, resolved.target)).replace(/\.[^.]+$/, "") ===
        CLIENT_MESSAGES_MODULE
    );
  };

  function analyze(override) {
    const deps = new Map();
    const issues = new Map();
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
    const graph = createModuleGraph({
      root,
      realRoot,
      resolveImport,
      getModule,
      depend,
      report,
    });
    const appDirectory = [join(root, "app"), join(root, "src", "app")].find(
      (directory) => depend(directory)?.isDirectory(),
    );
    const { scopes, routeFiles } = appDirectory
      ? collectScopes({
          appDirectory,
          graph,
          getModule,
          depend,
          report,
          display,
          isClientMessagesModule,
        })
      : { scopes: [], routeFiles: new Set() };
    checkScopes(scopes, report, display);
    return { deps, issues, override, resolverRevision, routeFiles };
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
            isClientMessagesModule(file, own.tags.get(element.local).specifier),
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
