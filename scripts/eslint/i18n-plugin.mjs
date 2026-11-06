import { createClientNamespaceChecker } from "./client-namespaces.mjs";
import { messageNamespace } from "./message-owner.mjs";

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
  indirectUse: `Call useTranslations as imported from next-intl: through an alias, a re-export, or the module object passed around, which modules read messages can't be checked.`,
  dynamicImport: `Import with a string literal, or a template literal that starts with a directory, so the modules it can load are known.`,
  unresolvedPackage: `"{{specifier}}" resolves to type declarations with no JavaScript beside them, so the components it loads can't be checked. Build the package, or point its exports at the source.`,
  unsupported: `useExtracted takes its messages from the source code, so i18n/client-namespaces can't check what each route sends. Use useTranslations.`,
  mdx: NO_MDX,
  mdxRoute: `{{file}} is an MDX route. ${NO_MDX}`,
};

const KEY_MESSAGES = {
  owner: `Read only keys of this file's namespace, "{{namespace}}"; this key is in "{{found}}". To show another owner's text, render its component; to have its code read its own text, pass t to that code.`,
  dynamic: `Write the key as a string literal, or a template literal that starts with "{{namespace}}.", so its namespace can be checked.`,
  noOwner: `Only code in features/, app/, and components/ reads messages: each of them owns one namespace.`,
};

const TRANSLATOR_HOOKS = new Set(["useTranslations", "getTranslations"]);
const TRANSLATOR_METHODS = new Set(["rich", "has", "raw", "markup"]);

/** 为项目创建 i18n 插件，规则说明见 .claude/rules/i18n.md「Namespaces and keys」「Reading messages」。 */
export default function createI18nPlugin(projectRoot) {
  const check = createClientNamespaceChecker(projectRoot);
  return {
    rules: {
      // 每个 key 的第一段是文件 owner 的 namespace。t 指 useTranslations() 或 getTranslations() 的结果，
      // 以及类型为 Translator 的参数。
      "message-keys": {
        meta: {
          type: "problem",
          schema: [],
          messages: Object.fromEntries(
            Object.entries(KEY_MESSAGES).map(([id, text]) => [
              id,
              `${text} See .claude/rules/i18n.md.`,
            ]),
          ),
        },
        create(context) {
          const namespace = messageNamespace(projectRoot, context.filename);
          const translators = new Set();
          const calls = [];

          function checkKey(key) {
            if (key?.type === "ConditionalExpression") {
              checkKey(key.consequent);
              checkKey(key.alternate);
              return;
            }
            const text =
              key?.type === "Literal" && typeof key.value === "string"
                ? key.value
                : key?.type === "TemplateLiteral"
                  ? key.quasis[0].value.cooked
                  : null;
            const complete =
              key?.type === "Literal" || key?.expressions?.length === 0;
            if (text === null || (!complete && !text.includes("."))) {
              context.report({
                node: key ?? context.sourceCode.ast,
                messageId: "dynamic",
                data: { namespace },
              });
              return;
            }
            const found = text.split(".")[0];
            if (found !== namespace)
              context.report({
                node: key,
                messageId: "owner",
                data: { namespace, found },
              });
          }

          return {
            VariableDeclarator(node) {
              const init =
                node.init?.type === "AwaitExpression"
                  ? node.init.argument
                  : node.init;
              if (
                node.id.type === "Identifier" &&
                init?.type === "CallExpression" &&
                init.callee.type === "Identifier" &&
                TRANSLATOR_HOOKS.has(init.callee.name)
              )
                translators.add(node.id.name);
            },
            "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
              node,
            ) {
              for (const param of node.params) {
                const id =
                  param.type === "AssignmentPattern" ? param.left : param;
                const type = id.typeAnnotation?.typeAnnotation;
                if (
                  id.type === "Identifier" &&
                  type?.type === "TSTypeReference" &&
                  type.typeName.type === "Identifier" &&
                  type.typeName.name === "Translator"
                )
                  translators.add(id.name);
              }
            },
            CallExpression(node) {
              calls.push(node);
            },
            "Program:exit"() {
              for (const call of calls) {
                const { callee } = call;
                const name =
                  callee.type === "Identifier"
                    ? callee.name
                    : callee.type === "MemberExpression" &&
                        callee.object.type === "Identifier" &&
                        !callee.computed &&
                        TRANSLATOR_METHODS.has(callee.property.name)
                      ? callee.object.name
                      : null;
                if (!name || !translators.has(name)) continue;
                if (namespace === null)
                  context.report({ node: call, messageId: "noOwner" });
                else checkKey(call.arguments[0]);
              }
            },
          };
        },
      },
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
