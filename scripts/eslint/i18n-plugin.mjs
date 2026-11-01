import { createClientNamespaceChecker } from "./client-namespaces.mjs";

const SEE_RULE = "See .claude/rules/i18n.md.";

/** 为项目创建 i18n 插件。client-namespaces 要分析整个项目，不能配合 ESLint 的 --cache 使用。 */
export default function createI18nPlugin(projectRoot) {
  const check = createClientNamespaceChecker(projectRoot);
  return {
    rules: {
      "client-namespaces": {
        meta: {
          type: "problem",
          fixable: "code",
          schema: [],
          messages: {
            missing: `Client Components under this {{tag}} use the "{{namespace}}" namespace ({{example}}), but no enclosing ClientMessages sends it. ${SEE_RULE}`,
            repeated: `"{{namespace}}" is already sent above, in {{owner}}. Nested ClientMessages merge with the ones above, so list only what this one adds.`,
            unused: `No Client Component under this {{tag}} uses "{{namespace}}".`,
            duplicate: `"{{namespace}}" is listed twice.`,
            outside: `This renders Client Components that use the "{{namespace}}" namespace ({{example}}) outside any ClientMessages, so they receive none of its messages. ${SEE_RULE}`,
            placement: `{{tag}} only works in a server layout, template, or page file. ${SEE_RULE}`,
            rootPlacement: `RootClientMessages belongs only in a root layout; use ClientMessages here.`,
            rootRequired: `Wrap the root layout's content in RootClientMessages; the ClientMessages below merge with it. ${SEE_RULE}`,
            onePerFile: `Use one ClientMessages per file and list every namespace this file adds in it.`,
            literalList: `List the namespaces as an array of string literals, so they can be checked.`,
            childrenOutside: `Render {{name}} inside {{tag}}, or the routes below it miss its messages.`,
            missingNamespace: `Pass a namespace to useTranslations: Client Components receive only the namespaces their route sends. ${SEE_RULE}`,
            literalNamespace: `Pass the namespace to useTranslations as a string literal, so the namespaces each route sends can be checked.`,
            indirectUse: `Call useTranslations from next-intl directly: through an alias or a re-export, its namespace can't be checked.`,
            dynamicImport: `Import with a string literal, or a template literal that starts with a directory, so the modules it can load are known.`,
            mdx: `i18n/client-namespaces doesn't analyze MDX yet, so the namespaces its components use go unchecked. Add MDX support to scripts/eslint/client-namespaces.mjs first.`,
            mdxRoute: `{{file}} is an MDX route. i18n/client-namespaces doesn't analyze MDX yet, so the namespaces its components use go unchecked. Add MDX support to scripts/eslint/client-namespaces.mjs first.`,
            unsupported: `useExtracted takes its messages from the source code, so i18n/client-namespaces can't check what each route sends. Use useTranslations with a namespace.`,
          },
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
