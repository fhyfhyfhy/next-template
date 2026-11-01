import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import i18next from "eslint-plugin-i18next";
import playwright from "eslint-plugin-playwright";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import { BUILD_DIRS } from "./scripts/build-dirs.mjs";
import createArchitecturePlugin, {
  layerZones,
} from "./scripts/eslint/architecture-plugin.mjs";
import e2ePlugin from "./scripts/eslint/e2e-plugin.mjs";
import createI18nPlugin from "./scripts/eslint/i18n-plugin.mjs";
import { SOURCE_EXTENSIONS, SOURCE_GLOB } from "./scripts/eslint/imports.mjs";
import createNamingPlugin from "./scripts/eslint/naming-plugin.mjs";
import withWrapperImports, {
  apiFileFactoriesRule,
  mutationCallbacksRule,
} from "./scripts/eslint/query-plugin.mjs";
import { TAILWIND_PALETTES } from "./scripts/eslint/tailwind-palettes.mjs";

const PROJECT_ROOT = import.meta.dirname;
const extensionGlob = `{${SOURCE_EXTENSIONS.join(",")}}`;
const moduleExtensions = SOURCE_EXTENSIONS.map((extension) => `.${extension}`);

// Import groups: npm/Node packages and side-effect imports, the @/ alias,
// relative paths, CSS.
const importGroups = [
  ["^\\u0000", "^node:", "^@?\\w"],
  ["^@/"],
  ["^\\.\\.?(/|$)"],
  ["\\.css$"],
];

// A layer may import from its own layer and the layers below; file and feature
// cycles are import/no-cycle's and architecture/no-feature-cycle's. These
// match the "Layers" and "Feature structure" tables of
// .claude/rules/architecture.md one to one: change both together.
const ROOT_LAYERS = [
  { name: "app/", files: ["app/**"] },
  { name: "features/", files: ["features/**"] },
  {
    name: "components/",
    files: ["components/!(ui)/**", `components/*.${extensionGlob}`],
  },
  { name: "components/ui/", files: ["components/ui/**"] },
  { name: "hooks/", files: ["hooks/**"] },
  { name: "lib/", files: ["lib/**"] },
  { name: "utils/", files: ["utils/**"] },
  { name: "constants/", files: ["constants/**"] },
  { name: "types/", files: ["types/**"] },
];

const FEATURE_LAYERS = [
  "components",
  "hooks",
  "stores",
  "api",
  "utils",
  "constants",
  "types",
].map((dir) => ({
  name: `features/{name}/${dir}/`,
  files: [`features/*/${dir}/**`],
}));

const queryPlugin = withWrapperImports(pluginQuery);
const QUERY_LIBRARY_MESSAGE =
  "Request server data with fetchApi from @/lib/fetch and React Query from @/lib/react-query. See .claude/rules/data-fetching.md.";

const LOCALE_NAVIGATION_MESSAGE =
  "Import Link, redirect, useRouter, and usePathname from @/lib/i18n/navigation: the next/* versions drop the locale prefix of non-default locales. See .claude/rules/i18n.md.";

// Messages sent outside lib/i18n/ through next-intl's provider and
// useMessages directly are out of i18n/client-namespaces' sight.
const INTL_PROVIDER_RESTRICTION = {
  name: "next-intl",
  importNames: ["NextIntlClientProvider", "useMessages"],
  message:
    "Send messages to Client Components with ClientMessages from @/lib/i18n/client-messages, so i18n/client-namespaces can check them. See .claude/rules/i18n.md.",
};

// No second data path beside fetchApi and React Query (no axios, no SWR);
// in-app navigation through next-intl's API, so that a non-default locale's
// URL prefix is kept.
const RESTRICTED_IMPORTS = {
  paths: [
    ...["axios", "swr"].map((name) => ({
      name,
      message: QUERY_LIBRARY_MESSAGE,
    })),
    { name: "next/link", message: LOCALE_NAVIGATION_MESSAGE },
    {
      name: "next/navigation",
      importNames: [
        "redirect",
        "permanentRedirect",
        "useRouter",
        "usePathname",
      ],
      message: LOCALE_NAVIGATION_MESSAGE,
    },
    INTL_PROVIDER_RESTRICTION,
  ],
  patterns: [{ group: ["axios/*", "swr/*"], message: QUERY_LIBRARY_MESSAGE }],
};

