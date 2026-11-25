import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { parseDocument } from "yaml";

import { SAMPLE_PRODUCT } from "../sample-product.mjs";

// 文档链接的本地规则。agent 读的文档靠相对链接互相引用，移动或改名文件时 relative-links 指出失效的引用；
// template-links 检查指向 template 在 GitHub 上的链接（见 SAMPLE_PRODUCT），其他外部链接和 node_modules 里的
// 安装文档不检查。code-references 和 section-pointers 检查按名称指向规则小节的写法，这种写法不是链接。frontmatter
// 检查 skill 和规则的 YAML 头。

// template 在 GitHub 上的地址；从仓库根开始的路径跟在 ref 后面。
const GITHUB_LINK =
  /^https:\/\/github\.com\/fhyfhyfhy\/next-template\/(?:blob|tree)\/[^/]+\/([^#?]+)/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LINKS = ["link", "image", "definition"];

// docs/agents/code-review.md 把要读的规则写成小节名接行内代码的文件：**A** in `a.md`，"A" and "B" in `a.md`。
const SECTION_NAME = /"([^"\n]+)"|\*\*([^*\n]+)\*\*/g;
const CODE_SECTION_REFERENCE =
  /((?:(?:"[^"\n]+"|\*\*[^*\n]+\*\*)(?:,? and |, ))*(?:"[^"\n]+"|\*\*[^*\n]+\*\*)) in `([^`\s]+)`/g;
// ESLint 的消息用 See "小节" in <文件> 指向规则：同样的写法，只是文件不写成行内代码。
const MESSAGE_SECTION_REFERENCE =
  /((?:"[^"\n]+"(?:,? and |, ))*"[^"\n]+") in ((?:[\w.-]+\/)*[\w-]+\.md)\b/g;

/** 去掉围栏代码块的文本：代码块里的井号不是标题。 */
function withoutCodeBlocks(text) {
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\S\n]*$/gm, "");
}

/**
 * skill patch 里 diff 块的上下文行和 `-` 行在 text 里的 [起点, 终点) 区间。这些行原样引用上游，和 eslint.config.mjs
 * 用 THIRD_PARTY_SKILLS 跳过的第三方 skill 一样不算这个仓库写的话；`+` 行和 `@@` 后的位置说明是这个仓库写的。
 * 按 CommonMark，至少和开头一样长、后面没有别的文字的反引号行才闭合代码块。
 */
function upstreamQuotes(text) {
  const ranges = [];
  let fence = 0;
  let offset = 0;
  for (const line of text.split("\n")) {
    if (fence === 0) {
      fence = /^(`{3,})diff\s*$/.exec(line)?.[1].length ?? 0;
    } else if ((/^(`{3,})\s*$/.exec(line)?.[1].length ?? 0) >= fence) {
      fence = 0;
    } else if (line === "" || line[0] === " " || line[0] === "-") {
      ranges.push([offset, offset + line.length]);
    }
    offset += line.length + 1;
  }
  return ranges;
}

/** GitHub 给标题生成的锚点：小写，去掉标点，空格换成连字符。 */
function slug(heading) {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** 文件里各个标题的锚点，重名的依次加 -1、-2。 */
function headingAnchors(text) {
  const seen = new Map();
  const result = new Set();
  const prose = withoutCodeBlocks(text.replace(/\r\n/g, "\n"));
  for (const [, heading] of prose.matchAll(/^#{1,6} +(.+?) *#*$/gm)) {
    const base = slug(heading);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    result.add(count === 0 ? base : `${base}-${count}`);
  }
  return result;
}

function decoded(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const inside = (ranges, index) =>
  ranges.some(([from, to]) => index >= from && index < to);

function reportAt(context, index, length, messageId, data) {
  const { sourceCode } = context;
  context.report({
    loc: {
      start: sourceCode.getLocFromIndex(index),
      end: sourceCode.getLocFromIndex(index + length),
    },
    messageId,
    data,
  });
}

/** `needle` 在 `text` 里出现的位置，`skipped` 范围内的不算。 */
function* occurrences(text, needle, skipped) {
  for (
    let index = text.indexOf(needle);
    index !== -1;
    index = text.indexOf(needle, index + needle.length)
  ) {
    if (!inside(skipped, index)) yield index;
  }
}

/** 规则用到的项目，`projectRoot` 是它的根目录。规则运行时从磁盘读链接指向的文件。 */
export default function createDocsPlugin(projectRoot) {
  // Sample product 还在时（template 自己），GitHub 链接的文件也要在本地存在；派生项目删掉了它，就不在本地找。
  const sampleProductHere = SAMPLE_PRODUCT.some((path) =>
    existsSync(join(projectRoot, path)),
  );
  const fromRoot = (filename) =>
    relative(projectRoot, filename).split(sep).join("/");
  const isFile = (path) => {
    const file = join(projectRoot, path);
    return existsSync(file) && statSync(file).isFile();
  };
  const anchorsOf = (path) =>
    headingAnchors(readFileSync(join(projectRoot, path), "utf8"));

  /** 小节名在 `file` 的标题里找不到的那些，返回它们的锚点。 */
  const missingAnchors = (file, names) => {
    const headings = anchorsOf(file);
    return names.map(slug).filter((anchor) => !headings.has(anchor));
  };

  const relativeLinks = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        missing: '"{{target}}" does not resolve: there is no {{path}}.',
        anchor:
          '"{{target}}" does not resolve: {{path}} has no heading for #{{anchor}}.',
      },
    },
    create(context) {
      const file = context.filename;
      const check = (node) => {
        const target = node.url;
        if (!target || SCHEME.test(target)) return;
        const [path, anchor] = target.split("#");
        // 指向本文件标题的链接读正在 lint 的文本，它可能还没保存。
        const resolved = path ? join(dirname(file), decoded(path)) : file;
        if (path) {
          if (fromRoot(resolved).split("/").includes("node_modules")) return;
          if (!existsSync(resolved)) {
            context.report({
              node,
              messageId: "missing",
              data: { target, path: fromRoot(resolved) },
            });
            return;
          }
          if (!statSync(resolved).isFile()) return;
        }
        if (!anchor) return;
        const text = path
          ? readFileSync(resolved, "utf8")
          : context.sourceCode.text;
        if (!headingAnchors(text).has(anchor)) {
          context.report({
            node,
            messageId: "anchor",
            data: { target, path: fromRoot(resolved), anchor },
          });
        }
      };
      return Object.fromEntries(LINKS.map((type) => [type, check]));
    },
  };

  const templateLinks = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        label:
          "The link's label names {{label}}, but it links to {{path}}: label a link to the template on GitHub with the path it links to.",
        missing:
          "{{path}} does not exist here: a link to the template on GitHub names a file the template has.",
      },
    },
    create(context) {
      return {
        link(node) {
          const match = GITHUB_LINK.exec(node.url);
          if (!match) return;
          const path = decoded(match[1]);
          if (sampleProductHere && !existsSync(join(projectRoot, path))) {
            context.report({ node, messageId: "missing", data: { path } });
          }
          const [only, ...rest] = node.children;
          const label =
            only?.type === "inlineCode" && rest.length === 0
              ? only.value
              : undefined;
          if (label !== undefined && label.replace(/\/$/, "") !== path) {
            context.report({ node, messageId: "label", data: { label, path } });
          }
        },
      };
    },
  };

  // agent 读的文档引用 Sample product 时链接到 template 在 GitHub 上的版本，链接文字是从仓库根开始的路径
  // （.agents/skills/skills-and-rules/SKILL.md 的 Citing code）：派生项目删掉它以后，链接照样能打开。
  const samplePaths = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        unlinked:
          '"{{path}}" is the sample product\'s: cite it by a link to the template on GitHub, labelled with its path (Citing code in .agents/skills/skills-and-rules/SKILL.md).',
      },
    },
    create(context) {
      const skipped = [];
      const skip = (node) => skipped.push(context.sourceCode.getRange(node));
      return {
        code: skip,
        link: skip,
        definition: skip,
        "root:exit"() {
          const { text } = context.sourceCode;
          for (const path of SAMPLE_PRODUCT) {
            for (const index of occurrences(text, path, skipped)) {
              reportAt(context, index, path.length, "unlinked", { path });
            }
          }
        },
      };
    },
  };

  // README 和 docs/research/ 下的调研笔记是给人看的：README 介绍项目、随时会改，调研笔记记的是某一天查到的背景和
  // 来源。agent 读的文档不引用它们，agent 要用的结论写在 agent 文档里。derived-project skill 把 README.md 列为派生
  // 项目要改写成自己的文件，提到它不算引用；skill patch 的 diff 块里引用上游的上下文行和 `-` 行也不算（upstreamQuotes）。
  const peopleDocs = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        cited:
          "Agent docs do not cite {{reference}}, which is written for people: put what agents need in the agent docs.",
      },
    },
    create(context) {
      const path = fromRoot(context.filename);
      const derivedProject = path.startsWith(".agents/skills/derived-project/");
      // 前面接着目录名的 README.md 是别的目录的，比如 skill 写的 plans/README.md；../ 接的仍是项目的 README。
      const pattern = derivedProject
        ? /docs\/research\/[^\s)`"]*/g
        : /(?<![\w-]\/|\w)README\.md[^\s)`"]*|docs\/research\/[^\s)`"]*/g;
      const quotes = path.startsWith(".agents/skill-patches/")
        ? upstreamQuotes(context.sourceCode.text)
        : [];
      return {
        "root:exit"() {
          for (const match of context.sourceCode.text.matchAll(pattern)) {
            if (inside(quotes, match.index)) continue;
            reportAt(context, match.index, match[0].length, "cited", {
              reference: match[0],
            });
          }
        },
      };
    },
  };

  // docs/agents/code-review.md 把要读的规则写成行内代码的仓库路径和小节名，不是链接，relative-links 看不到。
  // 只给这一个文件开：别的规则里有示意用的路径。
  const codeReferences = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        path: "`{{path}}` does not exist: write a repository path that exists.",
        file: "{{file}} is neither a repository path nor a rule in .claude/rules/.",
        section: "{{file}} has no heading for #{{anchor}}.",
      },
    },
    create(context) {
      const skipped = [];
      return {
        code: (node) => skipped.push(context.sourceCode.getRange(node)),
        "root:exit"() {
          const { text } = context.sourceCode;
          for (const match of text.matchAll(/`([^`\n]+)`/g)) {
            const span = match[1];
            // 含空白或 { } * < > 的是命令、模板和 glob。第一段在项目根存在才算仓库路径：裸文件名、ESLint 规则名
            // （react-hooks/exhaustive-deps）、feature 里的相对目录（api/）都不算。
            if (inside(skipped, match.index) || /[\s{}*<>]/.test(span)) {
              continue;
            }
            if (!existsSync(join(projectRoot, span.split("/")[0]))) continue;
            if (!existsSync(join(projectRoot, span))) {
              reportAt(context, match.index, match[0].length, "path", {
                path: span,
              });
            }
          }
          for (const match of text.matchAll(CODE_SECTION_REFERENCE)) {
            if (inside(skipped, match.index)) continue;
            const [whole, sections, file] = match;
            // 文件先按仓库路径找，找不到再当成 .claude/rules/ 里的规则名。
            const resolved = [file, `.claude/rules/${file}`].find(isFile);
            if (!resolved) {
              reportAt(context, match.index, whole.length, "file", { file });
              continue;
            }
            const names = [...sections.matchAll(SECTION_NAME)].map(
              ([, quoted, bold]) => quoted ?? bold,
            );
            for (const anchor of missingAnchors(resolved, names)) {
              reportAt(context, match.index, whole.length, "section", {
                file: resolved,
                anchor,
              });
            }
          }
        },
      };
    },
  };

  // ESLint 消息里的 See "小节" in <文件>：小节改名或删掉时，消息就指向不存在的地方。名字是 ${…} 插值的要到运行时
  // 才知道，跳过。按源码文本查，注释里的同样写法也算。
  const sectionPointers = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        file: "{{file}} does not exist: point the message at a rule file that does.",
        section: "{{file}} has no heading for #{{anchor}}.",
      },
    },
    create(context) {
      return {
        "Program:exit"() {
          const { text } = context.sourceCode;
          for (const match of text.matchAll(MESSAGE_SECTION_REFERENCE)) {
            const [whole, sections, file] = match;
            if (!isFile(file)) {
              reportAt(context, match.index, whole.length, "file", { file });
              continue;
            }
            const names = [...sections.matchAll(/"([^"\n]+)"/g)]
              .map(([, name]) => name)
              .filter((name) => !name.includes("${"));
            for (const anchor of missingAnchors(file, names)) {
              reportAt(context, match.index, whole.length, "section", {
                file,
                anchor,
              });
            }
          }
        },
      };
    },
  };

  // npx skills 和 Codex 按严格的 YAML 读 frontmatter，解析不了就跳过整个 skill；@eslint/markdown 的 frontmatter
  // 选项只认出这一块，不校验内容。最常见的是没加引号的值里带 `: `。
  const frontmatter = {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        invalid:
          "The frontmatter is not valid YAML, so `npx skills` and other strict parsers skip this file: {{message}}. Quote a value that contains `: `.",
      },
    },
    create(context) {
      return {
        "root:exit"() {
          const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
            context.sourceCode.text,
          );
          if (!block) return;
          const start = block[0].indexOf(block[1]);
          for (const error of parseDocument(block[1]).errors) {
            const [from, to] = error.pos;
            reportAt(context, start + from, Math.max(to - from, 1), "invalid", {
              // yaml 在第一行末尾写的是 frontmatter 里的行列，报告的位置已经是文件里的。
              message: error.message
                .split("\n")[0]
                .replace(/ at line \d+, column \d+:$/, ""),
            });
          }
        },
      };
    },
  };

  return {
    rules: {
      frontmatter,
      "relative-links": relativeLinks,
      "template-links": templateLinks,
      "sample-product-paths": samplePaths,
      "people-docs": peopleDocs,
      "code-references": codeReferences,
      "section-pointers": sectionPointers,
    },
  };
}
