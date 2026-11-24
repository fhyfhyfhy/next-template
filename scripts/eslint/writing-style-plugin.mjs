// 文件语言的本地规则，规则本身见 .claude/rules/writing-style.md。

/**
 * 中日韩文字和全角标点；英文里会用到的 → × “” 这类符号不算。派生项目检查别的文本的语言（比如代码注释）时也用它，
 * 两边算的是同一批字符。带 g 标志：用 matchAll，不要用 test() 或 exec()，它们会沿用上一次调用的 lastIndex。
 */
export const CJK =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}\u3000-\u303f\uff00-\uffef]+/gu;

/**
 * Markdown 里 inline code 和 code block 以外的 CJK 文字，每段连续的文字报告一次。frontmatter、HTML 注释和
 * 链接都算正文；引用的 UI 文案、测试数据和正文语言文档的模板放进 code，原样保留。
 */
const englishOnly = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      cjk: 'Write agent instructions in English: found "{{text}}". Quote text that must stay in another language, such as UI copy, test data, or a template for a prose-language document, as inline code or a code block (.claude/rules/writing-style.md).',
    },
  },
  create(context) {
    const { sourceCode } = context;
    const codeRanges = [];
    const collect = (node) => codeRanges.push(sourceCode.getRange(node));
    return {
      code: collect,
      inlineCode: collect,
      "root:exit"() {
        for (const match of sourceCode.text.matchAll(CJK)) {
          const start = match.index;
          if (codeRanges.some(([from, to]) => start >= from && start < to)) {
            continue;
          }
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(start),
              end: sourceCode.getLocFromIndex(start + match[0].length),
            },
            messageId: "cjk",
            data: { text: match[0] },
          });
        }
      },
    };
  },
};

const writingStylePlugin = { rules: { "english-only": englishOnly } };

export default writingStylePlugin;
