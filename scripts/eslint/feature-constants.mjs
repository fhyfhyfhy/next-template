import { featurePath } from "./imports.mjs";

// 全大写、下划线分词的名字，如 TASK_LIST_HREF、PNG。
const constantName = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/**
 * feature 导出的常量放在它的 constants/（.claude/rules/architecture.md「Where files go」）。
 * 按全大写命名认常量；camelCase 的值，如 query key 前缀，由规则文字判断。
 */
export default function createFeatureConstantsRule(projectRoot) {
  return {
    meta: {
      type: "suggestion",
      schema: [],
      messages: {
        location:
          'Export the constant {{name}} from this feature\'s constants/, or leave it unexported when only this module reads it. See "Where files go" in .claude/rules/architecture.md.',
      },
    },
    create(context) {
      const parts = featurePath(projectRoot, context.filename);
      if (!parts || parts[1] === "constants") return {};
      const sourceCode = context.sourceCode;

      function check(node, name) {
        if (constantName.test(name))
          context.report({ node, messageId: "location", data: { name } });
      }

      return {
        ExportNamedDeclaration(node) {
          // 带 from 的 re-export 和转出 import 进来的名字不查：常量在声明它的文件里查。
          if (node.source) return;
          if (node.declaration?.type === "VariableDeclaration") {
            for (const variable of sourceCode.getDeclaredVariables(
              node.declaration,
            ))
              check(variable.identifiers[0], variable.name);
            return;
          }
          const scope = sourceCode.getScope(node);
          for (const specifier of node.specifiers) {
            const variable = scope.set.get(specifier.local.name);
            if (variable?.defs.some(({ type }) => type === "Variable"))
              check(
                specifier,
                specifier.exported.name ?? specifier.exported.value,
              );
          }
        },
      };
    },
  };
}
