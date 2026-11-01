import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { createProjectResolver, SOURCE_EXTENSIONS } from "./imports.mjs";

// Checks that the namespaces each ClientMessages sends match what the Client Components it encloses
// actually use; the convention is "Reading messages" in .claude/rules/i18n.md. When unsure, it counts
// more rather than less, and code it can't analyze is reported rather than quietly skipped.

const ALL = "*";
const CLIENT = "client";
const SERVER = "server";
const SOURCE_EXTENSION_SET = new Set(SOURCE_EXTENSIONS.map((ext) => `.${ext}`));
const DECLARATION_FILE = /\.d\.([cm]?)ts$/;
const MDX = /\.mdx?$/;
const CLIENT_MESSAGES_MODULE = "lib/i18n/client-messages";
// Client-side useTranslations comes from these entries: next-intl re-exports it from use-intl.
const INTL_MODULES = new Set(["next-intl", "use-intl", "use-intl/react"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git"]);
// Next nests layout > template > error > loading > not-found > page (Component hierarchy in the
// project-structure docs); forbidden and unauthorized sit at the same level as not-found.
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
// The files that render the routes below as children (and as the slots of parallel routes).
const WRAPPERS = new Set(["layout", "template"]);
// The package.json conditions that each environment never selects; the bundler may select any other
// branch (development included). Client Components render both in the browser and on the server, so
// only react-server is excluded for them.
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

// The export names an import binding uses: a namespace import uses the whole module.
const bindingSymbols = ({ imported }) =>
  imported === ALL ? ALL : new Set([imported]);

// Type positions don't exist at runtime; an extends clause, though an ExpressionWithTypeArguments,
// refers to a runtime value.
function isTypeOnlyNode(node) {
  return ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node);
}

// Whether the identifier refers to a binding, rather than standing as a declared name, a property
// name, a JSX attribute name, and the like.
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

// Loaders that load a whole directory at once, such as require.context and import.meta.glob.
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

// Top-level imports and exports: dependencies, export names and next-intl bindings.
function readTopLevel(context) {
  const { mod, range, problem, intl } = context;
  for (const statement of mod.sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = stringValue(statement.moduleSpecifier);
      const isIntl = INTL_MODULES.has(specifier);
      // The components rendered in MDX only show after MDX compilation, which this doesn't support yet.
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
          // useExtracted takes its messages from the source code, so there is no namespace to check.
          if (isIntl && imported === "useExtracted")
            problem(element, "unsupported");
          if (
            imported === "ClientMessages" ||
            imported === "RootClientMessages"
          )
            mod.tags.set(element.name.text, { specifier, imported });
        }
      }
      // An import of types only leaves no runtime dependency after compilation.
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
  // Once next-intl is re-exported, its importers' useTranslations can't be recognized.
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

// Usage in function bodies: dynamic imports, useTranslations calls and ClientMessages elements.
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
      // A bundler takes a path with variables as a set of files under one directory, so the path
      // must start with a directory.
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
    // Only direct calls to useTranslations and property access on the next-intl module object count:
    // once it is assigned, destructured or passed on, the namespace at the call can't be found.
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

/** Parses the facts in a module that the namespace check needs: syntax only, without resolving where imports point. */
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
    // The dependencies of the module's own code; kind is static, side-effect or dynamic (dynamic
    // import and require).
    edges: [],
    dynamicEdges: new Map(),
    // export … from is recorded per export name, so only the names in use are followed.
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
 * What a layout's or template's function calls its children and slot props: locals are the local
 * names destructured from them (renames and ...rest included), and object is the props parameter's
 * name when it isn't destructured. Returns null when that can't be told, such as when the default
 * export is wrapped in a HOC.
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
 * Splits the dependencies a route file renders with into those inside and outside its
 * ClientMessages element. It starts from the default export and follows the top-level declarations
 * of the same file; exports that render nothing, such as generateMetadata, don't count. props are
 * the props a layout or template renders the routes below with (children and slots): where they
 * appear outside the element, their positions are recorded, since the routes below would then miss
 * this level's messages.
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
          // props not destructured: only an access such as props.children shows which prop is
          // used; any other use counts as using them.
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
  // A side-effect import renders nothing but may register components in a registry, so it counts
  // with the main content this file renders.
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
 * The module dependency graph: resolves where imports point, and collects the namespaces the client
 * side uses, starting from a set of start points. getModule returns a parsed module, depend records
 * the version of a file read, and report reports a problem in a file.
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

  // TypeScript resolves package names to real paths; when the project root itself sits behind a
  // symlink (such as /var on macOS), they are mapped back under the root, so the paths used for the
  // cache and reports match the ones ESLint passes in. Third-party packages in node_modules don't use
  // the project's namespaces.
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

  // Beside a workspace package's type declarations is the JS the bundler actually loads; without it
  // there is nothing to analyze, so it is reported rather than skipped.
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

  // package.json imports: keys match by Node's rules (with at most one *), and every conditional
  // branch that may be selected is followed.
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

  // The dependencies to follow next when a module is used for symbols; ownCode means the module's
  // own code runs.
  const usedEdges = (mod, symbols) => {
    if (symbols === ALL)
      return {
        ownCode: true,
        next: [
          ...mod.reexports.values(),
          ...mod.stars.map((specifier) => ({ specifier, symbols: ALL })),
        ],
      };
    // A module without ESM exports (such as CommonJS) doesn't show where a name comes from, so all
    // of it counts.
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

  // Walks the dependencies from a set of start points and collects the namespaces client-side
  // modules use, each with one file that uses it as an example.
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
      // A Server Action called from the client runs on the server: the messages it uses itself
      // need not be sent, but the Client Components in the JSX it returns render under the caller,
      // so the walk goes on as server.
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
 * Builds each ClientMessages' scope from the app directory's route structure, records the
 * namespaces the Client Components in each scope use (required), and reports misplaced
 * ClientMessages and Client Components rendered outside every scope.
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
   * Analyzes a route file and returns the scope the routes below it are in: a layout's or
   * template's own scope when it has a ClientMessages, otherwise the outer one.
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
      // Client files such as error.tsx and global-error.tsx: the whole file renders on the client.
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
        // Inside no ClientMessages: each reference is checked on its own, and a problem is
        // reported where the reference is.
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
        // Directories starting with _ are private and take no part in routing.
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
    // An MDX route has no JS file to report on, so it is reported on the layout around it.
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
    // The template wraps every parallel route at this level: create-component-tree.js passes this
    // level's template to the LayoutRouter of children and of each slot.
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
 * Checks each scope's list under merge semantics: a namespace a level sends holds for every level
 * below it, and one already sent further out doesn't count as provided by this level even when listed
 * again (it isn't in effective). Missing, repeated and unused namespaces are all reported, and the fix
 * rewrites the list to what it should be.
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
  // The namespaces that the levels below a scope (deeper scopes included) still need from it or
  // from further out.
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
 * Creates the checker. filename is absolute, and sourceText may be unsaved content; other files are
 * read from disk. Returns the current file's problems: start and end are offsets in sourceText, and
 * fix gives the range to replace and the text to put there.
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
    // Tracks tsconfig, package.json and the paths probed while resolving, so a new file also
    // invalidates the resolutions.
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
    // A ClientMessages in a file outside the routes (a feature component and the like) is outside
    // the analysis, so it is reported as misplaced.
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