const COMPONENT_INDEX_EXPORT_MESSAGE =
  "List public API members explicitly in the component entry. Use named exports instead of export * or namespace re-exports.";

// Dates and times show in the computer's time zone, which only the browser
// knows, so components/date-time.tsx alone formats them (.claude/rules/i18n.md).
const DATE_TIME_MESSAGE =
  "Show a date or time with <DateTime> from @/components/date-time, which renders it in the browser in the computer's time zone. See .claude/rules/i18n.md.";
const DATE_TIME_FORMATTING = [
  {
    selector: "CallExpression[callee.property.name=/^dateTime(Range)?$/]",
    message: DATE_TIME_MESSAGE,
  },
  {
    selector:
      "MemberExpression[object.name='Intl'][property.name='DateTimeFormat']",
    message: DATE_TIME_MESSAGE,
  },
];

// The no-restricted-syntax restrictions every application file is under.
const RESTRICTED_SYNTAX = [...DATE_TIME_FORMATTING];
const DATE_TIME_EXEMPT = RESTRICTED_SYNTAX.filter(
  (restriction) => !DATE_TIME_FORMATTING.includes(restriction),
);

// Code that reaches a page: workspace packages' sources in a monorepo
// included; scripts/, e2e/, tests and the root config files never do.
const APPLICATION_CODE = {
  files: [SOURCE_GLOB],
  ignores: [
    `**/*.{test,spec}.${extensionGlob}`,
    "scripts/**",
    "e2e/**",
    `*.${extensionGlob}`,
  ],
};

// Colors only from app/globals.css's semantic tokens plus black and white;
// radii only built-in or --radius-* tokens.
const RESTRICTED_TAILWIND_CLASSES = [
  {
    pattern: `^(?:.*:)?!?[a-z-]+-(?:${TAILWIND_PALETTES.join("|")})-\\d+(?:/.+)?!?$`,
    message:
      'Use a semantic color token from app/globals.css instead of the Tailwind palette color "$0".',
  },
  {
    // Hex colors and color functions in arbitrary values; a CSS variable
    // reference is fine. Arbitrary values write a space as _, which is \w, so
    // the boundaries are explicit character sets rather than \b or \w.
    pattern:
      "^.*\\[[^\\]]*(?:#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z-])|(?<![a-zA-Z-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\().*$",
    message:
      'Define a color token in app/globals.css instead of the hard-coded color in "$0".',
  },
  {
    // Only arbitrary values need stopping here: a radius class that is neither
    // an arbitrary value nor in the built-in or --radius-* theme is reported
    // by no-unknown-classes.
    pattern: "^(?:.*:)?!?rounded(?:-[a-z]{1,2})?-[[(].*$",
    message:
      'Use a built-in radius or a --radius-* token from app/globals.css instead of "$0".',
  },
];

