import { relative, sep } from "node:path";

/**
 * 文件的 owner 拥有的文案 namespace（.claude/rules/i18n.md「Namespaces and keys」）：features/<name> 下是
 * <name>，app/ 下是 app，components/ 下是 ui；src/ 下同样。其他位置的文件没有 namespace，不读文案。
 */
export function messageNamespace(projectRoot, filename) {
  const parts = relative(projectRoot, filename).split(sep);
  if (parts[0] === "src") parts.shift();
  if (parts[0] === "features" && parts.length > 2) return parts[1];
  if (parts[0] === "app") return "app";
  if (parts[0] === "components") return "ui";
  return null;
}
