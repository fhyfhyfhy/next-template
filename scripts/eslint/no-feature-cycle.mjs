import { createFeatureCycleChecker } from "./feature-cycles.mjs";
import { featurePath } from "./imports.mjs";

/** Creates the project's ESLint rule that reports the current file's references in a feature cycle. */
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
