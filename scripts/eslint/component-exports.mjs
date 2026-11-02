const transparentExpressions = new Set([
  "TSAsExpression",
  "TSTypeAssertion",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSInstantiationExpression",
  "ParenthesizedExpression",
]);

const componentExportsRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      namespace:
        "List public API members explicitly instead of exporting an imported namespace or its alias. Select named members to keep newly added private exports out of the public API.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function variableFor(identifier) {
      for (
        let scope = sourceCode.getScope(identifier);
        scope;
        scope = scope.upper
      ) {
        const variable = scope.set.get(identifier.name);
        if (variable) return variable;
      }
      return null;
    }

    function exposesNamespace(expression, visited = new Set()) {
      while (expression && transparentExpressions.has(expression.type))
        expression = expression.expression;
      if (expression?.type === "ObjectExpression") {
        return expression.properties.some((property) =>
          exposesNamespace(
            property.type === "SpreadElement"
              ? property.argument
              : property.value,
            visited,
          ),
        );
      }
      if (expression?.type === "ArrayExpression") {
        return expression.elements.some((element) =>
          exposesNamespace(
            element?.type === "SpreadElement" ? element.argument : element,
            visited,
          ),
        );
      }
      if (expression?.type !== "Identifier") return false;
      const variable = variableFor(expression);
      if (!variable || visited.has(variable)) return false;
      visited.add(variable);

      return variable.defs.some((definition) => {
        if (
          definition.type === "ImportBinding" &&
          definition.node.type === "ImportNamespaceSpecifier"
        )
          return true;
        // 只追踪不可变别名；可变赋值和函数返回值需要控制流分析，不能按同名标识符猜测。
        return (
          definition.type === "Variable" &&
          definition.parent.kind === "const" &&
          (definition.node.id.type === "Identifier" ||
            (definition.node.id.type === "ObjectPattern" &&
              definition.node.id.properties.some(
                (property) =>
                  property.type === "RestElement" &&
                  property.argument === definition.name,
              ))) &&
          exposesNamespace(definition.node.init, visited)
        );
      });
    }

    function check(expression, reportNode = expression) {
      if (exposesNamespace(expression))
        context.report({ node: reportNode, messageId: "namespace" });
    }

    return {
      "Program:exit"(program) {
        for (const statement of program.body) {
          if (statement.type === "ExportDefaultDeclaration") {
            check(statement.declaration);
          } else if (statement.type === "TSExportAssignment") {
            check(statement.expression);
          } else if (
            statement.type === "ExportNamedDeclaration" &&
            !statement.source
          ) {
            for (const specifier of statement.specifiers) {
              if (specifier.type === "ExportSpecifier")
                check(specifier.local, specifier);
            }
            if (statement.declaration?.type === "VariableDeclaration") {
              for (const declaration of statement.declaration.declarations) {
                if (declaration.id.type === "Identifier")
                  check(declaration.init, declaration.id);
                else if (declaration.id.type === "ObjectPattern") {
                  for (const property of declaration.id.properties) {
                    if (property.type === "RestElement")
                      check(declaration.init, property.argument);
                  }
                }
              }
            }
          }
        }
      },
    };
  },
};

export default componentExportsRule;
