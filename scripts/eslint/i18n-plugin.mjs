import { createClientNamespaceChecker } from "./client-namespaces.mjs";

const NO_MDX = `i18n/client-namespaces doesn't analyze MDX yet, so the namespaces its components use go unchecked. Add MDX support to scripts/eslint/client-namespaces.mjs first.`;

const MESSAGES = {
  missing: `Client Components under this {{tag}} use the "{{namespace}}" namespace ({{example}}), but no enclosing ClientMessages sends it.`,
  repeated: `"{{namespace}}" is already sent above, in {{owner}}. Nested ClientMessages merge with the ones above, so list only what this one adds.`,
  unused: `No Client Component under this {{tag}} uses "{{namespace}}".`,
  duplicate: `"{{namespace}}" is listed twice.`,
  outside: `This renders Client Components that use the "{{namespace}}" namespace ({{example}}) outside any ClientMessages, so they receive none of its messages.`,
  placement: `{{tag}} only works in a server layout, template, or page file.`,
  rootPlacement: `RootClientMessages belongs only in a root layout; use ClientMessages here.`,
  rootRequired: `Wrap the root layout's content in RootClientMessages; the ClientMessages below merge with it.`,
  onePerFile: `Use one ClientMessages per file and list every namespace this file adds in it.`,
  literalList: `List the namespaces as an array of string literals, so they can be checked.`,
  childrenOutside: `Render {{name}} inside {{tag}}, or the routes below it miss its messages.`,
  childrenUnknown: `Can't tell where this file renders children: export the component as a function that takes its props directly, so the check can see they stay inside {{tag}}.`,
  missingNamespace: `Pass a namespace to useTranslations: Client Components receive only the namespaces their route sends.`,
  literalNamespace: `Pass the namespace to useTranslations as a string literal, so the namespaces each route sends can be checked.`,
  indirectUse: `Call useTranslations as imported from next-intl: through an alias, a re-export, or the module object passed around, its namespace can't be checked.`,
  dynamicImport: `Import with a string literal, or a template literal that starts with a directory, so the modules it can load are known.`,
  unresolvedPackage: `"{{specifier}}" resolves to type declarations with no JavaScript beside them, so the components it loads can't be checked. Build the package, or point its exports at the source.`,
  unsupported: `useExtracted takes its messages from the source code, so i18n/client-namespaces can't check what each route sends. Use useTranslations with a namespace.`,
  mdx: NO_MDX,
  mdxRoute: `{{file}} is an MDX route. ${NO_MDX}`,
};

/** Creates the project's i18n plugin; its rule is described in "Reading messages" in .claude/rules/i18n.md. */
export default function createI18nPlugin(projectRoot) {
  const check = createClientNamespaceChecker(projectRoot);
  return {
    rules: {
      "client-namespaces": {
        meta: {
          type: "problem",
          fixable: "code",
          schema: [],
          messages: Object.fromEntries(
            Object.entries(MESSAGES).map(([id, text]) => [
              id,
              `${text} See .claude/rules/i18n.md.`,
            ]),
          ),
        },
        create(context) {
          return {
            Program() {
              const { sourceCode } = context;
              for (const issue of check(context.filename, sourceCode.text))
                context.report({
                  loc: {
                    start: sourceCode.getLocFromIndex(issue.start),
                    end: sourceCode.getLocFromIndex(issue.end),
                  },
                  messageId: issue.messageId,
                  data: issue.data,
                  fix: issue.fix
                    ? (fixer) =>
                        fixer.replaceTextRange(
                          [issue.fix.start, issue.fix.end],
                          issue.fix.text,
                        )
                    : null,
                });
            },
          };
        },
      },
    },
  };
}
