// 页面上的 HTML 只由 React 渲染。react/no-danger 只看 JSX 上直接写的 dangerouslySetInnerHTML，这里补上写进对象、
// 再展开到元素上的写法，比如 <div {...props} />。

const rawHtmlRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      rawHtml:
        "Render HTML through React instead of dangerouslySetInnerHTML: a string set as raw HTML runs as code in the page.",
    },
  },
  create(context) {
    return {
      Property(node) {
        const key =
          node.key.type === "Identifier" ? node.key.name : node.key.value;
        if (key === "dangerouslySetInnerHTML") {
          context.report({ node, messageId: "rawHtml" });
        }
      },
    };
  },
};

const securityPlugin = { rules: { "raw-html": rawHtmlRule } };

/**
 * 页面上的 HTML 只由 React 渲染：dangerouslySetInnerHTML 和 javascript: URL 都会把字符串当代码执行。任何组件都查，
 * 因为组件可能把这个 prop 传给它渲染的元素；写进对象再展开的由 security/raw-html 查。设置这些规则的配置对象要把
 * 这个插件注册为 `security`。派生项目在 eslint.config.project.mjs 给更多文件开这些规则时展开它，不要复制：
 * template 升级改了这里，复制的那份不会跟着变。
 */
export const SECURITY_RULES = {
  "react/no-danger": ["error", { customComponentNames: ["*"] }],
  "security/raw-html": "error",
  "no-script-url": "error",
};

export default securityPlugin;