// ESLint does not merge one rule's options across config objects: a later
// object that sets no-restricted-imports or no-restricted-syntax for a file
// replaces the earlier options whole. So each object below that sets one of
// them names every restriction its files are under, as RESTRICTED_IMPORTS and
// RESTRICTED_SYNTAX spread into it; eslint.config.test.mjs checks that they
// all hold.
const eslintConfig = defineConfig([
  // Next.js's React, Hooks, accessibility and performance rules, kept up with
  // the framework's version.
  ...nextVitals.map((config) =>
    config.name === "next"
      ? {
          ...config,
          // Every supported extension (.cjs included) needs Next's parser,
          // plugins and resolver.
          files: [SOURCE_GLOB],
          settings: {
            ...config.settings,
            "import/extensions": moduleExtensions,
            "import/resolver": Object.fromEntries(
              Object.entries(config.settings["import/resolver"]).map(
                ([name, options]) => [
                  name,
                  {
                    ...options,
                    extensions: [...moduleExtensions, ".json", ".d.ts"],
                  },
                ],
              ),
            ),
          },
        }
      : config,
  ),
  // TypeScript's recommended rules, among them no explicit any and a
  // described @ts-expect-error instead of @ts-ignore. tsconfig's
  // erasableSyntaxOnly rules out enums.
  ...nextTs,
  {
    files: [SOURCE_GLOB],
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      // `-- <why>` after every eslint directive, so a reviewer sees the reason.
      "@eslint-community/eslint-comments/require-description": "error",
      // Object types are interfaces, so that one kind of contract is not
      // written two ways.
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      // Warn on type assertions: annotate or narrow instead. const assertions
      // are fine.
      "@typescript-eslint/consistent-type-assertions": [
        "warn",
        { assertionStyle: "never" },
      ],
      // Warn on the non-null assertion !, which hides a value that can be
      // empty.
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
  {
    files: [SOURCE_GLOB],
    // Packages in node_modules never import project code, so their exports
    // need no resolving. Without this, import/no-cycle resolves each of
    // @tabler/icons-react's thousands of icon modules and the 9 MB
    // typescript.js, and lint gets over 5 times slower.
    settings: { "import/ignore": ["node_modules"] },
    plugins: {
      "simple-import-sort": simpleImportSort,
      architecture: createArchitecturePlugin(PROJECT_ROOT),
      naming: createNamingPlugin(PROJECT_ROOT),
      "data-fetching": {
        rules: {
          "mutation-callbacks": mutationCallbacksRule,
          "api-file-factories": apiFileFactoriesRule,
        },
      },
    },
    rules: {
      // A fixed order per importGroups, autofixed, so adding or removing a
      // dependency leaves no unrelated ordering diff.
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      // Inside a feature, relative paths, never its own public entry. Across
      // boundaries, @/; another feature only through its public entries.
      "architecture/feature-imports": "error",
      // Dependencies grouped by feature (type references included), for
      // features that depend on each other while the file graph has no cycle.
      "architecture/no-feature-cycle": "error",
      // Relative paths inside a component directory, and only its index entry
      // from outside, so that callers never depend on private paths.
      "architecture/component-imports": "error",
      // One implementation entry per component directory, so that index files
      // with different extensions cannot resolve ambiguously; declaration
      // files may sit beside it.
      "architecture/component-entry": "error",
      // Who may use the conditional imports, what they point at and in which
      // order, so that no unsupported # path gets around the architecture
      // checks.
      "architecture/package-imports": "error",
      // React Query only through the project's wrapper, so that nothing
      // bypasses the project's QueryClient policy.
      "architecture/wrapper-imports": "error",
      // kebab-case source paths, keeping Next.js's special route directory
      // names.
      "naming/kebab-case": "error",
      // The factory keeps the cache updates it owns; a caller's success, error
      // and settled callbacks go in mutate's second argument.
      "data-fetching/mutation-callbacks": "error",
      // Another package by its name, never by a relative path through its
      // boundary.
      "import/no-relative-packages": "error",
      "no-restricted-imports": ["error", RESTRICTED_IMPORTS],
      // Resolvable file cycles, type-only imports aside; cycles between
      // features have their own rule.
      "import/no-cycle": ["error", { commonjs: true }],
      // No lower layer imports a higher one, per the layer tables, so that
      // dependencies point the way the architecture does.
      "import/no-restricted-paths": [
        "error",
        {
          basePath: PROJECT_ROOT,
          zones: [
            ...layerZones(ROOT_LAYERS, "Layers"),
            ...layerZones(FEATURE_LAYERS, "Feature structure"),
            {
              target: ["e2e/**"],
              from: ROOT_LAYERS.flatMap((layer) => layer.files),
              message:
                'e2e/ observes the app only through the browser, so it imports no application code. See "Where files go" in .claude/rules/architecture.md.',
            },
          ],
        },
      ],
    },
  },
  // TanStack's strict recommended rules; queryPlugin makes them recognize the
  // project's wrapper imports.
  ...pluginQuery.configs["flat/recommended-strict"].map((config) => ({
    ...config,
    files: [SOURCE_GLOB],
    plugins: { "@tanstack/query": queryPlugin },
  })),
  {
    // Application code only: scripts/ and the root config files are not
    // bundled by Next.js, so @/ does not resolve there.
    files: ROOT_LAYERS.flatMap((layer) => layer.files),
    rules: {
      // Relative paths within the current directory and below, @/ across
      // directories; features and components have rules of their own.
      "architecture/root-imports": "error",
    },
  },
  {
    ...APPLICATION_CODE,
    rules: { "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX] },
  },
  {
    ...APPLICATION_CODE,
    plugins: { i18n: createI18nPlugin(PROJECT_ROOT) },
    rules: {
      // The namespaces each ClientMessages sends match those the Client
      // Components below it use; --fix rewrites the list. It analyzes the whole
      // project, so lint runs without --cache (.claude/rules/i18n.md).
      "i18n/client-namespaces": "error",
    },
  },
  {
    // ClientMessages itself needs next-intl's provider and useMessages, and so
    // does a unit test that renders a component outside any route. A later
    // config object that sets the same rule replaces the earlier options whole.
    files: ["lib/i18n/**", `**/*.test.${extensionGlob}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          ...RESTRICTED_IMPORTS,
          paths: RESTRICTED_IMPORTS.paths.filter(
            (path) => path !== INTL_PROVIDER_RESTRICTION,
          ),
        },
      ],
    },
  },
  {
    files: [
      `**/components/!(ui)/index.${extensionGlob}`,
      `**/components/ui/*/index.${extensionGlob}`,
    ],
    rules: {
      // Follows imported namespaces and their const aliases, so that no entry
      // exposes a whole namespace indirectly.
      "architecture/component-exports": "error",
      // No export * or export * as in an entry: its public members are listed.
      "no-restricted-syntax": [
        "error",
        ...RESTRICTED_SYNTAX,
        {
          selector: "ExportAllDeclaration",
          message: COMPONENT_INDEX_EXPORT_MESSAGE,
        },
        {
          selector: "ExportNamespaceSpecifier",
          message: COMPONENT_INDEX_EXPORT_MESSAGE,
        },
      ],
    },
  },
  {
    // The one place that formats dates and times; the other restrictions stay.
    // An object that gives a rule only its severity keeps the earlier options,
    // so with none left the rule is turned off.
    files: ["components/date-time.tsx"],
    rules: {
      "no-restricted-syntax": DATE_TIME_EXEMPT.length
        ? ["error", ...DATE_TIME_EXEMPT]
        : "off",
    },
  },
  {
    files: [SOURCE_GLOB],
    // A test's classes are inputs to functions such as cn(), never rendered,
    // and deliberately joined or written non-canonically.
    ignores: [`**/*.{test,spec}.${extensionGlob}`],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "app/globals.css",
        // Unset, the plugin converts no px to rem, and a class such as
        // lg:max-h-[520px] that could read lg:max-h-130 goes unreported.
        // globals.css keeps the root font size, so the browser's default 16px,
        // as in Tailwind CSS IntelliSense.
        rootFontSize: 16,
      },
    },
    // prettier-plugin-tailwindcss sorts, dedupes and spaces classes; these
    // are the rules it does not cover.
    rules: {
      // The canonical form per Tailwind's canonicalizeCandidates, as
      // IntelliSense suggests in the editor.
      "better-tailwindcss/enforce-canonical-classes": "error",
      // A class in neither Tailwind nor the project's theme generates no
      // style, and is most likely a typo.
      "better-tailwindcss/no-unknown-classes": "error",
      // Classes in one string that set the same CSS property override each
      // other by generation order, not by the order written.
      "better-tailwindcss/no-conflicting-classes": "error",
      // Replaces classes this Tailwind version deprecates.
      "better-tailwindcss/no-deprecated-classes": "error",
      // Tailwind scans the source for whole class names, so a joined class
      // generates no style.
      "better-tailwindcss/no-concatenated-classes": "error",
      // Colors and radii come from theme tokens: RESTRICTED_TAILWIND_CLASSES.
      "better-tailwindcss/no-restricted-classes": [
        "error",
        { restrict: RESTRICTED_TAILWIND_CLASSES },
      ],
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ignores: [
      "**/*.{test,spec,story,stories,generated,gen}.{jsx,tsx}",
      "**/{test,tests,__tests__,stories,generated,__generated__}/**",
    ],
    rules: {
      // A long function is a prompt to check its responsibilities, so that no
      // component or helper takes on too much.
      "max-lines-per-function": [
        "warn",
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      // A long file is a prompt to check whether to split it; a warning, so a
      // large component with one responsibility can stay whole.
      "max-lines": [
        "warn",
        {
          max: 200,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  {
    // Text users see goes in messages/ and renders through t()
    // (.claude/rules/i18n.md). Only JSX text and the attributes below are
    // checked; text outside JSX (toasts, metadata, labels in constants) is the
    // rule's to hold. The *-examples/ directories of each component keep
    // literals: examples and playgrounds stay copyable on their own, control
    // labels are prop names, and the generator reads component metadata as
    // literals.
    files: ["{app,features,components}/**/*.{jsx,tsx}"],
    ignores: [
      "features/demo-ui/components/*-examples/**",
      "**/*.{test,spec}.{jsx,tsx}",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: [
              "aria-label",
              "aria-description",
              "aria-valuetext",
              "title",
              "placeholder",
              "alt",
              "label",
              "description",
            ],
          },
          // Setting it replaces the plugin's default list: the first entries
          // are those defaults, the last lets through the key in calls such as
          // next-intl's t.rich.
          callees: {
            exclude: [
              "i18n(ext)?",
              "t",
              "require",
              "addEventListener",
              "removeEventListener",
              "postMessage",
              "getElementById",
              "dispatch",
              "commit",
              "includes",
              "indexOf",
              "endsWith",
              "startsWith",
              "t\\.(rich|markup|raw|has)",
            ],
          },
          message:
            "Move user-visible text into messages/ and render it with t() (.claude/rules/i18n.md)",
        },
      ],
    },
  },
  {
    files: ["features/*/api/**"],
    rules: {
      // The options factories follow the HTTP method in the file name, so
      // that a read's factory never lands in a write's file, nor the reverse.
      "data-fetching/api-file-factories": "error",
    },
  },
  // Playwright's recommended e2e rules, such as no fixed-length waits and an
  // awaited expect.poll.
  {
    ...playwright.configs["flat/recommended"],
    files: ["e2e/**"],
    plugins: {
      ...playwright.configs["flat/recommended"].plugins,
      e2e: e2ePlugin,
    },
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // A test whose assertions sit in an expectXxx helper has assertions.
      "playwright/expect-expect": [
        "warn",
        { assertFunctionPatterns: ["^expect[A-Z]"] },
      ],
      // After a full page load, wait for hydration before acting, or a click
      // may land before React takes over (.claude/rules/e2e.md).
      "e2e/act-after-ready": "error",
    },
  },
  {
    files: ["e2e/**"],
    ignores: ["e2e/test.ts"],
    rules: {
      // e2e/test.ts's test carries the global fixtures (such as failing when a
      // page misses a message); Playwright's own test would get around them.
      // A later config object that sets the same rule replaces the earlier
      // options whole, so this one spreads the global restrictions and adds
      // to them.
      "no-restricted-imports": [
        "error",
        {
          ...RESTRICTED_IMPORTS,
          paths: [
            ...RESTRICTED_IMPORTS.paths,
            {
              name: "@playwright/test",
              importNames: ["test", "expect"],
              message:
                "Import test and expect from e2e/test.ts, which adds the fixtures every spec runs with.",
            },
          ],
        },
      ],
    },
  },
  // Next's default ignores, the worktrees added: each worktree lints its own
  // checkout.
  globalIgnores([
    // Next's default build output and generated types; the other .next-*
    // directories are the demo:* commands' and the e2e builds'
    // (scripts/build-dirs.mjs).
    ...BUILD_DIRS.map((dir) => `${dir}/**`),
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code makes its worktrees inside the repo.
    ".claude/worktrees/**",
  ]),
  // Last: turns off the formatting rules that overlap or conflict with
  // Prettier.
  eslintConfigPrettier,
]);

export default eslintConfig;
