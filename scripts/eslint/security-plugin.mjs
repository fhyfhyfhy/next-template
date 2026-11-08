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

export default securityPlugin;
