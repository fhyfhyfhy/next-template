import { createFeatureCycleChecker } from "./feature-cycles.mjs";
import { featurePath } from "./imports.mjs";

/** 为项目创建 ESLint 规则，报告当前文件中参与 feature 循环的引用。 */
export default function createFeatureCycleRule(projectRoot) {
  const checkFile = createFeatureCycleChecker(projectRoot);
  return {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        cycle: "Feature dependency cycle: {{cycle}}.",
      },
    },
    create(context) {
      if (!featurePath(projectRoot, context.filename)) return {};
      return {
        Program() {
          for (const issue of checkFile(
            context.filename,
            context.sourceCode.text,
          )) {
            context.report({
              loc: {
                start: { line: issue.line, column: issue.column - 1 },
                end: { line: issue.endLine, column: issue.endColumn - 1 },
              },
              messageId: "cycle",
              data: { cycle: issue.cycle.join(" -> ") },
            });
          }
        },
      };
    },
  };
}
