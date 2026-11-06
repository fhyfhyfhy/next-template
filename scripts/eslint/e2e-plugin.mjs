// e2e 的本地规则，规则本身见 .claude/rules/e2e.md 的 Hydration。

const LOADS = new Set(["goto", "reload"]);
const ACTIONS = new Set([
  "check",
  "click",
  "dblclick",
  "dragTo",
  "fill",
  "hover",
  "press",
  "pressSequentially",
  "selectOption",
  "setChecked",
  "setInputFiles",
  "tap",
  "type",
  "uncheck",
]);
const FUNCTIONS = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

/** `node` 里不在嵌套函数中的调用：回调里的调用不在这条语句执行时发生。 */
function callsIn(node, visitorKeys, calls = []) {
  if (node.type === "CallExpression") calls.push(node);
  for (const key of visitorKeys[node.type] ?? []) {
    for (const child of [node[key]].flat()) {
      if (child && typeof child.type === "string" && !FUNCTIONS.has(child.type))
        callsIn(child, visitorKeys, calls);
    }
  }
  return calls;
}

const methodName = (call) =>
  call.callee.type === "MemberExpression" &&
  call.callee.property.type === "Identifier"
    ? call.callee.property.name
    : null;

function baseIdentifier(node) {
  let current = node;
  while (
    current.type === "MemberExpression" ||
    current.type === "CallExpression"
  )
    current =
      current.type === "CallExpression" ? current.callee : current.object;
  return current.type === "Identifier" ? current.name : null;
}

/**
 * 整页加载之后，先确认页面能操作再操作：`expect(...)` 等到只在浏览器里渲染的内容，或者 `openTask` 这类
 * 不带对象的 helper 调用，都算确认过。确认之前出现的第一个操作会被报告。
 */
const actAfterReady = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      early:
        "`{{action}}` runs before the page proves it is hydrated after `{{load}}`. Wait for browser-only content in the control's Suspense boundary with an expect, or wrap the load and that wait in a per-page helper (.claude/rules/e2e.md, Hydration). A control that only the browser renders needs no wait; say so in an eslint-disable comment.",
    },
  },
  create(context) {
    const { visitorKeys } = context.sourceCode;
    const classify = (statement) => {
      const calls = callsIn(statement, visitorKeys);
      const load = calls.find((call) => LOADS.has(methodName(call)));
      const ready = calls.some(
        (call) =>
          baseIdentifier(call) === "expect" ||
          (call.callee.type === "Identifier" &&
            statement.type === "ExpressionStatement" &&
            statement.expression.type === "AwaitExpression" &&
            statement.expression.argument === call),
      );
      const action = calls.find((call) => ACTIONS.has(methodName(call)));
      return { load, ready, action };
    };
    const checkBlock = (statements) => {
      let pendingLoad = null;
      for (const statement of statements) {
        const { load, ready, action } = classify(statement);
        if (pendingLoad && !ready && action) {
          context.report({
            node: statement,
            messageId: "early",
            data: { action: methodName(action), load: methodName(pendingLoad) },
          });
          pendingLoad = null;
        }
        if (ready) pendingLoad = null;
        if (load) pendingLoad = load;
      }
    };
    return {
      Program: (node) => checkBlock(node.body),
      BlockStatement: (node) => checkBlock(node.body),
    };
  },
};

const e2ePlugin = { rules: { "act-after-ready": actAfterReady } };

export default e2ePlugin;
